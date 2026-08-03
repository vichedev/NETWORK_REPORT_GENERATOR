import express from 'express'
import cookieParser from 'cookie-parser'
import fs from 'node:fs'
import path from 'node:path'
import { PORT, JSON_LIMIT, DIST_DIR, DATA_DIR, ensureDirs } from './config.js'
import { getMasterKey } from './crypto.js'
import { authRouter, requireAuth, seedDefaultUser } from './auth.js'
import { usersRouter } from './routes/users.js'
import { settingsRouter } from './routes/settings.js'
import { empresasRouter } from './routes/empresas.js'
import { reportsRouter } from './routes/reports.js'

ensureDirs()
getMasterKey() // genera data/.secret en el primer arranque

const seeded = seedDefaultUser()

const app = express()

app.disable('x-powered-by')
app.set('trust proxy', true)
app.use(express.json({ limit: JSON_LIMIT }))
app.use(cookieParser())

// ── API ─────────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)

// Todo lo demás exige sesión iniciada.
app.use('/api/users', requireAuth, usersRouter)
app.use('/api/settings', requireAuth, settingsRouter)
app.use('/api/empresas', requireAuth, empresasRouter)
app.use('/api/reports', requireAuth, reportsRouter)

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint no encontrado.' }))

// Manejador de errores: responde JSON en vez del HTML por defecto de Express.
// El 4º argumento es obligatorio para que Express lo reconozca como tal.
app.use((err, req, res, next) => {
  console.error('[error]', err)
  if (res.headersSent) return
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Las imágenes superan el tamaño máximo permitido.' })
  }
  res.status(500).json({ error: 'Error interno del servidor.' })
})

// ── Frontend compilado (producción) ─────────────────────────────────────────

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  app.get(/.*/, (req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`Network Report Generator escuchando en http://localhost:${PORT}`)
  console.log(`Datos persistentes en: ${DATA_DIR}`)

  if (seeded) {
    console.log('')
    console.log('  ┌───────────────────────────────────────────────┐')
    console.log('  │  Usuario por defecto creado                   │')
    console.log(`  │    usuario:    ${seeded.username.padEnd(31)}│`)
    console.log(`  │    contraseña: ${seeded.password.padEnd(31)}│`)
    console.log('  │  Cámbialos en Ajustes → Mi cuenta.            │')
    console.log('  └───────────────────────────────────────────────┘')
    console.log('')
  }

  if (!fs.existsSync(DIST_DIR)) {
    console.log('Sin build de frontend: usa `npm run dev` para levantar Vite en paralelo.')
  }
})
