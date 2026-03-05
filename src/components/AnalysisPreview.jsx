export default function AnalysisPreview({ analysis }) {
  if (!analysis) return null

  return (
    <div className="bg-slate-900/80 border border-blue-900/30 rounded-2xl p-6">
      <h2 className="text-xs font-bold text-blue-400 tracking-[0.14em] mb-5">
        📋 VISTA PREVIA DEL ANÁLISIS IA
      </h2>

      {/* Executive summary */}
      <div className="bg-slate-950/60 rounded-xl p-4 mb-4">
        <p className="text-[10px] font-bold text-slate-600 tracking-widest mb-2">
          RESUMEN EJECUTIVO
        </p>
        <p className="text-sm text-slate-300 leading-relaxed">{analysis.resumen}</p>
      </div>

      {/* Per-section cards */}
      {(analysis.sections || []).map((sec, i) => (
        <div
          key={i}
          className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-4 mb-3"
        >
          {/* Section header */}
          <div className="flex flex-wrap items-baseline gap-2 mb-3">
            <span className="text-xs font-bold text-blue-400">📡 {sec.nodo}</span>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-400">{sec.titulo}</span>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-600">{sec.periodo}</span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {[
              ['Avg Entrada', sec.stats?.avg_rx],
              ['Avg Salida',  sec.stats?.avg_tx],
              ['Máx Entrada', sec.stats?.max_rx],
              ['Máx Salida',  sec.stats?.max_tx],
            ].map(([label, value]) => (
              <div
                key={label}
                className="bg-slate-900/70 rounded-lg p-2.5 text-center"
              >
                <p className="text-[10px] text-slate-600 tracking-wide mb-1">{label}</p>
                <p className="text-sm font-bold text-blue-300">{value || 'N/D'}</p>
              </div>
            ))}
          </div>

          {/* Analysis text */}
          <p className="text-xs text-slate-400 leading-relaxed">{sec.analisis}</p>

          {/* Observations */}
          {sec.observaciones?.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {sec.observaciones.map((o, oi) => (
                <li key={oi} className="text-xs text-slate-500 flex gap-2">
                  <span className="text-blue-700 shrink-0">•</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {/* Conclusions */}
      {analysis.conclusiones?.length > 0 && (
        <div className="bg-slate-950/60 rounded-xl p-4">
          <p className="text-[10px] font-bold text-slate-600 tracking-widest mb-3">
            CONCLUSIONES GENERALES
          </p>
          <ol className="flex flex-col gap-2">
            {analysis.conclusiones.map((c, i) => (
              <li key={i} className="flex gap-3 text-xs text-slate-400 leading-relaxed">
                <span className="text-blue-600 font-bold shrink-0">{i + 1}.</span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
