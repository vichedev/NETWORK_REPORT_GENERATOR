import fs from 'node:fs'
import crypto from 'node:crypto'
import { SECRET_FILE } from './config.js'

let masterKey = null

/**
 * Clave maestra del servidor. Se genera sola la primera vez y se guarda en
 * data/.secret — así no hace falta ningún .env ni variable de entorno.
 */
export function getMasterKey() {
  if (masterKey) return masterKey

  if (fs.existsSync(SECRET_FILE)) {
    masterKey = Buffer.from(fs.readFileSync(SECRET_FILE, 'utf8').trim(), 'hex')
    if (masterKey.length !== 32) {
      throw new Error('data/.secret corrupto: se esperaban 32 bytes en hex')
    }
  } else {
    masterKey = crypto.randomBytes(32)
    fs.writeFileSync(SECRET_FILE, masterKey.toString('hex'), { mode: 0o600 })
  }
  return masterKey
}

// ── Cifrado de API keys (AES-256-GCM) ────────────────────────────────────────

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getMasterKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.')
}

export function decryptSecret(payload) {
  const [ivB64, tagB64, dataB64] = String(payload).split('.')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Secreto con formato inválido')
  const decipher = crypto.createDecipheriv('aes-256-gcm', getMasterKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}

// ── Contraseñas (scrypt) ─────────────────────────────────────────────────────

export function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(password, stored) {
  const [scheme, saltB64, hashB64] = String(stored).split('$')
  if (scheme !== 'scrypt') return false
  const expected = Buffer.from(hashB64, 'base64')
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: 16384, r: 8, p: 1,
  })
  return crypto.timingSafeEqual(expected, actual)
}

// ── Tokens ───────────────────────────────────────────────────────────────────

export function randomToken() {
  return crypto.randomBytes(32).toString('base64url')
}
