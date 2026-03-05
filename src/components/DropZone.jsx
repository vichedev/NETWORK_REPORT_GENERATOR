import { useRef } from 'react'
import { useApp } from '../context/AppContext'

export default function DropZone() {
  const { addImages } = useApp()
  const fileRef = useRef(null)

  function handleDrop(e) {
    e.preventDefault()
    addImages(e.dataTransfer.files)
  }

  return (
    <section className="bg-slate-900/80 border border-blue-900/30 rounded-2xl p-6 mb-6">
      <h2 className="text-xs font-bold text-cyan-500 tracking-[0.14em] mb-5">
        ② SUBE TUS GRÁFICAS DE TRÁFICO
      </h2>

      {/* Drop area */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className="border-2 border-dashed border-blue-800/60 rounded-xl p-10 text-center
                   cursor-pointer hover:border-blue-500/70 hover:bg-blue-950/20
                   transition-all duration-200 group"
      >
        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-200">
          📤
        </div>
        <p className="text-sm font-semibold text-slate-400 tracking-wide">
          Arrastra aquí tus imágenes o{' '}
          <span className="text-blue-400 underline underline-offset-2">
            haz clic para seleccionar
          </span>
        </p>
        <p className="text-xs text-slate-600 mt-2">
          PNG · JPG · Múltiples archivos · Distintas fechas, nodos y tipos
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={e => addImages(e.target.files)}
      />
    </section>
  )
}
