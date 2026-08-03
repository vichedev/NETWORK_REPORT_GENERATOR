import { Router } from 'express'
import { db } from '../db.js'

export const empresasRouter = Router()

const listEmpresas = db.prepare(`
  SELECT e.id, e.nombre, e.contacto, e.notas, e.created_at,
         (SELECT COUNT(*) FROM nodos   n WHERE n.empresa_id = e.id) AS nodos_count,
         (SELECT COUNT(*) FROM reports r WHERE r.empresa_id = e.id) AS informes_count
  FROM empresas e
  ORDER BY e.nombre COLLATE NOCASE ASC
`)

const getEmpresa = db.prepare('SELECT id, nombre, contacto, notas, created_at FROM empresas WHERE id = ?')
const listNodos = db.prepare('SELECT id, empresa_id, nombre, interfaz, ip, notas, created_at FROM nodos WHERE empresa_id = ? ORDER BY nombre COLLATE NOCASE ASC')

function isUniqueError(err) {
  return err && typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')
}

// ── Empresas ────────────────────────────────────────────────────────────────

empresasRouter.get('/', (req, res) => {
  res.json({ empresas: listEmpresas.all() })
})

empresasRouter.get('/:id', (req, res) => {
  const empresa = getEmpresa.get(Number(req.params.id))
  if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada.' })
  res.json({ empresa, nodos: listNodos.all(empresa.id) })
})

empresasRouter.post('/', (req, res) => {
  const nombre = String(req.body?.nombre || '').trim()
  if (!nombre) return res.status(400).json({ error: 'El nombre de la empresa es obligatorio.' })

  try {
    const info = db.prepare('INSERT INTO empresas (nombre, contacto, notas) VALUES (?, ?, ?)')
      .run(nombre, String(req.body?.contacto || '').trim(), String(req.body?.notas || '').trim())
    res.status(201).json({ empresa: getEmpresa.get(info.lastInsertRowid) })
  } catch (err) {
    if (isUniqueError(err)) return res.status(409).json({ error: 'Ya existe una empresa con ese nombre.' })
    throw err
  }
})

empresasRouter.patch('/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = getEmpresa.get(id)
  if (!existing) return res.status(404).json({ error: 'Empresa no encontrada.' })

  const nombre = req.body?.nombre !== undefined ? String(req.body.nombre).trim() : existing.nombre
  if (!nombre) return res.status(400).json({ error: 'El nombre de la empresa es obligatorio.' })

  try {
    db.prepare('UPDATE empresas SET nombre = ?, contacto = ?, notas = ? WHERE id = ?').run(
      nombre,
      req.body?.contacto !== undefined ? String(req.body.contacto).trim() : existing.contacto,
      req.body?.notas !== undefined ? String(req.body.notas).trim() : existing.notas,
      id,
    )
    res.json({ empresa: getEmpresa.get(id) })
  } catch (err) {
    if (isUniqueError(err)) return res.status(409).json({ error: 'Ya existe una empresa con ese nombre.' })
    throw err
  }
})

empresasRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!getEmpresa.get(id)) return res.status(404).json({ error: 'Empresa no encontrada.' })
  // Los nodos caen en cascada; los informes conservan el histórico con empresa_id = NULL.
  db.prepare('DELETE FROM empresas WHERE id = ?').run(id)
  res.json({ ok: true })
})

// ── Nodos ───────────────────────────────────────────────────────────────────

empresasRouter.get('/:id/nodos', (req, res) => {
  const id = Number(req.params.id)
  if (!getEmpresa.get(id)) return res.status(404).json({ error: 'Empresa no encontrada.' })
  res.json({ nodos: listNodos.all(id) })
})

empresasRouter.post('/:id/nodos', (req, res) => {
  const empresaId = Number(req.params.id)
  if (!getEmpresa.get(empresaId)) return res.status(404).json({ error: 'Empresa no encontrada.' })

  const nombre = String(req.body?.nombre || '').trim()
  if (!nombre) return res.status(400).json({ error: 'El nombre del nodo es obligatorio.' })

  try {
    db.prepare('INSERT INTO nodos (empresa_id, nombre, interfaz, ip, notas) VALUES (?, ?, ?, ?, ?)').run(
      empresaId,
      nombre,
      String(req.body?.interfaz || '').trim(),
      String(req.body?.ip || '').trim(),
      String(req.body?.notas || '').trim(),
    )
    res.status(201).json({ nodos: listNodos.all(empresaId) })
  } catch (err) {
    if (isUniqueError(err)) return res.status(409).json({ error: 'Esa empresa ya tiene un nodo con ese nombre.' })
    throw err
  }
})

empresasRouter.patch('/:id/nodos/:nodoId', (req, res) => {
  const empresaId = Number(req.params.id)
  const nodoId = Number(req.params.nodoId)
  const existing = db.prepare('SELECT * FROM nodos WHERE id = ? AND empresa_id = ?').get(nodoId, empresaId)
  if (!existing) return res.status(404).json({ error: 'Nodo no encontrado.' })

  const nombre = req.body?.nombre !== undefined ? String(req.body.nombre).trim() : existing.nombre
  if (!nombre) return res.status(400).json({ error: 'El nombre del nodo es obligatorio.' })

  try {
    db.prepare('UPDATE nodos SET nombre = ?, interfaz = ?, ip = ?, notas = ? WHERE id = ?').run(
      nombre,
      req.body?.interfaz !== undefined ? String(req.body.interfaz).trim() : existing.interfaz,
      req.body?.ip !== undefined ? String(req.body.ip).trim() : existing.ip,
      req.body?.notas !== undefined ? String(req.body.notas).trim() : existing.notas,
      nodoId,
    )
    res.json({ nodos: listNodos.all(empresaId) })
  } catch (err) {
    if (isUniqueError(err)) return res.status(409).json({ error: 'Esa empresa ya tiene un nodo con ese nombre.' })
    throw err
  }
})

empresasRouter.delete('/:id/nodos/:nodoId', (req, res) => {
  const empresaId = Number(req.params.id)
  const nodoId = Number(req.params.nodoId)
  if (!db.prepare('SELECT 1 FROM nodos WHERE id = ? AND empresa_id = ?').get(nodoId, empresaId)) {
    return res.status(404).json({ error: 'Nodo no encontrado.' })
  }
  db.prepare('DELETE FROM nodos WHERE id = ?').run(nodoId)
  res.json({ nodos: listNodos.all(empresaId) })
})
