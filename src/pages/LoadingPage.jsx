import { useApp } from '../context/AppContext'

export default function LoadingPage() {
  const { loadMsg } = useApp()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-fade-in">
      {/* Spinner */}
      <div className="text-6xl mb-8 animate-spin">⚡</div>

      <h2 className="text-2xl font-bold text-blue-400 tracking-widest mb-3">
        PROCESANDO TU INFORME
      </h2>

      <p className="text-slate-500 text-sm mb-10">{loadMsg}</p>

      {/* Pulse dots */}
      <div className="flex gap-2.5">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-blue-600"
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
