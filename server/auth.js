import { Router } from 'express'
import { db, purgeExpiredSessions } from './db.js'
import { hashPassword, verifyPassword, randomToken } from './crypto.js'
import { SESSION_COOKIE, SESSION_TTL_MS } from './config.js'

/** Credenciales que se crean solas la primera vez que arranca el sistema. */
export const DEFAULT_USERNAME = 'admin'
export const DEFAULT_PASSWORD = 'admin123'

// ── Rate limit muy simple para el login (en memoria) ─────────────────────────
const attempts = new Map() // ip -> { count, until }
const MAX_ATTEMPTS = 8
const LOCK_MS = 10 * 60 * 1000

function checkRate(ip) {
  const entry = attempts.get(ip)
  if (!entry) return true
  if (entry.until && entry.until > Date.now()) return false
  if (entry.until) attempts.delete(ip)
  return true
}

function registerFailure(ip) {
  const entry = attempts.get(ip) || { count: 0, until: 0 }
  entry.count += 1
  if (entry.count >= MAX_ATTEMPTS) entry.until = Date.now() + LOCK_MS
  attempts.set(ip, entry)
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function userCount() {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n
}

/**
 * Crea el usuario administrador por defecto si la base de datos está vacía.
 * Queda marcado con must_change_password para que la interfaz insista en
 * cambiar la contraseña conocida.
 */
export function seedDefaultUser() {
  if (userCount() > 0) return null

  db.prepare(`
    INSERT INTO users (username, password_hash, must_change_password)
    VALUES (?, ?, 1)
  `).run(DEFAULT_USERNAME, hashPassword(DEFAULT_PASSWORD))

  return { username: DEFAULT_USERNAME, password: DEFAULT_PASSWORD }
}

/** ¿Queda algún usuario con la contraseña que le asignaron sin cambiar? */
export function hasPendingPasswordChange() {
  return db.prepare('SELECT COUNT(*) AS n FROM users WHERE must_change_password = 1').get().n > 0
}

export function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: row.created_at,
  }
}

function createSession(req, res, userId) {
  const token = randomToken()
  const expiresAt = Date.now() + SESSION_TTL_MS
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt)
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Si sirves el sistema tras un proxy con TLS, la cookie viaja solo por HTTPS.
    secure: req.secure,
    maxAge: SESSION_TTL_MS,
    path: '/',
  })
}

/** Middleware: exige sesión válida. Deja el usuario en req.user. */
export function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const row = db.prepare(`
    SELECT s.expires_at, u.id, u.username, u.must_change_password, u.created_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token)

  if (!row || row.expires_at < Date.now()) {
    if (row) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    res.clearCookie(SESSION_COOKIE, { path: '/' })
    return res.status(401).json({ error: 'Sesión expirada' })
  }

  req.user = publicUser(row)
  next()
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.'
  }
  return null
}

export function validateUsername(username) {
  if (typeof username !== 'string' || username.trim().length < 3) {
    return 'El usuario debe tener al menos 3 caracteres.'
  }
  return null
}

// ── Rutas ───────────────────────────────────────────────────────────────────

export const authRouter = Router()

/**
 * Estado del login. Avisa si todavía hay alguna cuenta con la contraseña
 * por defecto, para que la pantalla de acceso pueda mostrar la pista.
 */
authRouter.get('/status', (req, res) => {
  const pending = hasPendingPasswordChange()
  res.json({
    usingDefaultCredentials: pending,
    defaultUsername: pending ? DEFAULT_USERNAME : undefined,
    defaultPassword: pending ? DEFAULT_PASSWORD : undefined,
  })
})

authRouter.post('/login', (req, res) => {
  const ip = req.ip || 'unknown'
  if (!checkRate(ip)) {
    return res.status(429).json({ error: 'Demasiados intentos fallidos. Espera 10 minutos.' })
  }

  const username = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '')

  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username)
  if (!user || !verifyPassword(password, user.password_hash)) {
    registerFailure(ip)
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' })
  }

  attempts.delete(ip)
  purgeExpiredSessions()
  createSession(req, res, user.id)
  res.json({ user: publicUser(user) })
})

authRouter.post('/logout', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE]
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  res.clearCookie(SESSION_COOKIE, { path: '/' })
  res.json({ ok: true })
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

/** Cambia el nombre de usuario de la cuenta con la que has entrado. */
authRouter.patch('/me', requireAuth, (req, res) => {
  const username = String(req.body?.username || '').trim()
  const err = validateUsername(username)
  if (err) return res.status(400).json({ error: err })

  const taken = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?')
    .get(username, req.user.id)
  if (taken) return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso.' })

  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, req.user.id)
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) })
})

/** Cambia la contraseña propia. Exige la actual y cierra las demás sesiones. */
authRouter.post('/password', requireAuth, (req, res) => {
  const current = String(req.body?.currentPassword || '')
  const next = String(req.body?.newPassword || '')

  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id)
  if (!verifyPassword(current, row.password_hash)) {
    return res.status(401).json({ error: 'La contraseña actual no es correcta.' })
  }
  const pwErr = validatePassword(next)
  if (pwErr) return res.status(400).json({ error: pwErr })
  if (next === current) return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual.' })

  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
    .run(hashPassword(next), req.user.id)

  // Cierra el resto de sesiones abiertas y renueva la actual.
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id)
  createSession(req, res, req.user.id)

  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) })
})
