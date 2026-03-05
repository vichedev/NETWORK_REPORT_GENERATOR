import { useState, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { PERIOD_OPTIONS, TIPO_GRAFICA_OPTIONS, resolvePeriod } from '../lib/periods'

export default function ImageDetailCard({ img, index, total }) {
  const { updateImage, removeImage, moveImage } = useApp()
  const [open, setOpen] = useState(true)
  const fileRef = useRef(null)

  const period = resolvePeriod(img.periodoType, img.periodoFrom, img.periodoTo, img.periodoManual)

  function update(field, value) {
    updateImage(img.id, field, value)
  }

  return (
    <div className="bg-slate-950/95 border border-slate-800/80 rounded-xl overflow-hidden mb-4 shadow-lg shadow-black/40">

      {/* ── Card Header ── */}
      <div className={`flex items-center gap-3 px-4 py-3 bg-slate-900/80 ${open ? 'border-b border-slate-800/60' : ''}`}>

        {/* Thumbnail */}
        <img
          src={img.preview}
          alt=""
          className="w-14 h-10 object-cover rounded-md border border-slate-700/60 shrink-0"
        />

        {/* Index badge */}
        <span className="bg-gradient-to-br from-blue-700 to-blue-500 text-white text-xs font-bold
                         px-2.5 py-0.5 rounded-md shrink-0 tracking-wide">
          #{index + 1}
        </span>

        {/* Title + period */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-300 truncate leading-tight">
            {img.titulo || <span className="text-slate-600 italic">Sin título…</span>}
          </p>
          <p className="text-[11px] text-slate-600 mt-0.5 truncate">{period}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {index > 0 && (
            <button
              onClick={() => moveImage(img.id, -1)}
              title="Subir"
              className="px-2 py-1 text-slate-500 hover:text-blue-400 bg-slate-800/50 
                         hover:bg-slate-700/50 rounded-md text-xs transition-colors"
            >
              ↑
            </button>
          )}
          {index < total - 1 && (
            <button
              onClick={() => moveImage(img.id, 1)}
              title="Bajar"
              className="px-2 py-1 text-slate-500 hover:text-blue-400 bg-slate-800/50
                         hover:bg-slate-700/50 rounded-md text-xs transition-colors"
            >
              ↓
            </button>
          )}
          <button
            onClick={() => setOpen(o => !o)}
            className="px-3 py-1 text-blue-400 bg-blue-900/30 hover:bg-blue-800/40
                       border border-blue-800/40 rounded-md text-xs font-semibold transition-colors"
          >
            {open ? '▲ Cerrar' : '▼ Editar'}
          </button>
          <button
            onClick={() => removeImage(img.id)}
            className="px-2.5 py-1 text-red-400 bg-red-900/20 hover:bg-red-900/40
                       border border-red-900/40 rounded-md text-xs transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Card Body ── */}
      {open && (
        <div className="p-5 flex flex-col gap-5">

          {/* Row 1: Título + Nodo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="TÍTULO DE LA GRÁFICA" required>
              <input
                type="text"
                value={img.titulo}
                onChange={e => update('titulo', e.target.value)}
                placeholder="Ej: Tráfico hoy, Febrero avg, Picos máx…"
                className={inputCls}
              />
            </Field>
            <Field label="NOMBRE DEL NODO" required>
              <input
                type="text"
                value={img.nodeName}
                onChange={e => update('nodeName', e.target.value)}
                placeholder="Ej: SE La Mana, Bella Rica…"
                className={inputCls}
              />
            </Field>
          </div>

          {/* Row 2: Interfaz + IP */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="INTERFAZ">
              <input
                type="text"
                value={img.interfaz}
                onChange={e => update('interfaz', e.target.value)}
                placeholder="sfp-sfpplus1 (WAN)"
                className={inputCls}
              />
            </Field>
            <Field label="IP SNMP">
              <input
                type="text"
                value={img.ip}
                onChange={e => update('ip', e.target.value)}
                placeholder="205.0.0.0"
                className={inputCls}
              />
              
            </Field>
          </div>

          {/* Row 3: Tipo de gráfica */}
          <Field label="TIPO DE GRÁFICA">
            <select
              value={img.tipoGrafica}
              onChange={e => update('tipoGrafica', e.target.value)}
              className={inputCls}
            >
              {TIPO_GRAFICA_OPTIONS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>

          {/* Row 4: Período */}
          <div>
            <Field label="PERÍODO DE ESTA GRÁFICA" required>
              {/* Period type chips */}
              <div className="flex flex-wrap gap-2 mb-3">
                {PERIOD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => update('periodoType', opt.value)}
                    className={[
                      'px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all duration-150',
                      img.periodoType === opt.value
                        ? 'bg-blue-700 border-blue-500 text-white'
                        : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-blue-700/50',
                    ].join(' ')}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>

              {/* Custom date range */}
              {img.periodoType === 'custom' && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className={labelCls}>DESDE</label>
                    <input
                      type="date"
                      value={img.periodoFrom}
                      onChange={e => update('periodoFrom', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>HASTA</label>
                    <input
                      type="date"
                      value={img.periodoTo}
                      onChange={e => update('periodoTo', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {/* Manual text */}
              {img.periodoType === 'manual' && (
                <input
                  type="text"
                  value={img.periodoManual}
                  onChange={e => update('periodoManual', e.target.value)}
                  placeholder="Ej: 01/02/2026 — 28/02/2026"
                  className={inputCls}
                />
              )}

              {/* Resolved period preview */}
              {img.periodoType !== 'custom' && img.periodoType !== 'manual' && (
                <p className="text-xs text-cyan-700 mt-1.5">📆 {period}</p>
              )}
            </Field>
          </div>

          {/* Row 5: Descripción libre */}
          <Field label="DESCRIPCIÓN / CONTEXTO ADICIONAL">
            <textarea
              value={img.descripcion}
              onChange={e => update('descripcion', e.target.value)}
              rows={3}
              placeholder="Describe qué observas en esta gráfica, eventos ocurridos, si hay algo inusual, comparaciones con otras fechas… La IA usará este contexto para enriquecer el análisis."
              className={`${inputCls} resize-y min-h-[72px]`}
            />
          </Field>

        </div>
      )}
    </div>
  )
}

// ── Small helpers ──────────────────────────────────────────────────────────
const inputCls = `
  w-full px-3 py-2.5 bg-slate-950/80 border border-blue-900/40 rounded-lg
  text-slate-300 text-sm placeholder-slate-600
  focus:outline-none focus:border-blue-500 transition-colors
`

const labelCls = 'block text-[10px] font-bold text-slate-500 tracking-widest mb-1.5'

function Field({ label, required, children }) {
  return (
    <div>
      <label className={labelCls}>
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}
