/**
 * Cliente HTTP del backend. Todas las llamadas van con cookie de sesión.
 */

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let data = null
  const text = await res.text()
  if (text) {
    try { data = JSON.parse(text) } catch { data = null }
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `Error ${res.status}`, res.status)
  }
  return data
}

export const api = {
  get:    (path) => request('GET', path),
  post:   (path, body) => request('POST', path, body ?? {}),
  patch:  (path, body) => request('PATCH', path, body ?? {}),
  delete: (path) => request('DELETE', path),
}

// ── Auth (cuenta propia) ────────────────────────────────────────────────────
export const authApi = {
  status:   () => api.get('/auth/status'),
  me:       () => api.get('/auth/me'),
  login:    (username, password) => api.post('/auth/login', { username, password }),
  logout:   () => api.post('/auth/logout'),
  changeUsername: (username) => api.patch('/auth/me', { username }),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/password', { currentPassword, newPassword }),
}

// ── Usuarios del sistema ────────────────────────────────────────────────────
export const usersApi = {
  list:          () => api.get('/users'),
  create:        (username, password) => api.post('/users', { username, password }),
  rename:        (id, username) => api.patch(`/users/${id}`, { username }),
  resetPassword: (id, password) => api.post(`/users/${id}/password`, { password }),
  remove:        (id) => api.delete(`/users/${id}`),
}

// ── Ajustes / API keys ──────────────────────────────────────────────────────
export const settingsApi = {
  providers: () => api.get('/settings/providers'),
  listKeys:  () => api.get('/settings/keys'),
  createKey: (payload) => api.post('/settings/keys', payload),
  updateKey: (id, payload) => api.patch(`/settings/keys/${id}`, payload),
  activate:  (id) => api.post(`/settings/keys/${id}/activate`),
  test:      (id) => api.post(`/settings/keys/${id}/test`),
  deleteKey: (id) => api.delete(`/settings/keys/${id}`),
}

// ── Empresas y nodos ────────────────────────────────────────────────────────
export const empresasApi = {
  list:         () => api.get('/empresas'),
  get:          (id) => api.get(`/empresas/${id}`),
  create:       (payload) => api.post('/empresas', payload),
  update:       (id, payload) => api.patch(`/empresas/${id}`, payload),
  remove:       (id) => api.delete(`/empresas/${id}`),
  listNodos:    (id) => api.get(`/empresas/${id}/nodos`),
  createNodo:   (id, payload) => api.post(`/empresas/${id}/nodos`, payload),
  updateNodo:   (id, nodoId, payload) => api.patch(`/empresas/${id}/nodos/${nodoId}`, payload),
  removeNodo:   (id, nodoId) => api.delete(`/empresas/${id}/nodos/${nodoId}`),
}

// ── Informes ────────────────────────────────────────────────────────────────

/**
 * Genera un informe leyendo el progreso en vivo.
 *
 * El backend responde con un stream de eventos porque el proceso puede tardar
 * minutos: una llamada de visión por gráfica, más las esperas que impongan los
 * límites del proveedor.
 *
 * @param {object} payload
 * @param {(evento: object) => void} onProgress
 * @returns {Promise<{reportId: number, analysis: object}>}
 */
async function generateReport(payload, onProgress) {
  const res = await fetch('/api/reports/generate', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    let message = `Error ${res.status}`
    try { message = (await res.json()).error || message } catch { /* respuesta no JSON */ }
    throw new ApiError(message, res.status)
  }
  if (!res.body) throw new ApiError('Este navegador no soporta respuestas en streaming.', 0)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Los eventos SSE van separados por una línea en blanco.
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks) {
      const linea = chunk.split('\n').find(l => l.startsWith('data:'))
      if (!linea) continue

      let evento
      try { evento = JSON.parse(linea.slice(5).trim()) } catch { continue }

      if (evento.type === 'progress') onProgress?.(evento)
      else if (evento.type === 'done') result = evento
      else if (evento.type === 'error') throw new ApiError(evento.error, 502)
    }
  }

  if (!result) {
    throw new ApiError('La conexión se cortó antes de terminar el informe. Vuelve a intentarlo.', 0)
  }
  return result
}

export const reportsApi = {
  generate: generateReport,
  list:     (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''),
    ).toString()
    return api.get(`/reports${qs ? `?${qs}` : ''}`)
  },
  get:    (id) => api.get(`/reports/${id}`),
  remove: (id) => api.delete(`/reports/${id}`),
}

/** Convierte un File del navegador en data URL para enviarlo al backend. */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error(`No se pudo leer la imagen ${file.name}`))
    reader.readAsDataURL(file)
  })
}

/** Descarga una imagen del historial como File, para reconstruir DOCX/PDF. */
export async function fetchReportImage(url, filename, mime) {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new ApiError('No se pudo descargar la imagen del historial', res.status)
  const blob = await res.blob()
  return new File([blob], filename, { type: mime || blob.type || 'image/png' })
}
