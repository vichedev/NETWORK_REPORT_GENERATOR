import { useRef } from 'react'
import { useApp } from '../context/AppContext'
import { reportsApi } from '../lib/api'
import { prepararImagen } from '../lib/imagePrep'
import { buildReportFiles } from '../lib/exportReport'
import { resolvePeriod, deriveOverallPeriod } from '../lib/periods'
import StepIndicator from '../components/StepIndicator'
import ConfigSection from '../components/ConfigSection'
import DropZone from '../components/DropZone'
import ImageDetailCard from '../components/ImageDetailCard'
import { Alert, Spinner } from '../components/ui'

export default function FormPage() {
  const {
    empresa, empresaId, generadoPor,
    images, addImages,
    activeKey, catalogLoading, reloadNodos,
    setStep, setLoadMsg, setProgress, setError, setResult, error,
  } = useApp()

  const addMoreRef = useRef(null)

  const currentStep = (() => {
    if (!empresaId) return 1
    if (images.length === 0) return 2
    if (!images.every(i => i.titulo.trim() && i.nodeName.trim())) return 3
    return 4
  })()

  async function handleGenerate() {
    if (!empresaId) return setError('⚠️  Selecciona la empresa del informe.')
    if (!images.length) return setError('⚠️  Sube al menos una imagen.')
    if (!activeKey) return setError('⚠️  No hay ninguna API key de IA activa. Configúrala en Ajustes.')

    if (images.some(i => !i.titulo.trim() || !i.nodeName.trim())) {
      return setError('⚠️  Completa el título y el nodo en todas las imágenes.')
    }

    setError('')
    setProgress(null)
    setStep('loading')

    try {
      // El período legible se calcula en el navegador (usa la zona horaria local).
      const enriched = images.map(img => ({
        ...img,
        periodo: resolvePeriod(img.periodoType, img.periodoFrom, img.periodoTo, img.periodoManual),
      }))
      const overallPeriod = deriveOverallPeriod(images)

      setLoadMsg('📦 Preparando las imágenes…')
      const payloadImages = await Promise.all(enriched.map(async img => {
        const { dataUrl, mime } = await prepararImagen(img.file)
        return {
          nodoId: img.nodoId || null,
          nodeName: img.nodeName,
          titulo: img.titulo,
          interfaz: img.interfaz,
          ip: img.ip,
          periodo: img.periodo,
          tipoGrafica: img.tipoGrafica,
          descripcion: img.descripcion,
          mime,
          dataUrl,
        }
      }))

      setLoadMsg(`⚡ Analizando ${images.length} gráfica${images.length !== 1 ? 's' : ''} con ${activeKey.model}…`)

      // El backend va informando del progreso mientras trabaja.
      const { analysis, reportId } = await reportsApi.generate(
        { empresaId, generadoPor, periodo: overallPeriod, images: payloadImages },
        (evento) => {
          setProgress(evento)
          setLoadMsg(evento.message)
        },
      )

      setProgress(null)
      const files = await buildReportFiles({
        empresa: empresa?.nombre || '',
        generadoPor,
        periodo: overallPeriod,
        analysis,
        imgFiles: enriched,
        onProgress: setLoadMsg,
      })

      // El backend puede haber dado de alta nodos nuevos: refresca el catálogo.
      reloadNodos().catch(() => {})

      setResult({ ...files, analysis, reportId })
      setStep('done')
    } catch (e) {
      console.error('Error en generación:', e)
      setError(e.message || 'Error inesperado al generar el informe.')
      setProgress(null)
      setStep('form')
    }
  }

  if (catalogLoading) return <Spinner label="Cargando datos…" />

  return (
    <div className="animate-fade-in">
      <StepIndicator currentStep={currentStep} />
      <ConfigSection />
      <DropZone />

      {images.length > 0 && (
        <section className="bg-slate-900/80 border border-teal-900/30 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-bold text-teal-400 tracking-[0.14em]">
              ③ DETALLA CADA IMAGEN ({images.length})
            </h2>
          </div>

          {images.map((img, i) => (
            <ImageDetailCard key={img.id} img={img} index={i} total={images.length} />
          ))}

          <button
            onClick={() => addMoreRef.current?.click()}
            className="w-full py-3 border border-dashed border-blue-800/50 rounded-xl text-slate-500 hover:text-blue-400 text-sm font-semibold mt-2"
          >
            + Agregar más imágenes
          </button>
          <input ref={addMoreRef} type="file" multiple accept="image/*" className="hidden"
            onChange={e => addImages(e.target.files)} />
        </section>
      )}

      <Alert kind="error">{error}</Alert>

      {/* Con planes gratuitos cada gráfica puede costar ~1 minuto de espera. */}
      {images.length >= 3 && (
        <Alert kind="warn">
          <strong>{images.length} gráficas</strong> son {images.length + 1} llamadas a la IA.
          Si tu plan tiene un límite bajo de tokens por minuto (el gratuito de Groq
          son 8.000, y cada gráfica ronda los 7.000), el sistema tendrá que esperar
          entre una y otra: cuenta con unos <strong>{images.length} minutos</strong>.
          Verás el progreso en pantalla y no debes cerrar la pestaña.
        </Alert>
      )}

      <button
        onClick={handleGenerate}
        className="w-full py-5 bg-gradient-to-r from-blue-700 to-blue-500 text-white font-bold text-base tracking-widest rounded-xl shadow-lg transition-all active:scale-[0.99]"
      >
        ④ ANALIZAR CON IA Y GENERAR INFORMES →
      </button>
    </div>
  )
}
