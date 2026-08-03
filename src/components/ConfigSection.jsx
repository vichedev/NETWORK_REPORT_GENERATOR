import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { empresasApi } from '../lib/api'
import { Field, Button, inputCls } from './ui'

export default function ConfigSection() {
  const {
    empresas, reloadEmpresas,
    empresaId, setEmpresaId,
    generadoPor, setGeneradoPor,
    activeKey, setPage,
  } = useApp()

  const [creating, setCreating] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  async function crearEmpresa() {
    const nombre = nuevoNombre.trim()
    if (!nombre) return
    setBusy(true); setLocalError('')
    try {
      const { empresa } = await empresasApi.create({ nombre })
      await reloadEmpresas()
      setEmpresaId(String(empresa.id))
      setNuevoNombre('')
      setCreating(false)
    } catch (err) {
      setLocalError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bg-slate-900/80 border border-blue-900/30 rounded-2xl p-6 mb-6">
      <h2 className="text-xs font-bold text-blue-500 tracking-[0.14em] mb-5">
        ① CONFIGURACIÓN GENERAL
      </h2>

      {/* Estado de la IA configurada */}
      <div className={`inline-flex flex-wrap items-center gap-2 text-xs px-3 py-2 rounded-lg mb-5 border ${
        activeKey
          ? 'bg-green-950/40 border-green-800/40 text-green-400'
          : 'bg-red-950/40 border-red-800/40 text-red-400'
      }`}>
        <span>{activeKey ? '🟢' : '🔴'}</span>
        {activeKey ? (
          <span>IA activa: <strong>{activeKey.label}</strong> · modelo <code>{activeKey.model}</code></span>
        ) : (
          <>
            <span>No hay ninguna API key de IA activa.</span>
            <button
              onClick={() => setPage('ajustes')}
              className="underline underline-offset-2 hover:text-red-200 font-semibold"
            >
              Configurar en Ajustes →
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Empresa */}
        <Field
          label="EMPRESA / CLIENTE"
          required
          hint={empresas.length === 0 ? 'Aún no tienes empresas: crea la primera aquí.' : undefined}
        >
          {creating || empresas.length === 0 ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); crearEmpresa() } }}
                placeholder="Ej: EMPRESA S.A."
                className={inputCls}
              />
              <Button className="px-3 py-2 text-xs shrink-0" disabled={busy || !nuevoNombre.trim()} onClick={crearEmpresa}>
                {busy ? '…' : 'Crear'}
              </Button>
              {empresas.length > 0 && (
                <Button variant="ghost" className="px-3 py-2 text-xs shrink-0" onClick={() => { setCreating(false); setLocalError('') }}>
                  ✕
                </Button>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <select value={empresaId} onChange={e => setEmpresaId(e.target.value)} className={inputCls}>
                <option value="">— Selecciona una empresa —</option>
                {empresas.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}{e.nodos_count ? ` (${e.nodos_count} nodos)` : ''}
                  </option>
                ))}
              </select>
              <Button variant="ghost" className="px-3 py-2 text-xs shrink-0" onClick={() => setCreating(true)}>
                ＋ Nueva
              </Button>
            </div>
          )}
          {localError && <p className="text-[11px] text-red-400 mt-1.5">{localError}</p>}
        </Field>

        {/* Generado por */}
        <Field label="GENERADO POR">
          <input
            type="text"
            value={generadoPor}
            onChange={e => setGeneradoPor(e.target.value)}
            placeholder="MAAT"
            className={inputCls}
          />
        </Field>
      </div>
    </section>
  )
}
