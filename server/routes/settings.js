import { Router } from 'express'
import { db } from '../db.js'
import { encryptSecret, decryptSecret } from '../crypto.js'
import { PROVIDERS, isValidProvider, testCredentials } from '../providers.js'

export const settingsRouter = Router()

const SELECT_PUBLIC = `
  SELECT id, provider, label, model, key_last4, is_active, created_at, updated_at
  FROM api_keys ORDER BY is_active DESC, id ASC
`

/** Devuelve la key activa descifrada, o null si no hay ninguna configurada. */
export function getActiveKey() {
  const row = db.prepare('SELECT * FROM api_keys WHERE is_active = 1 LIMIT 1').get()
  if (!row) return null
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    label: row.label,
    apiKey: decryptSecret(row.key_enc),
  }
}

function activateExclusive(id) {
  db.transaction(() => {
    db.prepare('UPDATE api_keys SET is_active = 0').run()
    db.prepare("UPDATE api_keys SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id)
  })()
}

/** Catálogo de proveedores y modelos disponibles. */
settingsRouter.get('/providers', (req, res) => {
  res.json({ providers: PROVIDERS })
})

settingsRouter.get('/keys', (req, res) => {
  res.json({ keys: db.prepare(SELECT_PUBLIC).all() })
})

settingsRouter.post('/keys', (req, res) => {
  const provider = String(req.body?.provider || '')
  const model = String(req.body?.model || '').trim()
  const apiKey = String(req.body?.apiKey || '').trim()
  const label = String(req.body?.label || '').trim() || `${PROVIDERS[provider]?.label || provider} · ${model}`

  if (!isValidProvider(provider)) return res.status(400).json({ error: 'Proveedor no válido.' })
  if (!model) return res.status(400).json({ error: 'Debes elegir un modelo.' })
  if (apiKey.length < 12) return res.status(400).json({ error: 'La API key parece incompleta.' })

  const isFirst = db.prepare('SELECT COUNT(*) AS n FROM api_keys').get().n === 0

  const info = db.prepare(`
    INSERT INTO api_keys (provider, label, model, key_enc, key_last4, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(provider, label, model, encryptSecret(apiKey), apiKey.slice(-4), isFirst ? 1 : 0)

  res.status(201).json({ key: db.prepare('SELECT id, provider, label, model, key_last4, is_active, created_at, updated_at FROM api_keys WHERE id = ?').get(info.lastInsertRowid) })
})

settingsRouter.patch('/keys/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'API key no encontrada.' })

  const label = req.body?.label !== undefined ? String(req.body.label).trim() : existing.label
  const model = req.body?.model !== undefined ? String(req.body.model).trim() : existing.model
  const newKey = req.body?.apiKey !== undefined ? String(req.body.apiKey).trim() : ''

  if (!model) return res.status(400).json({ error: 'Debes elegir un modelo.' })
  if (newKey && newKey.length < 12) return res.status(400).json({ error: 'La API key parece incompleta.' })

  db.prepare(`
    UPDATE api_keys
    SET label = ?, model = ?, key_enc = ?, key_last4 = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    label,
    model,
    newKey ? encryptSecret(newKey) : existing.key_enc,
    newKey ? newKey.slice(-4) : existing.key_last4,
    id,
  )

  res.json({ key: db.prepare('SELECT id, provider, label, model, key_last4, is_active, created_at, updated_at FROM api_keys WHERE id = ?').get(id) })
})

settingsRouter.post('/keys/:id/activate', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT 1 FROM api_keys WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'API key no encontrada.' })
  }
  activateExclusive(id)
  res.json({ keys: db.prepare(SELECT_PUBLIC).all() })
})

/** Prueba la key contra el proveedor real (una llamada mínima). */
settingsRouter.post('/keys/:id/test', async (req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'API key no encontrada.' })

  try {
    await testCredentials({ provider: row.provider, apiKey: decryptSecret(row.key_enc), model: row.model })
    res.json({ ok: true, message: `Conexión correcta con ${PROVIDERS[row.provider].label} (${row.model}).` })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

settingsRouter.delete('/keys/:id', (req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT is_active FROM api_keys WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'API key no encontrada.' })

  db.prepare('DELETE FROM api_keys WHERE id = ?').run(id)

  // Si se borró la activa, promociona la siguiente disponible.
  if (row.is_active) {
    const next = db.prepare('SELECT id FROM api_keys ORDER BY id ASC LIMIT 1').get()
    if (next) activateExclusive(next.id)
  }

  res.json({ keys: db.prepare(SELECT_PUBLIC).all() })
})
