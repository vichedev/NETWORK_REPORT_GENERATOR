export const PERIOD_OPTIONS = [
  { value: 'today',  label: 'Hoy',             icon: '☀️' },
  { value: 'week',   label: 'Esta semana',      icon: '📆' },
  { value: 'month',  label: 'Este mes',         icon: '🗓️' },
  { value: 'custom', label: 'Rango de fechas',  icon: '📅' },
  { value: 'manual', label: 'Texto libre',      icon: '✏️' },
]

export const TIPO_GRAFICA_OPTIONS = [
  'Tráfico general (avg)',
  'Tráfico picos máximos (max)',
  'Comparativa avg + max',
  'Tráfico histórico mensual',
  'Tráfico del día actual',
  'Tráfico semanal',
  'Tráfico de entrada (Rx)',
  'Tráfico de salida (Tx)',
]

/**
 * Converts a period type + dates into a human-readable Spanish string.
 */
export function resolvePeriod(type, from, to, manual) {
  const fmt = (d) =>
    d
      ? new Date(d + 'T00:00:00').toLocaleDateString('es-EC', {
          day: '2-digit', month: '2-digit', year: 'numeric',
        })
      : '?'

  const today = new Date().toLocaleDateString('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  switch (type) {
    case 'today':
      return `Hoy — ${today}`
    case 'week': {
      const t = new Date()
      const mon = new Date(t)
      mon.setDate(t.getDate() - ((t.getDay() || 7) - 1))
      return `${mon.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })} — ${today}`
    }
    case 'month': {
      const t = new Date()
      const mm = String(t.getMonth() + 1).padStart(2, '0')
      return `01/${mm}/${t.getFullYear()} — ${today}`
    }
    case 'custom':
      return `${fmt(from)} — ${fmt(to)}`
    case 'manual':
      return manual || 'Sin período'
    default:
      return '—'
  }
}

/**
 * Derives the overall report period from all images.
 */
export function deriveOverallPeriod(images) {
  if (!images.length) {
    return new Date().toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })
  }
  const periods = images.map(i =>
    resolvePeriod(i.periodoType, i.periodoFrom, i.periodoTo, i.periodoManual)
  )
  if (images.length === 1) return periods[0]
  const first = periods[0].split('—')[0].trim()
  const last = periods[periods.length - 1].split('—').pop().trim()
  return `${first} — ${last}`
}
