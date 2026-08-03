import { useState, useEffect, useCallback } from 'react'
import { reportsApi, empresasApi, fetchReportImage } from '../lib/api'
import { buildReportFiles, downloadBlob } from '../lib/exportReport'
import { useApp } from '../context/AppContext'
import AnalysisPreview from '../components/AnalysisPreview'
import { Section, Field, Button, Alert, EmptyState, Badge, Spinner, inputCls, formatDate } from '../components/ui'

export default function HistorialPage() {
  const { empresas, catalogLoading } = useApp()

  const [empresaId, setEmpresaId] = useState('')
  const [nodoId, setNodoId] = useState('')
  const [nodos, setNodos] = useState([])

  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [detail, setDetail] = useState(null)      // { report, analysis, images }
  const [detailLoading, setDetailLoading] = useState(false)
  const [exporting, setExporting] = useState('')  // mensaje de progreso

  const load = useCallback(async (filters) => {
    setLoading(true)
    try {
      const { reports } = await reportsApi.list(filters)
      setReports(reports)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load({ empresaId, nodoId }) }, [load, empresaId, nodoId])

  // Los nodos del filtro dependen de la empresa elegida.
  useEffect(() => {
    setNodoId('')
    if (!empresaId) { setNodos([]); return }
    let cancelled = false
    empresasApi.listNodos(empresaId)
      .then(({ nodos }) => { if (!cancelled) setNodos(nodos) })
      .catch(() => { if (!cancelled) setNodos([]) })
    return () => { cancelled = true }
  }, [empresaId])

  async function openDetail(id) {
    setError(''); setNotice(''); setDetailLoading(true)
    try {
      setDetail(await reportsApi.get(id))
    } catch (err) {
      setError(err.message)
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleDelete(report) {
    if (!confirm(`¿Eliminar el informe de ${report.empresa_nombre} del ${formatDate(report.created_at)}?\nSe borrarán también sus imágenes.`)) return
    setError(''); setNotice('')
    try {
      await reportsApi.remove(report.id)
      if (detail?.report?.id === report.id) setDetail(null)
      await load({ empresaId, nodoId })
      setNotice('Informe eliminado del historial.')
    } catch (err) {
      setError(err.message)
    }
  }

  /** Reconstruye DOCX y PDF descargando las imágenes guardadas en el servidor. */
  async function handleExport(format) {
    if (!detail?.analysis) return
    setError(''); setNotice(''); setExporting('⬇️ Recuperando imágenes…')

    try {
      const imgFiles = []
      for (const img of detail.images) {
        const file = await fetchReportImage(img.url, `${img.titulo || 'grafica'}`, img.mime)
        imgFiles.push({ ...img, file })
      }

      const files = await buildReportFiles({
        empresa: detail.report.empresaNombre,
        generadoPor: detail.report.generadoPor,
        periodo: detail.report.periodo,
        analysis: detail.analysis,
        imgFiles,
        onProgress: setExporting,
      })

      downloadBlob(files[format], detail.report.empresaNombre, format === 'pdf' ? 'pdf' : 'docx', detail.report.createdAt)
      setNotice('Descarga lista.')
    } catch (err) {
      setError(`No se pudo regenerar el documento: ${err.message}`)
    } finally {
      setExporting('')
    }
  }

  if (catalogLoading) return <Spinner label="Cargando historial…" />

  return (
    <div className="animate-fade-in">
      <Alert kind="error">{error}</Alert>
      <Alert kind="success">{notice}</Alert>

      <Section title="🔎 FILTRAR HISTORIAL">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="EMPRESA">
            <select value={empresaId} onChange={e => setEmpresaId(e.target.value)} className={inputCls}>
              <option value="">Todas las empresas</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </Field>
          <Field label="NODO" hint={!empresaId ? 'Elige primero una empresa.' : undefined}>
            <select value={nodoId} onChange={e => setNodoId(e.target.value)}
              disabled={!empresaId} className={`${inputCls} disabled:opacity-40`}>
              <option value="">Todos los nodos</option>
              {nodos.map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section title={`🗂️ INFORMES (${reports.length})`}>
        {loading ? (
          <Spinner label="Buscando informes…" />
        ) : reports.length === 0 ? (
          <EmptyState icon="🗂️" title="No hay informes con estos filtros">
            Cada informe que generes queda archivado aquí, con sus imágenes y su análisis,
            listo para volver a descargarlo.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {reports.map(r => (
              <div key={r.id}
                className={`rounded-xl border p-4 transition-colors ${
                  detail?.report?.id === r.id
                    ? 'bg-blue-950/25 border-blue-700/60'
                    : 'bg-slate-950/60 border-slate-800/70 hover:border-blue-900/60'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-200">{r.empresa_nombre}</span>
                      <Badge tone="slate">{r.imagenes} gráfica{r.imagenes !== 1 ? 's' : ''}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatDate(r.created_at)}
                      {r.periodo ? ` · ${r.periodo}` : ''}
                      {r.generado_por ? ` · por ${r.generado_por}` : ''}
                    </p>
                    {r.nodos.length > 0 && (
                      <p className="text-[11px] text-slate-600 mt-1.5">
                        📡 {r.nodos.join(' · ')}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-700 mt-1">{r.provider} / {r.model}</p>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => openDetail(r.id)}>
                      Ver informe
                    </Button>
                    <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => handleDelete(r)}>
                      Eliminar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {detailLoading && <Spinner label="Abriendo informe…" />}

      {detail && !detailLoading && (
        <Section
          title={`📄 ${detail.report.empresaNombre.toUpperCase()} · ${formatDate(detail.report.createdAt)}`}
          action={
            <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setDetail(null)}>
              Cerrar
            </Button>
          }
        >
          {exporting && <Alert kind="info">{exporting}</Alert>}

          <div className="flex flex-wrap gap-3 mb-6">
            <Button disabled={!!exporting} onClick={() => handleExport('docx')}
              className="bg-gradient-to-r from-blue-800 to-blue-600">
              ⬇️ Descargar .DOCX
            </Button>
            <Button disabled={!!exporting} onClick={() => handleExport('pdf')}
              className="bg-gradient-to-r from-red-800 to-red-600">
              ⬇️ Descargar .PDF
            </Button>
          </div>

          {/* Miniaturas de las gráficas archivadas */}
          {detail.images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
              {detail.images.map(img => (
                <a key={img.id} href={img.url} target="_blank" rel="noreferrer"
                  className="block bg-slate-950/60 border border-slate-800/70 rounded-lg overflow-hidden
                             hover:border-blue-800/60 transition-colors">
                  <img src={img.url} alt={img.titulo} className="w-full h-24 object-cover" />
                  <div className="p-2">
                    <p className="text-[11px] text-slate-300 truncate">{img.nodo_nombre || img.titulo}</p>
                    <p className="text-[10px] text-slate-600 truncate">{img.periodo}</p>
                  </div>
                </a>
              ))}
            </div>
          )}

          <AnalysisPreview analysis={detail.analysis} />
        </Section>
      )}
    </div>
  )
}
