import { pdf } from '@react-pdf/renderer'
import { buildDocx } from './docxBuilder'
import { ReportPDF } from './pdfBuilder'

/**
 * Construye los binarios DOCX y PDF de un informe.
 * Se usa tanto al generar uno nuevo como al re-descargarlo desde el historial.
 *
 * @param {object} opts
 * @param {string} opts.empresa
 * @param {string} opts.generadoPor
 * @param {string} opts.periodo
 * @param {object} opts.analysis   { resumen, sections[], conclusiones[] }
 * @param {Array}  opts.imgFiles   entradas con { file: File, ... } en el orden del informe
 * @param {(msg: string) => void} [opts.onProgress]
 */
export async function buildReportFiles({ empresa, generadoPor, periodo, analysis, imgFiles, onProgress }) {
  onProgress?.('📄 Construyendo documento Word…')
  const docx = await buildDocx({ empresa, generadoPor, periodo, analysis, imgFiles })

  onProgress?.('📑 Generando versión PDF…')
  const pdfBlob = await pdf(
    <ReportPDF
      empresa={empresa}
      generadoBy={generadoPor}
      analysis={analysis}
      imgFiles={imgFiles}
    />,
  ).toBlob()

  return { docx, pdf: pdfBlob }
}

/** Dispara la descarga de un blob con nombre normalizado. */
export function downloadBlob(blob, empresa, extension, dateHint) {
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = (dateHint || new Date().toISOString()).slice(0, 10)
  a.href = url
  a.download = `Informe_${String(empresa || 'cliente').replace(/[^\w-]+/g, '_')}_${date}.${extension}`
  a.click()
  URL.revokeObjectURL(url)
}
