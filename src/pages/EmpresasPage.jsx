import { useState, useEffect, useCallback } from 'react'
import { empresasApi } from '../lib/api'
import { useApp } from '../context/AppContext'
import { Section, Field, Button, Alert, EmptyState, Badge, Spinner, inputCls } from '../components/ui'

const EMPTY_EMPRESA = { nombre: '', contacto: '', notas: '' }
const EMPTY_NODO = { nombre: '', interfaz: 'sfp-sfpplus1 (WAN)', ip: '', notas: '' }

export default function EmpresasPage() {
  const { empresas, reloadEmpresas, setPage, setEmpresaId, catalogLoading } = useApp()

  const [selectedId, setSelectedId] = useState(null)
  const [nodos, setNodos] = useState([])
  const [nodosLoading, setNodosLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [form, setForm] = useState(EMPTY_EMPRESA)
  const [editingId, setEditingId] = useState(null)
  const [nodoForm, setNodoForm] = useState(EMPTY_NODO)
  const [editingNodoId, setEditingNodoId] = useState(null)

  const selected = empresas.find(e => e.id === selectedId) || null

  const loadNodos = useCallback(async (empresaId) => {
    if (!empresaId) { setNodos([]); return }
    setNodosLoading(true)
    try {
      const { nodos } = await empresasApi.listNodos(empresaId)
      setNodos(nodos)
    } catch (err) {
      setError(err.message)
    } finally {
      setNodosLoading(false)
    }
  }, [])

  useEffect(() => { loadNodos(selectedId) }, [selectedId, loadNodos])

  function resetEmpresaForm() {
    setForm(EMPTY_EMPRESA)
    setEditingId(null)
  }

  function resetNodoForm() {
    setNodoForm(EMPTY_NODO)
    setEditingNodoId(null)
  }

  // ── Empresas ──────────────────────────────────────────────
  async function submitEmpresa(e) {
    e.preventDefault()
    setError(''); setNotice('')
    try {
      if (editingId) {
        await empresasApi.update(editingId, form)
        setNotice('Empresa actualizada.')
      } else {
        const { empresa } = await empresasApi.create(form)
        setSelectedId(empresa.id)
        setNotice(`Empresa "${empresa.nombre}" creada.`)
      }
      await reloadEmpresas()
      resetEmpresaForm()
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteEmpresa(empresa) {
    if (!confirm(
      `¿Eliminar "${empresa.nombre}" y sus ${empresa.nodos_count} nodo(s)?\n\n` +
      `Sus ${empresa.informes_count} informe(s) se conservan en el historial.`
    )) return

    setError(''); setNotice('')
    try {
      await empresasApi.remove(empresa.id)
      await reloadEmpresas()
      if (selectedId === empresa.id) setSelectedId(null)
      if (editingId === empresa.id) resetEmpresaForm()
      setNotice('Empresa eliminada.')
    } catch (err) {
      setError(err.message)
    }
  }

  // ── Nodos ─────────────────────────────────────────────────
  async function submitNodo(e) {
    e.preventDefault()
    if (!selectedId) return
    setError(''); setNotice('')
    try {
      const { nodos } = editingNodoId
        ? await empresasApi.updateNodo(selectedId, editingNodoId, nodoForm)
        : await empresasApi.createNodo(selectedId, nodoForm)
      setNodos(nodos)
      await reloadEmpresas()
      resetNodoForm()
      setNotice(editingNodoId ? 'Nodo actualizado.' : 'Nodo añadido.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteNodo(nodo) {
    if (!confirm(`¿Eliminar el nodo "${nodo.nombre}"?\nLos informes que lo mencionan se conservan.`)) return
    setError(''); setNotice('')
    try {
      const { nodos } = await empresasApi.removeNodo(selectedId, nodo.id)
      setNodos(nodos)
      await reloadEmpresas()
      if (editingNodoId === nodo.id) resetNodoForm()
      setNotice('Nodo eliminado.')
    } catch (err) {
      setError(err.message)
    }
  }

  function generarInforme(empresa) {
    setEmpresaId(String(empresa.id))
    setPage('generator')
  }

  if (catalogLoading) return <Spinner label="Cargando empresas…" />

  return (
    <div className="animate-fade-in">
      <Alert kind="error">{error}</Alert>
      <Alert kind="success">{notice}</Alert>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 items-start">
        {/* ── Columna izquierda: alta + listado ─────────────── */}
        <div>
          <Section title={editingId ? '✎ EDITAR EMPRESA' : '＋ NUEVA EMPRESA'}>
            <form onSubmit={submitEmpresa} className="flex flex-col gap-4">
              <Field label="NOMBRE" required>
                <input type="text" value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: REDCOM S.A." className={inputCls} />
              </Field>
              <Field label="CONTACTO">
                <input type="text" value={form.contacto}
                  onChange={e => setForm({ ...form, contacto: e.target.value })}
                  placeholder="Ej: NOC · noc@empresa.com" className={inputCls} />
              </Field>
              <Field label="NOTAS">
                <textarea rows={2} value={form.notas}
                  onChange={e => setForm({ ...form, notas: e.target.value })}
                  placeholder="Detalles del cliente, SLA, particularidades…"
                  className={`${inputCls} resize-y`} />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" disabled={!form.nombre.trim()}>
                  {editingId ? 'Guardar cambios' : 'Crear empresa'}
                </Button>
                {editingId && (
                  <Button type="button" variant="ghost" onClick={resetEmpresaForm}>Cancelar</Button>
                )}
              </div>
            </form>
          </Section>

          <Section title={`🏢 EMPRESAS (${empresas.length})`}>
            {empresas.length === 0 ? (
              <EmptyState icon="🏢" title="Aún no has creado ninguna empresa">
                Crea la primera arriba. Cada informe queda vinculado a una empresa y sus nodos.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-2">
                {empresas.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => { setSelectedId(emp.id); resetNodoForm() }}
                    className={`text-left rounded-xl border p-3.5 transition-colors ${
                      selectedId === emp.id
                        ? 'bg-blue-950/30 border-blue-700/60'
                        : 'bg-slate-950/60 border-slate-800/70 hover:border-blue-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-200 truncate">{emp.nombre}</span>
                      <div className="flex gap-1.5 shrink-0">
                        <Badge tone="slate">{emp.nodos_count} nodos</Badge>
                        <Badge tone="blue">{emp.informes_count} informes</Badge>
                      </div>
                    </div>
                    {emp.contacto && <p className="text-xs text-slate-500 mt-1">{emp.contacto}</p>}
                  </button>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* ── Columna derecha: detalle de la empresa ────────── */}
        <div>
          {!selected ? (
            <Section>
              <EmptyState icon="👈" title="Selecciona una empresa">
                Elige una empresa de la lista para gestionar sus nodos y generar informes.
              </EmptyState>
            </Section>
          ) : (
            <>
              <Section
                title={`📍 ${selected.nombre.toUpperCase()}`}
                action={
                  <div className="flex gap-2">
                    <Button variant="ghost" className="px-3 py-1.5 text-xs"
                      onClick={() => { setEditingId(selected.id); setForm({ nombre: selected.nombre, contacto: selected.contacto, notas: selected.notas }) }}>
                      Editar
                    </Button>
                    <Button variant="danger" className="px-3 py-1.5 text-xs"
                      onClick={() => deleteEmpresa(selected)}>
                      Eliminar
                    </Button>
                  </div>
                }
              >
                {selected.notas && (
                  <p className="text-xs text-slate-400 leading-relaxed mb-4 bg-slate-950/60 rounded-lg p-3">
                    {selected.notas}
                  </p>
                )}
                <Button onClick={() => generarInforme(selected)} className="w-full py-3">
                  ⚡ GENERAR INFORME PARA ESTA EMPRESA
                </Button>
              </Section>

              <Section title={editingNodoId ? '✎ EDITAR NODO' : '＋ AÑADIR NODO'}>
                <form onSubmit={submitNodo} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="NOMBRE DEL NODO" required>
                      <input type="text" value={nodoForm.nombre}
                        onChange={e => setNodoForm({ ...nodoForm, nombre: e.target.value })}
                        placeholder="Ej: SE La Mana" className={inputCls} />
                    </Field>
                    <Field label="INTERFAZ">
                      <input type="text" value={nodoForm.interfaz}
                        onChange={e => setNodoForm({ ...nodoForm, interfaz: e.target.value })}
                        placeholder="sfp-sfpplus1 (WAN)" className={inputCls} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="IP SNMP">
                      <input type="text" value={nodoForm.ip}
                        onChange={e => setNodoForm({ ...nodoForm, ip: e.target.value })}
                        placeholder="10.0.0.1" className={inputCls} />
                    </Field>
                    <Field label="NOTAS">
                      <input type="text" value={nodoForm.notas}
                        onChange={e => setNodoForm({ ...nodoForm, notas: e.target.value })}
                        placeholder="Ubicación, capacidad contratada…" className={inputCls} />
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={!nodoForm.nombre.trim()}>
                      {editingNodoId ? 'Guardar nodo' : 'Añadir nodo'}
                    </Button>
                    {editingNodoId && (
                      <Button type="button" variant="ghost" onClick={resetNodoForm}>Cancelar</Button>
                    )}
                  </div>
                </form>
              </Section>

              <Section title={`🔌 NODOS DE ${selected.nombre.toUpperCase()} (${nodos.length})`}>
                {nodosLoading ? (
                  <Spinner label="Cargando nodos…" />
                ) : nodos.length === 0 ? (
                  <EmptyState icon="🔌" title="Esta empresa no tiene nodos todavía">
                    Añádelos aquí, o escríbelos directamente al detallar una imagen en el generador:
                    se darán de alta solos.
                  </EmptyState>
                ) : (
                  <div className="flex flex-col gap-2">
                    {nodos.map(nodo => (
                      <div key={nodo.id}
                        className="bg-slate-950/60 border border-slate-800/70 rounded-xl p-3.5
                                   flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-200 truncate">{nodo.nombre}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {nodo.interfaz || 'sin interfaz'}{nodo.ip ? ` · ${nodo.ip}` : ''}
                          </p>
                          {nodo.notas && <p className="text-[11px] text-slate-600 mt-1">{nodo.notas}</p>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button variant="ghost" className="px-3 py-1.5 text-xs"
                            onClick={() => {
                              setEditingNodoId(nodo.id)
                              setNodoForm({ nombre: nodo.nombre, interfaz: nodo.interfaz, ip: nodo.ip, notas: nodo.notas })
                            }}>
                            Editar
                          </Button>
                          <Button variant="danger" className="px-3 py-1.5 text-xs"
                            onClick={() => deleteNodo(nodo)}>
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
