import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'

const TABS = [
  { key: 'generator', label: 'Generador', icon: '⚡' },
  { key: 'empresas',  label: 'Empresas',  icon: '🏢' },
  { key: 'historial', label: 'Historial', icon: '🗂️' },
  { key: 'ajustes',   label: 'Ajustes',   icon: '⚙️' },
]

export default function Header() {
  const { page, setPage, images, step } = useApp()
  const { user, logout } = useAuth()

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 border-b border-blue-900/40 backdrop-blur-md">
      {/* Aviso mientras la cuenta siga con la contraseña que se le asignó */}
      {user?.mustChangePassword && (
        <button
          onClick={() => setPage('ajustes')}
          className="w-full bg-amber-950/60 border-b border-amber-800/50 text-amber-300
                     text-xs py-2 px-5 text-center hover:bg-amber-900/50 transition-colors"
        >
          ⚠️ Estás usando la contraseña por defecto.
          <span className="underline underline-offset-2 font-semibold ml-1.5">
            Cámbiala en Ajustes →
          </span>
        </button>
      )}

      <div className="max-w-5xl mx-auto px-5">
        {/* Fila 1: marca + usuario */}
        <div className="h-16 flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-400 flex items-center justify-center text-lg shadow-lg shadow-blue-500/30 shrink-0">
            📡
          </div>

          <div className="min-w-0">
            <h1 className="font-bold text-sm sm:text-base text-blue-400 tracking-widest leading-none truncate">
              NETWORK REPORT GENERATOR
            </h1>
            <p className="text-[10px] text-blue-900 tracking-[0.2em] mt-0.5">
              ANÁLISIS DE TRÁFICO · POWERED BY ING. VICENTE
            </p>
          </div>

          <div className="ml-auto flex items-center gap-3 shrink-0">
            {images.length > 0 && page === 'generator' && step === 'form' && (
              <span className="hidden sm:inline bg-blue-900/40 border border-blue-800/50 text-blue-400 text-xs font-semibold px-3 py-1 rounded-full tracking-wide">
                {images.length} imagen{images.length !== 1 ? 'es' : ''}
              </span>
            )}
            <span className="hidden sm:inline text-xs text-slate-500">
              👤 {user?.username}
            </span>
            <button
              onClick={logout}
              className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-red-300
                         bg-slate-800/60 hover:bg-red-900/30 border border-slate-700/60
                         hover:border-red-900/50 rounded-lg transition-colors"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Fila 2: navegación */}
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setPage(tab.key)}
              className={[
                'px-4 py-2.5 text-xs font-bold tracking-wider whitespace-nowrap border-b-2 transition-colors',
                page === tab.key
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300',
              ].join(' ')}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
