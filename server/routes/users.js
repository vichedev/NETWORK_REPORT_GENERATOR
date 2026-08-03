import { Router } from 'express'
import { db } from '../db.js'
import { hashPassword } from '../crypto.js'
import { publicUser, validatePassword, validateUsername } from '../auth.js'

export const usersRouter = Router()

const listUsers = db.prepare('SELECT * FROM users ORDER BY id ASC')
const getUser = db.prepare('SELECT * FROM users WHERE id = ?')

function isTaken(username, exceptId = 0) {
  return Boolean(db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?')
    .get(username, exceptId))
}

usersRouter.get('/', (req, res) => {
  res.json({ users: listUsers.all().map(publicUser) })
})

/** Alta de un usuario nuevo. Entra obligado a cambiar su contraseña. */
usersRouter.post('/', (req, res) => {
  const username = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '')

  const userErr = validateUsername(username)
  if (userErr) return res.status(400).json({ error: userErr })
  const pwErr = validatePassword(password)
  if (pwErr) return res.status(400).json({ error: pwErr })
  if (isTaken(username)) return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso.' })

  db.prepare(`
    INSERT INTO users (username, password_hash, must_change_password)
    VALUES (?, ?, 1)
  `).run(username, hashPassword(password))

  res.status(201).json({ users: listUsers.all().map(publicUser) })
})

/** Renombra a cualquier usuario. */
usersRouter.patch('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!getUser.get(id)) return res.status(404).json({ error: 'Usuario no encontrado.' })

  const username = String(req.body?.username || '').trim()
  const err = validateUsername(username)
  if (err) return res.status(400).json({ error: err })
  if (isTaken(username, id)) return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso.' })

  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, id)
  res.json({ users: listUsers.all().map(publicUser) })
})

/**
 * Restablece la contraseña de otro usuario. Le cierra todas las sesiones y le
 * marca que debe cambiarla la próxima vez que entre.
 */
usersRouter.post('/:id/password', (req, res) => {
  const id = Number(req.params.id)
  const target = getUser.get(id)
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' })

  const password = String(req.body?.password || '')
  const pwErr = validatePassword(password)
  if (pwErr) return res.status(400).json({ error: pwErr })

  if (id === req.user.id) {
    return res.status(400).json({
      error: 'Para tu propia cuenta usa el cambio de contraseña, que pide la actual.',
    })
  }

  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?')
      .run(hashPassword(password), id)
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id)
  })()

  res.json({ users: listUsers.all().map(publicUser) })
})

usersRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!getUser.get(id)) return res.status(404).json({ error: 'Usuario no encontrado.' })

  if (id === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' })
  }
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n <= 1) {
    return res.status(400).json({ error: 'Debe quedar al menos un usuario en el sistema.' })
  }

  // Las sesiones caen en cascada por la clave foránea.
  db.prepare('DELETE FROM users WHERE id = ?').run(id)
  res.json({ users: listUsers.all().map(publicUser) })
})
