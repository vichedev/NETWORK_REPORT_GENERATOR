import { useApp } from '../context/AppContext'

export default function Header() {
  const { images, page } = useApp()

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 border-b border-blue-900/40 backdrop-blur-md">
      <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-4">
        {/* Logo */}
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-400 flex items-center justify-center text-lg shadow-lg shadow-blue-500/30 shrink-0">
          📡
        </div>

        {/* Title */}
        <div>
          <h1 className="font-bold text-base text-blue-400 tracking-widest leading-none">
            NETWORK REPORT GENERATOR
          </h1>
          <p className="text-[10px] text-blue-900 tracking-[0.2em] mt-0.5">
            ANÁLISIS DE TRÁFICO · POWERED BY ING. VICENTE
          </p>
        </div>

        {/* Image counter badge */}
        {images.length > 0 && page === 'form' && (
          <div className="ml-auto bg-blue-900/40 border border-blue-800/50 text-blue-400 text-xs font-semibold px-3 py-1 rounded-full tracking-wide">
            {images.length} imagen{images.length !== 1 ? 'es' : ''} cargada{images.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </header>
  )
}
