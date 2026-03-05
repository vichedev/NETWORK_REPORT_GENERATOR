import { useRef } from 'react'
import { useApp } from '../context/AppContext'
import { analyzeImages } from '../lib/aiAnalysis'
import { buildDocx } from '../lib/docxBuilder'
import { resolvePeriod, deriveOverallPeriod } from '../lib/periods'
import { pdf } from '@react-pdf/renderer' // Importamos la herramienta PDF
import { ReportPDF } from '../lib/pdfBuilder' // Importamos el componente que creamos antes
import StepIndicator from '../components/StepIndicator'
import ConfigSection from '../components/ConfigSection'
import DropZone from '../components/DropZone'
import ImageDetailCard from '../components/ImageDetailCard'

export default function FormPage() {
  const {
    empresa, generadoPor,
    images, addImages,
    setPage, setLoadMsg, setError, setResult, error,
  } = useApp()

  const addMoreRef = useRef(null)

  const currentStep = (() => {
    if (!empresa) return 1
    if (images.length === 0) return 2
    const allFilled = images.every(i => i.titulo.trim() && i.nodeName.trim())
    if (!allFilled) return 3
    return 4
  })()

  async function handleGenerate() {
    if (!empresa.trim()) return setError('⚠️  Ingresa el nombre de la empresa.')
    if (!images.length)  return setError('⚠️  Sube al menos una imagen.')

    const incomplete = images.find(i => !i.titulo.trim() || !i.nodeName.trim())
    if (incomplete) return setError('⚠️  Completa el título y nombre del nodo en todas las imágenes.')

    if (!import.meta.env.VITE_GROQ_API_KEY) {
      return setError('⚠️  Falta VITE_GROQ_API_KEY en el archivo .env.')
    }

    setError('')
    setPage('loading')

    try {
      const imgFiles = images.map(img => ({
        ...img,
        periodo: resolvePeriod(img.periodoType, img.periodoFrom, img.periodoTo, img.periodoManual),
      }))

      // 1. Análisis de IA
      setLoadMsg('⚡ Analizando gráficas con Llama 3.2 Vision (Groq)...')
      const analysis = await analyzeImages(imgFiles, empresa)

      // 2. Generación de Word
      setLoadMsg('📄 Construyendo documento Word...')
      const overallPeriod = deriveOverallPeriod(images)
      const docxBlob = await buildDocx({ 
        empresa, 
        generadoPor, 
        periodo: overallPeriod, 
        analysis, 
        imgFiles 
      })

      // 3. Generación de PDF (Nuevo paso)
      setLoadMsg('📑 Generando versión PDF...')
      const pdfBlob = await pdf(
        <ReportPDF 
          empresa={empresa} 
          generadoBy={generadoPor} 
          analysis={analysis} 
          imgFiles={imgFiles} 
        />
      ).toBlob();

      // Guardamos ambos archivos en el estado
      setResult({ 
        docx: docxBlob, 
        pdf: pdfBlob, 
        analysis 
      })
      setPage('done')
    } catch (e) {
      console.error("Error en generación:", e)
      setError(`Error: ${e.message}`)
      setPage('form')
    }
  }

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
          <input ref={addMoreRef} type="file" multiple accept="image/*" className="hidden" onChange={e => addImages(e.target.files)} />
        </section>
      )}

      {error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 mb-5 text-red-300 text-sm animate-pulse">
          {error}
        </div>
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