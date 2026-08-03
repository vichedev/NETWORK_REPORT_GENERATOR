import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { empresasApi, settingsApi } from '../lib/api'

const AppContext = createContext(null)

let uidCounter = 0

function createImageEntry(file) {
  return {
    id: ++uidCounter,
    file,
    preview: URL.createObjectURL(file),
    titulo: file.name.replace(/\.[^.]+$/, ''),
    nodoId: '',            // id del nodo en la BD (vacío = nodo nuevo escrito a mano)
    nodeName: '',
    interfaz: 'sfp-sfpplus1 (WAN)',
    ip: '',
    tipoGrafica: 'Tráfico general (avg)',
    periodoType: 'today',
    periodoFrom: '',
    periodoTo: '',
    periodoManual: '',
    descripcion: '',
  }
}

export function AppProvider({ children }) {
  // ── Navegación ─────────────────────────────────────────────
  const [page, setPage] = useState('generator') // generator | empresas | historial | ajustes

  // ── Catálogo (viene del backend) ───────────────────────────
  const [empresas, setEmpresas] = useState([])
  const [nodos, setNodos] = useState([])
  const [activeKey, setActiveKey] = useState(null)
  const [catalogLoading, setCatalogLoading] = useState(true)

  // ── Datos del informe en curso ─────────────────────────────
  const [empresaId, setEmpresaId] = useState('')
  const [generadoPor, setGeneradoPor] = useState('MAAT')
  const [images, setImages] = useState([])

  // ── Flujo del generador ────────────────────────────────────
  const [step, setStep] = useState('form') // form | loading | done
  const [loadMsg, setLoadMsg] = useState('')
  // Progreso detallado que llega del backend: { stage, current, total, seconds }
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { docx, pdf, analysis, reportId }

  const empresa = useMemo(
    () => empresas.find(e => String(e.id) === String(empresaId)) || null,
    [empresas, empresaId],
  )

  // ── Carga del catálogo ─────────────────────────────────────
  const reloadEmpresas = useCallback(async () => {
    const { empresas } = await empresasApi.list()
    setEmpresas(empresas)
    return empresas
  }, [])

  const reloadActiveKey = useCallback(async () => {
    const { keys } = await settingsApi.listKeys()
    const active = keys.find(k => k.is_active) || null
    setActiveKey(active)
    return active
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await Promise.all([reloadEmpresas(), reloadActiveKey()])
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [reloadEmpresas, reloadActiveKey])

  // Los nodos se recargan cada vez que cambia la empresa seleccionada.
  useEffect(() => {
    if (!empresaId) { setNodos([]); return }
    let cancelled = false
    empresasApi.listNodos(empresaId)
      .then(({ nodos }) => { if (!cancelled) setNodos(nodos) })
      .catch(() => { if (!cancelled) setNodos([]) })
    return () => { cancelled = true }
  }, [empresaId])

  const reloadNodos = useCallback(async () => {
    if (!empresaId) return []
    const { nodos } = await empresasApi.listNodos(empresaId)
    setNodos(nodos)
    return nodos
  }, [empresaId])

  // ── Acciones sobre imágenes ────────────────────────────────
  const addImages = useCallback((files) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'))
    setImages(prev => [...prev, ...valid.map(createImageEntry)])
  }, [])

  const updateImage = useCallback((id, patch) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, ...patch } : img))
  }, [])

  const removeImage = useCallback((id) => {
    setImages(prev => {
      const removed = prev.find(i => i.id === id)
      if (removed) URL.revokeObjectURL(removed.preview)
      return prev.filter(i => i.id !== id)
    })
  }, [])

  const moveImage = useCallback((id, direction) => {
    setImages(prev => {
      const idx = prev.findIndex(i => i.id === id)
      if (idx === -1) return prev
      const swapIdx = idx + direction
      if (swapIdx < 0 || swapIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })
  }, [])

  const clearImages = useCallback(() => {
    setImages(prev => { prev.forEach(i => URL.revokeObjectURL(i.preview)); return [] })
  }, [])

  // ── Reset ──────────────────────────────────────────────────
  const resetApp = useCallback(() => {
    clearImages()
    setResult(null)
    setError('')
    setLoadMsg('')
    setProgress(null)
    setStep('form')
  }, [clearImages])

  return (
    <AppContext.Provider value={{
      // navegación
      page, setPage,
      // catálogo
      empresas, reloadEmpresas,
      nodos, reloadNodos,
      activeKey, reloadActiveKey,
      catalogLoading,
      // informe en curso
      empresaId, setEmpresaId, empresa,
      generadoPor, setGeneradoPor,
      images, addImages, updateImage, removeImage, moveImage, clearImages,
      // flujo
      step, setStep,
      loadMsg, setLoadMsg,
      progress, setProgress,
      error, setError,
      result, setResult,
      resetApp,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
