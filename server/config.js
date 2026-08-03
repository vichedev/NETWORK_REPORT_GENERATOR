import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const ROOT_DIR = path.resolve(__dirname, '..')

// Todo el estado persistente vive aquí. En Docker se monta como volumen.
export const DATA_DIR = process.env.NRG_DATA_DIR
  ? path.resolve(process.env.NRG_DATA_DIR)
  : path.join(ROOT_DIR, 'data')

export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
export const DB_FILE = path.join(DATA_DIR, 'report.db')
export const SECRET_FILE = path.join(DATA_DIR, '.secret')
export const DIST_DIR = path.join(ROOT_DIR, 'dist')

export const PORT = Number(process.env.PORT) || 3001

// Duración de la sesión de login (30 días)
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export const SESSION_COOKIE = 'nrg_session'

// Las imágenes viajan como data URL dentro del JSON, por eso el límite alto.
export const JSON_LIMIT = '120mb'

export function ensureDirs() {
  for (const dir of [DATA_DIR, UPLOADS_DIR]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}
