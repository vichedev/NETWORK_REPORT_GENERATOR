import { createContext, useContext, useState, useCallback } from 'react'

const AppContext = createContext(null)

let uidCounter = 0

function createImageEntry(file, defaultNodeName = '') {
  return {
    id: ++uidCounter,
    file,
    preview: URL.createObjectURL(file),
    titulo: file.name.replace(/\.[^.]+$/, ''),
    nodeName: defaultNodeName,
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
  // Config — apiKey viene de .env (VITE_GEMINI_API_KEY), no se guarda en estado
  const [empresa, setEmpresa] = useState('')
  const [generadoPor, setGeneradoPor] = useState('MAAT')

  // Images
  const [images, setImages] = useState([])

  // App flow
  const [page, setPage] = useState('form') // form | loading | done
  const [loadMsg, setLoadMsg] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { blob, analysis }

  // ── Image actions ──────────────────────────────────────────
  const addImages = useCallback((files) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'))
    setImages(prev => [
      ...prev,
      ...valid.map(f => createImageEntry(f, empresa))
    ])
  }, [empresa])

  const updateImage = useCallback((id, field, value) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, [field]: value } : img))
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
      const next = [...prev]
      const swapIdx = idx + direction
      if (swapIdx < 0 || swapIdx >= next.length) return prev
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
    setPage('form')
  }, [clearImages])

  return (
    <AppContext.Provider value={{
      // config
      empresa, setEmpresa,
      generadoPor, setGeneradoPor,
      // images
      images,
      addImages, updateImage, removeImage, moveImage, clearImages,
      // flow
      page, setPage,
      loadMsg, setLoadMsg,
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