import { useApp } from '../context/AppContext'
import { downloadBlob } from '../lib/exportReport'
import AnalysisPreview from '../components/AnalysisPreview'
import { Button } from '../components/ui'

export default function DonePage() {
  const { empresa, images, result, resetApp, setPage } = useApp()

  const empresaNombre = empresa?.nombre || 'cliente'

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="bg-green-950/30 border border-green-800/40 rounded-2xl p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-green-400 tracking-widest mb-2">
          INFORME GENERADO
        </h2>
        <p className="text-green-800 text-sm mb-2">
          {images.length} gráfica{images.length !== 1 ? 's' : ''} analizada{images.length !== 1 ? 's' : ''} por IA · Formatos Word y PDF listos
        </p>
        <p className="text-green-900 text-xs mb-7">
          🗂️ Archivado en el historial de <strong>{empresaNombre}</strong>
          {result?.reportId ? ` (informe #${result.reportId})` : ''}
        </p>

        <div className="flex gap-3 justify-center flex-wrap">
          <Button
            onClick={() => downloadBlob(result?.docx, empresaNombre, 'docx')}
            className="px-8 py-3.5 bg-gradient-to-r from-blue-800 to-blue-600 shadow-lg shadow-blue-900/40"
          >
            ⬇️  DESCARGAR .DOCX
          </Button>

          <Button
            onClick={() => downloadBlob(result?.pdf, empresaNombre, 'pdf')}
            className="px-8 py-3.5 bg-gradient-to-r from-red-800 to-red-600 shadow-lg shadow-red-900/40"
          >
            ⬇️  DESCARGAR .PDF
          </Button>

          <Button variant="ghost" className="px-6 py-3.5" onClick={resetApp}>
            🔄  Nuevo informe
          </Button>

          <Button variant="ghost" className="px-6 py-3.5" onClick={() => { resetApp(); setPage('historial') }}>
            🗂️  Ver historial
          </Button>
        </div>
      </div>

      <AnalysisPreview analysis={result?.analysis} />
    </div>
  )
}
