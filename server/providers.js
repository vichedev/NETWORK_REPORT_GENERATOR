import Anthropic from '@anthropic-ai/sdk'

/**
 * Catálogo de proveedores de IA con visión. El frontend lo consume para
 * sugerir modelos en la pantalla de Ajustes.
 *
 * `models` son SUGERENCIAS, no una lista cerrada: los proveedores retiran y
 * añaden modelos con frecuencia (Groq jubiló los Llama-4 Scout/Maverick que
 * usaba la versión anterior de este sistema), así que el campo admite
 * cualquier identificador escrito a mano.
 */
export const PROVIDERS = {
  groq: {
    label: 'Groq',
    docsUrl: 'https://console.groq.com/keys',
    keyPrefix: 'gsk_',
    models: ['qwen/qwen3.6-27b'],
  },
  openai: {
    label: 'OpenAI',
    docsUrl: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
  },
  google: {
    label: 'Google Gemini',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    keyPrefix: '',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  },
  anthropic: {
    label: 'Anthropic Claude',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    keyPrefix: 'sk-ant-',
    models: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'],
  },
}

export function isValidProvider(provider) {
  return Object.hasOwn(PROVIDERS, provider)
}

const OPENAI_COMPATIBLE = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

// ── Reintentos ante límite de peticiones ─────────────────────────────────────

/** Error de rate limit, con los segundos que pide esperar el proveedor. */
class RateLimitError extends Error {
  constructor(message, retryAfterSec) {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfterSec = retryAfterSec
  }
}

const MAX_RETRIES = 5
const MAX_WAIT_SEC = 90

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/** Extrae la espera sugerida de la cabecera retry-after o del propio mensaje. */
function parseRetryAfter(headerValue, message) {
  const fromHeader = Number(headerValue)
  if (Number.isFinite(fromHeader) && fromHeader > 0) return fromHeader

  // Ej: "Please try again in 51.5175s" / "try again in 1m20s"
  const seconds = /try again in\s+(?:(\d+)m)?([\d.]+)s/i.exec(message || '')
  if (seconds) return Number(seconds[1] || 0) * 60 + Number(seconds[2])
  return 20
}

/**
 * Los planes gratuitos de varios proveedores tienen límites de tokens por
 * minuto muy justos, y cada imagen consume miles de tokens. Sin reintentos,
 * un informe de más de una gráfica falla casi siempre.
 *
 * `onWait` permite avisar al usuario de la espera en lugar de dejar la
 * pantalla en blanco durante un minuto.
 */
async function withRetry(fn, label, onWait) {
  let lastError
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (!(err instanceof RateLimitError) || attempt === MAX_RETRIES) break

      const wait = Math.min(err.retryAfterSec + 1, MAX_WAIT_SEC)
      console.warn(`[${label}] límite de peticiones; espera ${wait.toFixed(0)}s (intento ${attempt + 1}/${MAX_RETRIES})`)
      onWait?.({ seconds: wait, attempt: attempt + 1, maxAttempts: MAX_RETRIES })
      await sleep(wait * 1000)
    }
  }
  throw lastError
}

function normalizeMime(mime) {
  const m = String(mime || '').toLowerCase()
  if (m === 'image/jpg') return 'image/jpeg'
  return ALLOWED_MIME.has(m) ? m : 'image/png'
}

/** Algunos modelos devuelven el JSON envuelto en ``` o con texto alrededor. */
function extractJson(raw) {
  const text = String(raw || '').trim()
  try {
    return JSON.parse(text)
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenced) {
      try { return JSON.parse(fenced[1].trim()) } catch { /* sigue abajo */ }
    }
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)) } catch { /* sigue abajo */ }
    }
    throw new Error('El modelo no devolvió un JSON válido.')
  }
}

// ── Esquemas de salida ───────────────────────────────────────────────────────

const STAT_TRIPLE = {
  type: 'object',
  properties: {
    max: { type: 'string' },
    avg: { type: 'string' },
    last: { type: 'string' },
  },
  required: ['max', 'avg', 'last'],
  additionalProperties: false,
}

export const SECTION_SCHEMA = {
  type: 'object',
  properties: {
    desc_imagen: { type: 'string' },
    stats: {
      type: 'object',
      properties: {
        entrada: STAT_TRIPLE,
        salida: STAT_TRIPLE,
        utilizacion: STAT_TRIPLE,
      },
      required: ['entrada', 'salida', 'utilizacion'],
      additionalProperties: false,
    },
    analisis: { type: 'string' },
    observaciones: { type: 'array', items: { type: 'string' } },
    recomendaciones: { type: 'array', items: { type: 'string' } },
  },
  required: ['desc_imagen', 'stats', 'analisis', 'observaciones', 'recomendaciones'],
  additionalProperties: false,
}

export const CLOSING_SCHEMA = {
  type: 'object',
  properties: {
    resumen: { type: 'string' },
    conclusiones: { type: 'array', items: { type: 'string' } },
  },
  required: ['resumen', 'conclusiones'],
  additionalProperties: false,
}

// ── Implementaciones por proveedor ───────────────────────────────────────────

async function callOpenAICompatible({ provider, apiKey, model, prompt, image }) {
  const content = [{ type: 'text', text: prompt }]
  if (image) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${image.mime};base64,${image.base64}` },
    })
  }

  const res = await fetch(OPENAI_COMPATIBLE[provider], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4096,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    let message = res.statusText
    try { message = JSON.parse(body).error?.message || message } catch { /* texto plano */ }

    if (res.status === 429) {
      throw new RateLimitError(
        `${PROVIDERS[provider].label}: ${message}`,
        parseRetryAfter(res.headers.get('retry-after'), message),
      )
    }
    throw new Error(`${PROVIDERS[provider].label}: ${message}`)
  }

  const data = await res.json()

  // Saber cuántos tokens cuesta cada gráfica ayuda a entender los límites.
  if (data.usage) {
    console.log(`[${provider}/${model}] tokens: ${data.usage.prompt_tokens} entrada + ${data.usage.completion_tokens} salida`)
  }

  return extractJson(data.choices?.[0]?.message?.content)
}

async function callGemini({ apiKey, model, prompt, image, schema }) {
  const parts = [{ text: prompt }]
  if (image) {
    parts.push({ inline_data: { mime_type: image.mime, data: image.base64 } })
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        response_mime_type: 'application/json',
        ...(schema ? { response_schema: toGeminiSchema(schema) } : {}),
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    let message = res.statusText
    try { message = JSON.parse(body).error?.message || message } catch { /* texto plano */ }

    if (res.status === 429) {
      throw new RateLimitError(`Google Gemini: ${message}`, parseRetryAfter(res.headers.get('retry-after'), message))
    }
    throw new Error(`Google Gemini: ${message}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') || ''
  if (!text) throw new Error('Google Gemini: respuesta vacía (posible bloqueo por filtros de seguridad).')
  return extractJson(text)
}

/** Gemini usa un subconjunto de JSON Schema y no acepta additionalProperties. */
function toGeminiSchema(node) {
  if (Array.isArray(node)) return node.map(toGeminiSchema)
  if (node && typeof node === 'object') {
    const out = {}
    for (const [key, value] of Object.entries(node)) {
      if (key === 'additionalProperties') continue
      out[key] = toGeminiSchema(value)
    }
    return out
  }
  return node
}

async function callAnthropic({ apiKey, model, prompt, image, schema }) {
  // El SDK ya reintenta 429 y 5xx con backoff exponencial.
  const client = new Anthropic({ apiKey, maxRetries: MAX_RETRIES })

  const content = []
  if (image) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: image.mime, data: image.base64 },
    })
  }
  content.push({ type: 'text', text: prompt })

  let response
  try {
    response = await client.messages.create({
      model,
      max_tokens: 16000,
      output_config: {
        effort: 'low',
        ...(schema ? { format: { type: 'json_schema', schema } } : {}),
      },
      messages: [{ role: 'user', content }],
    })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error('Anthropic: API key inválida.')
    if (err instanceof Anthropic.RateLimitError) throw new Error('Anthropic: límite de peticiones alcanzado, reintenta en unos minutos.')
    if (err instanceof Anthropic.APIError) throw new Error(`Anthropic: ${err.message}`)
    throw err
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('Anthropic rechazó la petición por sus filtros de seguridad.')
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Anthropic: la respuesta se cortó por longitud. Prueba con menos imágenes por informe.')
  }

  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('')
  return extractJson(text)
}

/**
 * Punto de entrada único. Devuelve el objeto JSON ya parseado.
 *
 * @param {object} opts
 * @param {string} opts.provider  clave de PROVIDERS
 * @param {string} opts.apiKey
 * @param {string} opts.model
 * @param {string} opts.prompt
 * @param {{base64: string, mime: string}} [opts.image]
 * @param {object} [opts.schema]  JSON Schema del resultado esperado
 * @param {(info: {seconds: number, attempt: number, maxAttempts: number}) => void} [opts.onWait]
 *        Se llama cuando hay que esperar por el límite de peticiones.
 */
export async function callAI({ provider, apiKey, model, prompt, image, schema, onWait }) {
  if (!isValidProvider(provider)) throw new Error(`Proveedor desconocido: ${provider}`)

  const normalizedImage = image ? { ...image, mime: normalizeMime(image.mime) } : undefined

  return withRetry(() => {
    switch (provider) {
      case 'groq':
      case 'openai':
        return callOpenAICompatible({ provider, apiKey, model, prompt, image: normalizedImage })
      case 'google':
        return callGemini({ apiKey, model, prompt, image: normalizedImage, schema })
      case 'anthropic':
        return callAnthropic({ apiKey, model, prompt, image: normalizedImage, schema })
      default:
        throw new Error(`Proveedor no implementado: ${provider}`)
    }
  }, `${provider}/${model}`, onWait)
}

/** Llamada mínima de texto para validar que una API key funciona. */
export async function testCredentials({ provider, apiKey, model }) {
  const prompt = 'Responde exclusivamente con este JSON: {"ok": true}'
  const schema = {
    type: 'object',
    properties: { ok: { type: 'boolean' } },
    required: ['ok'],
    additionalProperties: false,
  }
  const result = await callAI({ provider, apiKey, model, prompt, schema })
  if (!result || typeof result !== 'object') throw new Error('Respuesta inesperada del proveedor.')
  return true
}
