import { useApp } from '../context/AppContext'
import AnalysisPreview from '../components/AnalysisPreview'

export default function DonePage() {
  const { empresa, images, result, resetApp } = useApp()

  // Función genérica para descargar archivos
  function downloadFile(blob, extension) {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().split('T')[0]
    a.href = url
    a.download = `Informe_${empresa.replace(/\s+/g, '_')}_${date}.${extension}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="bg-green-950/30 border border-green-800/40 rounded-2xl p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-green-400 tracking-widest mb-2">
          INFORME GENERADO
        </h2>
        <p className="text-green-800 text-sm mb-7">
          {images.length} gráfica{images.length !== 1 ? 's' : ''} analizada{images.length !== 1 ? 's' : ''} por IA · Formatos Word y PDF listos
        </p>

        <div className="flex gap-3 justify-center flex-wrap">
          {/* Botón Word */}
          <button
            onClick={() => downloadFile(result.docx, 'docx')}
            className="px-8 py-3.5 bg-gradient-to-r from-blue-800 to-blue-600
                       hover:from-blue-700 hover:to-blue-500
                       text-white font-bold text-sm tracking-widest rounded-xl
                       shadow-lg shadow-blue-900/40 transition-all duration-200"
          >
            ⬇️  DESCARGAR .DOCX
          </button>

          {/* Botón PDF (NUEVO) */}
          <button
            onClick={() => downloadFile(result.pdf, 'pdf')}
            className="px-8 py-3.5 bg-gradient-to-r from-red-800 to-red-600
                       hover:from-red-700 hover:to-red-500
                       text-white font-bold text-sm tracking-widest rounded-xl
                       shadow-lg shadow-red-900/40 transition-all duration-200"
          >
            ⬇️  DESCARGAR .PDF
          </button>

          <button
            onClick={resetApp}
            className="px-6 py-3.5 bg-slate-800/80 hover:bg-slate-700/80
                       border border-slate-700/50 text-blue-400
                       font-semibold text-sm tracking-wide rounded-xl transition-all"
          >
            🔄  Nuevo informe
          </button>
        </div>
      </div>

      <AnalysisPreview analysis={result?.analysis} />
    </div>
  )
}