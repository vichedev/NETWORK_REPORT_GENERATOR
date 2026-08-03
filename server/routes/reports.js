import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { db } from '../db.js'
import { UPLOADS_DIR } from '../config.js'
import { callAI, SECTION_SCHEMA, CLOSING_SCHEMA, PROVIDERS } from '../providers.js'
import { getActiveKey } from './settings.js'

export const reportsRouter = Router()

const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
}

/** Acepta tanto una data URL completa como base64 pelado. */
function parseImagePayload(dataUrl, fallbackMime = 'image/png') {
  const raw = String(dataUrl || '')
  const match = raw.match(/^data:([^;,]+);base64,(.*)$/s)
  if (match) return { mime: match[1].toLowerCase(), base64: match[2] }
  return { mime: fallbackMime, base64: raw }
}

function saveImageFile({ base64, mime }) {
  const ext = EXT_BY_MIME[mime] || '.png'
  const filename = `${crypto.randomUUID()}${ext}`
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), Buffer.from(base64, 'base64'))
  return filename
}

function deleteImageFile(filename) {
  // Nunca confiamos en el nombre almacenado para construir rutas.
  const safe = path.basename(String(filename || ''))
  if (!safe || safe === '.' || safe === '..') return
  const full = path.join(UPLOADS_DIR, safe)
  if (fs.existsSync(full)) fs.unlinkSync(full)
}

// ── Prompts ─────────────────────────────────────────────────────────────────

function buildSectionPrompt({ empresa, img }) {
  const contexto = img.descripcion?.trim()
    ? `\nCONTEXTO ADICIONAL APORTADO POR EL INGENIERO (tenlo muy en cuenta):\n${img.descripcion.trim()}`
    : ''

  return `Eres un Ingeniero de Soporte Core Senior. Analiza técnicamente la gráfica de tráfico de la interfaz "${img.interfaz || 'no especificada'}" en el nodo "${img.nodeName}" para el cliente "${empresa}".

DATOS DE LA GRÁFICA:
- Título: ${img.titulo}
- Tipo de gráfica: ${img.tipoGrafica || 'no especificado'}
- Período: ${img.periodo || 'no especificado'}
- IP SNMP: ${img.ip || 'no especificada'}${contexto}

EXTRACCIÓN DE DATOS:
- Identifica los valores numéricos reales visibles en la imagen: Max, Average y Last, tanto para RX (entrada) como para TX (salida).
- Si un valor no es legible en la imagen, escribe "N/D". No lo inventes.

REDACTA:
- Un análisis técnico profundo del comportamiento (picos, valles, estabilidad, saturación).
- 3 observaciones técnicas basadas en los datos extraídos.
- 2 recomendaciones proactivas.

RESPONDE EXCLUSIVAMENTE EN FORMATO JSON con esta estructura exacta:
{
  "desc_imagen": "Descripción técnica de la gráfica",
  "stats": {
    "entrada":     { "max": "...", "avg": "...", "last": "..." },
    "salida":      { "max": "...", "avg": "...", "last": "..." },
    "utilizacion": { "max": "...%", "avg": "...%", "last": "...%" }
  },
  "analisis": "Texto detallado del análisis...",
  "observaciones": ["...", "...", "..."],
  "recomendaciones": ["...", "..."]
}`
}

function buildClosingPrompt({ empresa, sections, historial }) {
  const resumenNodos = JSON.stringify(
    sections.map(s => ({ nodo: s.nodo, interfaz: s.interfaz, observaciones: s.observaciones })),
  )

  const contextoHistorico = historial.length
    ? `\nPARA CONTEXTO, estas fueron las conclusiones de los informes anteriores de este mismo cliente (de más reciente a más antiguo). Señala evoluciones o reincidencias si las detectas:\n${JSON.stringify(historial)}`
    : ''

  return `Como Ingeniero Senior, redacta el cierre de un informe técnico de infraestructura para "${empresa}".

Se analizaron estos nodos y observaciones: ${resumenNodos}${contextoHistorico}

Genera:
1. Un Resumen Ejecutivo técnico y profesional.
2. Tres Conclusiones Finales basadas estrictamente en las observaciones de los nodos.

RESPONDE EXCLUSIVAMENTE EN JSON:
{ "resumen": "...", "conclusiones": ["...", "...", "..."] }`
}

// ── Vinculación de nodos ────────────────────────────────────────────────────

/**
 * Resuelve el nodo de cada imagen contra el catálogo de la empresa. Si el
 * ingeniero escribió un nodo que no existe, lo da de alta — así el catálogo
 * y el historial por nodo se mantienen solos.
 */
function resolveNodo(empresaId, img) {
  if (!empresaId) return null

  if (img.nodoId) {
    const found = db.prepare('SELECT id FROM nodos WHERE id = ? AND empresa_id = ?').get(Number(img.nodoId), empresaId)
    if (found) return found.id
  }

  const nombre = String(img.nodeName || '').trim()
  if (!nombre) return null

  const existing = db.prepare('SELECT id FROM nodos WHERE empresa_id = ? AND nombre = ? COLLATE NOCASE').get(empresaId, nombre)
  if (existing) return existing.id

  const info = db.prepare('INSERT INTO nodos (empresa_id, nombre, interfaz, ip) VALUES (?, ?, ?, ?)')
    .run(empresaId, nombre, String(img.interfaz || '').trim(), String(img.ip || '').trim())
  return info.lastInsertRowid
}

// ── Generar informe ─────────────────────────────────────────────────────────

/**
 * Generar un informe puede tardar varios minutos: cada gráfica es una llamada
 * de visión y los planes gratuitos obligan a esperar entre una y otra. Por eso
 * la respuesta es un stream de eventos (SSE) en vez de una única respuesta:
 * así el navegador puede decir en qué gráfica va y cuánto queda de espera.
 */
reportsRouter.post('/generate', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // evita el buffering de nginx
  res.flushHeaders?.()

  const send = (payload) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`)
  }
  const fail = (message) => {
    send({ type: 'error', error: message })
    res.end()
  }

  /**
   * Detecta que el usuario ha cerrado la pestaña para no seguir gastando
   * llamadas a la IA.
   *
   * Ojo: hay que escuchar en `res`, no en `req`. El evento 'close' de la
   * petición se dispara también al terminar de recibir el cuerpo, así que
   * usarlo aquí abortaba el trabajo nada más empezar y dejaba la conexión
   * colgada.
   */
  const clienteDesconectado = () => res.writableEnded || res.destroyed || !res.writable

  const active = getActiveKey()
  if (!active) {
    return fail('No hay ninguna API key de IA activa. Configúrala en Ajustes.')
  }

  const empresaId = req.body?.empresaId ? Number(req.body.empresaId) : null
  const empresaRow = empresaId ? db.prepare('SELECT id, nombre FROM empresas WHERE id = ?').get(empresaId) : null
  const empresaNombre = String(empresaRow?.nombre || req.body?.empresaNombre || '').trim()
  const generadoPor = String(req.body?.generadoPor || '').trim()
  const periodo = String(req.body?.periodo || '').trim()
  const images = Array.isArray(req.body?.images) ? req.body.images : []

  if (!empresaNombre) return fail('Falta la empresa del informe.')
  if (!images.length) return fail('Debes enviar al menos una imagen.')

  const sections = []
  const total = images.length

  try {
    // 1. Una llamada de visión por gráfica.
    for (let i = 0; i < images.length; i++) {
      if (clienteDesconectado()) return

      const img = images[i]
      const parsed = parseImagePayload(img.dataUrl, img.mime)
      if (!parsed.base64) throw new Error(`La imagen "${img.titulo || 'sin título'}" llegó vacía.`)

      send({
        type: 'progress',
        stage: 'analizando',
        current: i + 1,
        total,
        nodo: img.nodeName,
        message: `Analizando gráfica ${i + 1} de ${total} · ${img.nodeName || img.titulo}`,
      })

      const content = await callAI({
        provider: active.provider,
        apiKey: active.apiKey,
        model: active.model,
        prompt: buildSectionPrompt({ empresa: empresaNombre, img }),
        image: parsed,
        schema: SECTION_SCHEMA,
        onWait: ({ seconds, attempt, maxAttempts }) => send({
          type: 'progress',
          stage: 'esperando',
          current: i + 1,
          total,
          seconds,
          attempt,
          maxAttempts,
          message: `Límite de tokens del proveedor alcanzado. Reintentando la gráfica ${i + 1} de ${total}…`,
        }),
      })

      sections.push({
        nodo: img.nodeName,
        interfaz: img.interfaz,
        titulo: img.titulo,
        periodo: img.periodo,
        ip: img.ip,
        tipoGrafica: img.tipoGrafica,
        ...content,
      })
    }

    if (clienteDesconectado()) return
    send({ type: 'progress', stage: 'cierre', current: total, total, message: 'Redactando resumen y conclusiones…' })

    // 2. Cierre global, con memoria de los informes anteriores del cliente.
    const historial = empresaRow
      ? db.prepare('SELECT analysis_json, created_at FROM reports WHERE empresa_id = ? ORDER BY created_at DESC LIMIT 3')
          .all(empresaRow.id)
          .map(r => {
            try {
              const prev = JSON.parse(r.analysis_json)
              return { fecha: r.created_at, conclusiones: prev.conclusiones || [] }
            } catch { return null }
          })
          .filter(Boolean)
      : []

    const closing = await callAI({
      provider: active.provider,
      apiKey: active.apiKey,
      model: active.model,
      prompt: buildClosingPrompt({ empresa: empresaNombre, sections, historial }),
      schema: CLOSING_SCHEMA,
      onWait: ({ seconds, attempt, maxAttempts }) => send({
        type: 'progress',
        stage: 'esperando',
        current: total,
        total,
        seconds,
        attempt,
        maxAttempts,
        message: 'Límite de tokens alcanzado. Reintentando el resumen final…',
      }),
    })

    const analysis = {
      resumen: closing.resumen,
      sections,
      conclusiones: closing.conclusiones || [],
    }

    if (clienteDesconectado()) return
    send({ type: 'progress', stage: 'guardando', current: total, total, message: 'Archivando el informe y sus imágenes…' })

    // 3. Persistir informe + imágenes.
    const savedFiles = []
    let reportId
    try {
      reportId = db.transaction(() => {
        const info = db.prepare(`
          INSERT INTO reports (empresa_id, empresa_nombre, generado_por, periodo, provider, model, analysis_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          empresaRow?.id ?? null, empresaNombre, generadoPor, periodo,
          active.provider, active.model, JSON.stringify(analysis),
        )
        const newId = info.lastInsertRowid

        const insertImage = db.prepare(`
          INSERT INTO report_images
            (report_id, nodo_id, nodo_nombre, titulo, interfaz, ip, periodo, tipo_grafica, descripcion, filename, mime, orden)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        images.forEach((img, i) => {
          const parsed = parseImagePayload(img.dataUrl, img.mime)
          const filename = saveImageFile(parsed)
          savedFiles.push(filename)
          insertImage.run(
            newId,
            resolveNodo(empresaRow?.id ?? null, img),
            String(img.nodeName || ''),
            String(img.titulo || ''),
            String(img.interfaz || ''),
            String(img.ip || ''),
            String(img.periodo || ''),
            String(img.tipoGrafica || ''),
            String(img.descripcion || ''),
            filename,
            parsed.mime,
            i,
          )
        })

        return newId
      })()
    } catch (err) {
      savedFiles.forEach(deleteImageFile)
      throw err
    }

    send({
      type: 'done',
      reportId,
      analysis,
      provider: active.provider,
      providerLabel: PROVIDERS[active.provider]?.label || active.provider,
      model: active.model,
    })
  } catch (err) {
    console.error('[generate]', err)
    send({ type: 'error', error: err.message || 'Error inesperado durante el análisis con IA.' })
  } finally {
    // Pase lo que pase, cerramos el stream: si no, el navegador se queda
    // esperando hasta que salte su propio timeout.
    if (!res.writableEnded) res.end()
  }
})

// ── Historial ───────────────────────────────────────────────────────────────

reportsRouter.get('/', (req, res) => {
  const empresaId = req.query.empresaId ? Number(req.query.empresaId) : null
  const nodoId = req.query.nodoId ? Number(req.query.nodoId) : null
  const limit = Math.min(Number(req.query.limit) || 100, 500)

  const where = []
  const params = []
  if (empresaId) { where.push('r.empresa_id = ?'); params.push(empresaId) }
  if (nodoId) { where.push('EXISTS (SELECT 1 FROM report_images ri WHERE ri.report_id = r.id AND ri.nodo_id = ?)'); params.push(nodoId) }

  const rows = db.prepare(`
    SELECT r.id, r.empresa_id, r.empresa_nombre, r.generado_por, r.periodo,
           r.provider, r.model, r.created_at,
           (SELECT COUNT(*) FROM report_images ri WHERE ri.report_id = r.id) AS imagenes,
           (SELECT GROUP_CONCAT(DISTINCT ri.nodo_nombre) FROM report_images ri WHERE ri.report_id = r.id) AS nodos
    FROM reports r
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT ?
  `).all(...params, limit)

  res.json({
    reports: rows.map(r => ({
      ...r,
      nodos: r.nodos ? r.nodos.split(',') : [],
    })),
  })
})

reportsRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'Informe no encontrado.' })

  const images = db.prepare(`
    SELECT id, nodo_id, nodo_nombre, titulo, interfaz, ip, periodo, tipo_grafica, descripcion, mime, orden
    FROM report_images WHERE report_id = ? ORDER BY orden ASC
  `).all(id)

  let analysis = null
  try { analysis = JSON.parse(row.analysis_json) } catch { /* informe corrupto */ }

  res.json({
    report: {
      id: row.id,
      empresaId: row.empresa_id,
      empresaNombre: row.empresa_nombre,
      generadoPor: row.generado_por,
      periodo: row.periodo,
      provider: row.provider,
      model: row.model,
      createdAt: row.created_at,
    },
    analysis,
    images: images.map(img => ({ ...img, url: `/api/reports/${id}/images/${img.id}` })),
  })
})

/** Sirve una imagen guardada. Se usa para regenerar el DOCX/PDF desde el historial. */
reportsRouter.get('/:id/images/:imageId', (req, res) => {
  const row = db.prepare('SELECT filename, mime FROM report_images WHERE id = ? AND report_id = ?')
    .get(Number(req.params.imageId), Number(req.params.id))
  if (!row) return res.status(404).json({ error: 'Imagen no encontrada.' })

  const safe = path.basename(row.filename)
  const full = path.join(UPLOADS_DIR, safe)
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'El archivo ya no está disponible.' })

  res.type(row.mime).sendFile(full)
})

reportsRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT 1 FROM reports WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Informe no encontrado.' })
  }

  const files = db.prepare('SELECT filename FROM report_images WHERE report_id = ?').all(id)
  db.prepare('DELETE FROM reports WHERE id = ?').run(id) // report_images cae en cascada
  files.forEach(f => deleteImageFile(f.filename))

  res.json({ ok: true })
})
