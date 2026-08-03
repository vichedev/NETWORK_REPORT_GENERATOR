/**
 * Primitivas de UI compartidas, para que todas las pantallas nuevas
 * mantengan el mismo lenguaje visual que el generador original.
 */

export const inputCls = `
  w-full px-3 py-2.5 bg-slate-950/80 border border-blue-900/40 rounded-lg
  text-slate-300 text-sm placeholder-slate-600
  focus:outline-none focus:border-blue-500 transition-colors
`

export const labelCls = 'block text-[10px] font-bold text-slate-500 tracking-widest mb-1.5'

export function Field({ label, required, hint, children }) {
  return (
    <div>
      {label && (
        <label className={labelCls}>
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="text-[11px] text-slate-600 mt-1.5">{hint}</p>}
    </div>
  )
}

export function Section({ title, action, children, className = '' }) {
  return (
    <section className={`bg-slate-900/80 border border-blue-900/30 rounded-2xl p-6 mb-6 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-5">
          {title && <h2 className="text-xs font-bold text-blue-500 tracking-[0.14em]">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

const VARIANTS = {
  primary: 'bg-gradient-to-r from-blue-700 to-blue-500 text-white hover:from-blue-600 hover:to-blue-400',
  ghost:   'bg-slate-800/70 hover:bg-slate-700/70 border border-slate-700/60 text-blue-300',
  danger:  'bg-red-900/25 hover:bg-red-900/50 border border-red-900/50 text-red-300',
  success: 'bg-green-900/25 hover:bg-green-900/50 border border-green-800/50 text-green-300',
}

export function Button({ variant = 'primary', className = '', disabled, children, ...props }) {
  return (
    <button
      disabled={disabled}
      className={`px-4 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all
                  disabled:opacity-40 disabled:cursor-not-allowed
                  ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null
  const styles = {
    error:   'bg-red-950/40 border-red-800/50 text-red-300',
    success: 'bg-green-950/30 border-green-800/50 text-green-300',
    info:    'bg-blue-950/30 border-blue-800/40 text-blue-300',
    warn:    'bg-amber-950/30 border-amber-800/40 text-amber-300',
  }[kind]
  return (
    <div className={`border rounded-xl px-4 py-3 mb-4 text-sm ${styles}`}>
      {children}
    </div>
  )
}

export function EmptyState({ icon = '📭', title, children }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-slate-400 font-semibold text-sm mb-1">{title}</p>
      {children && <p className="text-slate-600 text-xs max-w-md mx-auto">{children}</p>}
    </div>
  )
}

export function Badge({ children, tone = 'blue' }) {
  const tones = {
    blue:  'bg-blue-900/40 border-blue-800/50 text-blue-300',
    green: 'bg-green-900/30 border-green-800/50 text-green-300',
    slate: 'bg-slate-800/60 border-slate-700/50 text-slate-400',
  }[tone]
  return (
    <span className={`inline-flex items-center gap-1 border text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${tones}`}>
      {children}
    </span>
  )
}

export function Spinner({ label = 'Cargando…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-slate-500 text-sm">
      <span className="inline-block w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
      {label}
    </div>
  )
}

/** Formatea las fechas 'YYYY-MM-DD HH:MM:SS' que devuelve SQLite (en UTC). */
export function formatDate(value) {
  if (!value) return '—'
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
