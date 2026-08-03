import { useEffect, useMemo, useReducer } from 'react'
import { useApp } from '../context/AppContext'

/**
 * Cuenta atrás local mientras el backend espera a que se libere el límite.
 * Trabaja sobre un instante final fijo para que no se desfase si el navegador
 * ralentiza los temporizadores en una pestaña en segundo plano.
 */
function useCountdown(seconds, key) {
  const finalEn = useMemo(
    () => (seconds ? Date.now() + seconds * 1000 : 0),
    // El key cambia en cada nueva espera y reinicia la cuenta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seconds, key],
  )

  const [, tick] = useReducer(n => n + 1, 0)

  useEffect(() => {
    if (!finalEn) return
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [finalEn])

  if (!finalEn) return 0
  return Math.max(0, Math.ceil((finalEn - Date.now()) / 1000))
}

export default function LoadingPage() {
  const { loadMsg, progress } = useApp()

  const esperando = progress?.stage === 'esperando'
  // La clave reinicia la cuenta atrás en cada nueva espera.
  const restante = useCountdown(esperando ? progress.seconds : 0, `${progress?.current}-${progress?.attempt}`)

  const total = progress?.total || 0
  const hechas = progress ? Math.max(0, progress.current - (progress.stage === 'analizando' ? 1 : 0)) : 0
  const porcentaje = total ? Math.round((hechas / total) * 100) : 0

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-fade-in">
      <div className={`text-6xl mb-8 ${esperando ? 'animate-pulse' : 'animate-spin'}`}>
        {esperando ? '⏳' : '⚡'}
      </div>

      <h2 className="text-2xl font-bold text-blue-400 tracking-widest mb-3">
        PROCESANDO TU INFORME
      </h2>

      <p className="text-slate-400 text-sm mb-2 max-w-lg">
        {progress?.message || loadMsg}
      </p>

      {/* Barra de progreso por gráfica */}
      {total > 0 && (
        <div className="w-full max-w-md mb-6">
          <div className="h-2 bg-slate-800/80 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${porcentaje}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-600 mt-2 tracking-wide">
            {hechas} de {total} gráficas analizadas
          </p>
        </div>
      )}

      {/* Aviso de espera por límite del proveedor */}
      {esperando && (
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl px-5 py-4 mb-6 max-w-lg">
          <p className="text-amber-300 text-sm font-semibold mb-1">
            Esperando {restante}s por el límite del proveedor
          </p>
          <p className="text-amber-600/90 text-xs leading-relaxed">
            Tu plan permite pocos tokens por minuto y cada gráfica consume varios
            miles. El informe continuará solo — no cierres esta pestaña.
            {progress.attempt > 1 && ` (intento ${progress.attempt} de ${progress.maxAttempts})`}
          </p>
        </div>
      )}

      {/* Puntos de actividad */}
      <div className="flex gap-2.5">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full ${esperando ? 'bg-amber-700' : 'bg-blue-600'}`}
            style={{ animation: `pulse-dot 1.4s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
      `}</style>
    </div>
  )
}
