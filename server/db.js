import Database from 'better-sqlite3'
import { DB_FILE, ensureDirs } from './config.js'

ensureDirs()

export const db = new Database(DB_FILE)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    -- 1 mientras el usuario siga con la contraseña que le asignaron
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    provider   TEXT NOT NULL,
    label      TEXT NOT NULL,
    model      TEXT NOT NULL,
    key_enc    TEXT NOT NULL,
    key_last4  TEXT NOT NULL,
    is_active  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS empresas (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre     TEXT NOT NULL UNIQUE,
    contacto   TEXT NOT NULL DEFAULT '',
    notas      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS nodos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre     TEXT NOT NULL,
    interfaz   TEXT NOT NULL DEFAULT '',
    ip         TEXT NOT NULL DEFAULT '',
    notas      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (empresa_id, nombre)
  );

  CREATE TABLE IF NOT EXISTS reports (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id    INTEGER REFERENCES empresas(id) ON DELETE SET NULL,
    empresa_nombre TEXT NOT NULL,
    generado_por  TEXT NOT NULL DEFAULT '',
    periodo       TEXT NOT NULL DEFAULT '',
    provider      TEXT NOT NULL DEFAULT '',
    model         TEXT NOT NULL DEFAULT '',
    analysis_json TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS report_images (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id     INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    nodo_id       INTEGER REFERENCES nodos(id) ON DELETE SET NULL,
    nodo_nombre   TEXT NOT NULL DEFAULT '',
    titulo        TEXT NOT NULL DEFAULT '',
    interfaz      TEXT NOT NULL DEFAULT '',
    ip            TEXT NOT NULL DEFAULT '',
    periodo       TEXT NOT NULL DEFAULT '',
    tipo_grafica  TEXT NOT NULL DEFAULT '',
    descripcion   TEXT NOT NULL DEFAULT '',
    filename      TEXT NOT NULL,
    mime          TEXT NOT NULL DEFAULT 'image/png',
    orden         INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_reports_empresa   ON reports(empresa_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_images_report     ON report_images(report_id, orden);
  CREATE INDEX IF NOT EXISTS idx_images_nodo       ON report_images(nodo_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires  ON sessions(expires_at);
`)

// ── Migraciones para bases de datos creadas con versiones anteriores ─────────

function addColumnIfMissing(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column)
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

addColumnIfMissing('users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0')

/** Borra sesiones caducadas. Se llama al arrancar y en cada login. */
export function purgeExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now())
}

purgeExpiredSessions()
