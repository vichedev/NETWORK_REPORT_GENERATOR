import { useApp } from '../context/AppContext'

export default function ConfigSection() {
  const { empresa, setEmpresa, generadoPor, setGeneradoPor } = useApp()

  // --- CAMBIO AQUÍ: Ahora verificamos la KEY de GROQ ---
  const apiKeyOk = !!import.meta.env.VITE_GROQ_API_KEY

  return (
    <section className="bg-slate-900/80 border border-blue-900/30 rounded-2xl p-6 mb-6">
      <h2 className="text-xs font-bold text-blue-500 tracking-[0.14em] mb-5">
        ① CONFIGURACIÓN GENERAL
      </h2>

      {/* Status de la API Key (GROQ) */}
      <div className={`inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-5 border ${
        apiKeyOk
          ? 'bg-green-950/40 border-green-800/40 text-green-400'
          : 'bg-red-950/40 border-red-800/40 text-red-400'
      }`}>
        <span>{apiKeyOk ? '🟢' : '🔴'}</span>
        {apiKeyOk
          ? 'Groq API Key (Llama 3.2 Vision) cargada correctamente'
          : 'Falta VITE_GROQ_API_KEY en tu .env — reinicia el servidor tras agregarla'}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Empresa */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 tracking-widest mb-1.5">
            EMPRESA / CLIENTE <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={empresa}
            onChange={e => setEmpresa(e.target.value)}
            placeholder="Ej: EMPRESA S.A."
            className="w-full px-3 py-2.5 bg-slate-950/80 border border-blue-900/50 rounded-lg
                       text-slate-300 text-sm placeholder-slate-600
                       focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Generado por */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 tracking-widest mb-1.5">
            GENERADO POR
          </label>
          <input
            type="text"
            value={generadoPor}
            onChange={e => setGeneradoPor(e.target.value)}
            placeholder="MAAT"
            className="w-full px-3 py-2.5 bg-slate-950/80 border border-blue-900/50 rounded-lg
                       text-slate-300 text-sm placeholder-slate-600
                       focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>
    </section>
  )
}