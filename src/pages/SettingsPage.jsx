import { useState, useEffect, useCallback } from 'react'
import { settingsApi, authApi, usersApi } from '../lib/api'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { Section, Field, Button, Alert, EmptyState, Badge, Spinner, inputCls, formatDate } from '../components/ui'

export default function SettingsPage() {
  const { reloadActiveKey } = useApp()

  const [providers, setProviders] = useState({})
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Formulario de alta
  const [provider, setProvider] = useState('groq')
  const [model, setModel] = useState('')
  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  // Estado por fila (probar / rotar)
  const [testingId, setTestingId] = useState(null)
  const [rotateId, setRotateId] = useState(null)
  const [rotateValue, setRotateValue] = useState('')

  const load = useCallback(async () => {
    const [{ providers }, { keys }] = await Promise.all([
      settingsApi.providers(),
      settingsApi.listKeys(),
    ])
    setProviders(providers)
    setKeys(keys)
    return providers
  }, [])

  useEffect(() => {
    load()
      .then(p => setModel(p.groq?.models?.[0] || ''))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [load])

  function changeProvider(next) {
    setProvider(next)
    setModel(providers[next]?.models?.[0] || '')
  }

  async function refreshAll() {
    await load()
    await reloadActiveKey()
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError(''); setNotice(''); setSaving(true)
    try {
      await settingsApi.createKey({ provider, model, label: label.trim(), apiKey: apiKey.trim() })
      setApiKey(''); setLabel('')
      await refreshAll()
      setNotice('API key guardada y cifrada en la base de datos.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function run(action, successMsg) {
    setError(''); setNotice('')
    try {
      const res = await action()
      await refreshAll()
      setNotice(typeof successMsg === 'function' ? successMsg(res) : successMsg)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleTest(id) {
    setTestingId(id); setError(''); setNotice('')
    try {
      const res = await settingsApi.test(id)
      setNotice(res.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setTestingId(null)
    }
  }

  async function handleRotate(id) {
    if (rotateValue.trim().length < 12) return setError('La API key parece incompleta.')
    await run(() => settingsApi.updateKey(id, { apiKey: rotateValue.trim() }), 'API key actualizada.')
    setRotateId(null); setRotateValue('')
  }

  async function handleChangeModel(id, newModel) {
    await run(() => settingsApi.updateKey(id, { model: newModel }), 'Modelo actualizado.')
  }

  if (loading) return <Spinner label="Cargando ajustes…" />

  return (
    <div className="animate-fade-in">
      <Alert kind="error">{error}</Alert>
      <Alert kind="success">{notice}</Alert>

      {/* ── Alta de API key ─────────────────────────────────── */}
      <Section title="① AÑADIR API KEY DE IA">
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Las claves se guardan <strong className="text-slate-400">cifradas (AES-256-GCM)</strong> en la base
          de datos del servidor y nunca se envían al navegador. Todas las llamadas a la IA salen desde el backend.
        </p>

        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="PROVEEDOR" required>
              <select value={provider} onChange={e => changeProvider(e.target.value)} className={inputCls}>
                {Object.entries(providers).map(([key, p]) => (
                  <option key={key} value={key}>{p.label}</option>
                ))}
              </select>
            </Field>

            <Field
              label="MODELO (CON VISIÓN)"
              required
              hint="Puedes escribir cualquier modelo del proveedor; la lista son solo sugerencias."
            >
              <input
                type="text"
                list={`modelos-${provider}`}
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="Identificador del modelo"
                className={inputCls}
              />
              <datalist id={`modelos-${provider}`}>
                {(providers[provider]?.models || []).map(m => <option key={m} value={m} />)}
              </datalist>
            </Field>
          </div>

          <Field
            label="API KEY"
            required
            hint={providers[provider]?.docsUrl
              ? `Consíguela en ${providers[provider].docsUrl}`
              : undefined}
          >
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              autoComplete="off"
              placeholder={providers[provider]?.keyPrefix ? `${providers[provider].keyPrefix}…` : 'Pega aquí tu clave'}
              className={inputCls}
            />
          </Field>

          <Field label="ETIQUETA (OPCIONAL)">
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ej: Cuenta principal"
              className={inputCls}
            />
          </Field>

          <Button type="submit" disabled={saving || !apiKey.trim() || !model} className="self-start">
            {saving ? 'Guardando…' : '＋ Guardar API key'}
          </Button>
        </form>
      </Section>

      {/* ── Listado ─────────────────────────────────────────── */}
      <Section title={`② API KEYS CONFIGURADAS (${keys.length})`}>
        {keys.length === 0 ? (
          <EmptyState icon="🔑" title="Todavía no hay ninguna API key">
            Añade al menos una arriba. Sin clave activa el generador de informes no puede funcionar.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {keys.map(k => (
              <div
                key={k.id}
                className={`rounded-xl border p-4 transition-colors ${
                  k.is_active
                    ? 'bg-green-950/15 border-green-800/40'
                    : 'bg-slate-950/60 border-slate-800/70'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-sm font-semibold text-slate-200">{k.label}</span>
                      {k.is_active
                        ? <Badge tone="green">● EN USO</Badge>
                        : <Badge tone="slate">inactiva</Badge>}
                    </div>
                    <p className="text-xs text-slate-500">
                      {providers[k.provider]?.label || k.provider} · clave ····{k.key_last4} ·
                      actualizada {formatDate(k.updated_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!k.is_active && (
                      <Button variant="success" className="px-3 py-1.5 text-xs"
                        onClick={() => run(() => settingsApi.activate(k.id), 'Esta API key es ahora la activa.')}>
                        Usar esta
                      </Button>
                    )}
                    <Button variant="ghost" className="px-3 py-1.5 text-xs"
                      disabled={testingId === k.id}
                      onClick={() => handleTest(k.id)}>
                      {testingId === k.id ? 'Probando…' : 'Probar conexión'}
                    </Button>
                    <Button variant="ghost" className="px-3 py-1.5 text-xs"
                      onClick={() => { setRotateId(rotateId === k.id ? null : k.id); setRotateValue('') }}>
                      Cambiar clave
                    </Button>
                    <Button variant="danger" className="px-3 py-1.5 text-xs"
                      onClick={() => {
                        if (confirm(`¿Eliminar la API key "${k.label}"?`)) {
                          run(() => settingsApi.deleteKey(k.id), 'API key eliminada.')
                        }
                      }}>
                      Eliminar
                    </Button>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800/60 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="MODELO" hint="Pulsa Intro para guardar el cambio.">
                    <input
                      type="text"
                      list={`modelos-key-${k.id}`}
                      defaultValue={k.model}
                      onKeyDown={e => { if (e.key === 'Enter') handleChangeModel(k.id, e.target.value.trim()) }}
                      onBlur={e => {
                        const value = e.target.value.trim()
                        if (value && value !== k.model) handleChangeModel(k.id, value)
                      }}
                      className={inputCls}
                    />
                    <datalist id={`modelos-key-${k.id}`}>
                      {(providers[k.provider]?.models || []).map(m => <option key={m} value={m} />)}
                    </datalist>
                  </Field>

                  {rotateId === k.id && (
                    <Field label="NUEVA API KEY">
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={rotateValue}
                          onChange={e => setRotateValue(e.target.value)}
                          autoComplete="off"
                          placeholder="Pega la clave nueva"
                          className={inputCls}
                        />
                        <Button className="px-3 py-2 text-xs shrink-0" onClick={() => handleRotate(k.id)}>
                          Guardar
                        </Button>
                      </div>
                    </Field>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <AccountSection onError={setError} onNotice={setNotice} />
      <UsersSection onError={setError} onNotice={setNotice} />
    </div>
  )
}

// ── ③ Mi cuenta: nombre de usuario y contraseña ─────────────────────────────

function AccountSection({ onError, onNotice }) {
  const { user, updateUser } = useAuth()

  const [username, setUsername] = useState(user?.username || '')
  const [savingName, setSavingName] = useState(false)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  async function submitUsername(e) {
    e.preventDefault()
    onError(''); onNotice('')
    setSavingName(true)
    try {
      const { user } = await authApi.changeUsername(username.trim())
      updateUser(user)
      onNotice(`Ahora entras como "${user.username}".`)
    } catch (err) {
      onError(err.message)
      setUsername(user?.username || '')
    } finally {
      setSavingName(false)
    }
  }

  async function submitPassword(e) {
    e.preventDefault()
    onError(''); onNotice('')
    if (next !== confirm) return onError('Las contraseñas nuevas no coinciden.')

    setBusy(true)
    try {
      const { user } = await authApi.changePassword(current, next)
      updateUser(user)
      setCurrent(''); setNext(''); setConfirm('')
      onNotice('Contraseña actualizada. Se cerraron las demás sesiones abiertas.')
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title="③ MI CUENTA">
      {user?.mustChangePassword && (
        <Alert kind="warn">
          Sigues usando la contraseña que se te asignó. Cámbiala aquí abajo:
          mientras no lo hagas, cualquiera que conozca las credenciales por
          defecto puede entrar al sistema.
        </Alert>
      )}

      {/* Nombre de usuario */}
      <form onSubmit={submitUsername} className="flex flex-wrap items-end gap-4 mb-7">
        <Field label="NOMBRE DE USUARIO" required>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)}
            autoComplete="username" className={`${inputCls} min-w-[220px]`} />
        </Field>
        <Button type="submit"
          disabled={savingName || !username.trim() || username.trim() === user?.username}>
          {savingName ? 'Guardando…' : 'Cambiar usuario'}
        </Button>
      </form>

      {/* Contraseña */}
      <form onSubmit={submitPassword} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="CONTRASEÑA ACTUAL" required>
          <input type="password" value={current} onChange={e => setCurrent(e.target.value)}
            autoComplete="current-password" className={inputCls} />
        </Field>
        <Field label="NUEVA CONTRASEÑA" required hint="Mínimo 8 caracteres.">
          <input type="password" value={next} onChange={e => setNext(e.target.value)}
            autoComplete="new-password" className={inputCls} />
        </Field>
        <Field label="REPITE LA NUEVA" required>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password" className={inputCls} />
        </Field>
        <Button type="submit" disabled={busy || !current || !next} className="md:col-span-3 self-start">
          {busy ? 'Actualizando…' : 'Cambiar contraseña'}
        </Button>
      </form>
    </Section>
  )
}

// ── ④ Usuarios del sistema ──────────────────────────────────────────────────

function UsersSection({ onError, onNotice }) {
  const { user: me } = useAuth()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const [nuevoUsuario, setNuevoUsuario] = useState('')
  const [nuevaClave, setNuevaClave] = useState('')
  const [creando, setCreando] = useState(false)

  const [renameId, setRenameId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [resetId, setResetId] = useState(null)
  const [resetValue, setResetValue] = useState('')

  const load = useCallback(async () => {
    try {
      const { users } = await usersApi.list()
      setUsers(users)
    } catch (err) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => { load() }, [load])

  async function run(action, successMsg) {
    onError(''); onNotice('')
    try {
      const { users } = await action()
      setUsers(users)
      onNotice(successMsg)
      return true
    } catch (err) {
      onError(err.message)
      return false
    }
  }

  async function crear(e) {
    e.preventDefault()
    setCreando(true)
    const ok = await run(
      () => usersApi.create(nuevoUsuario.trim(), nuevaClave),
      `Usuario "${nuevoUsuario.trim()}" creado. Deberá cambiar la contraseña al entrar.`,
    )
    if (ok) { setNuevoUsuario(''); setNuevaClave('') }
    setCreando(false)
  }

  async function renombrar(u) {
    const value = renameValue.trim()
    if (!value || value === u.username) { setRenameId(null); return }
    if (await run(() => usersApi.rename(u.id, value), `"${u.username}" ahora se llama "${value}".`)) {
      setRenameId(null); setRenameValue('')
    }
  }

  async function resetear(u) {
    if (resetValue.length < 8) return onError('La contraseña debe tener al menos 8 caracteres.')
    if (await run(
      () => usersApi.resetPassword(u.id, resetValue),
      `Contraseña de "${u.username}" restablecida. Se cerraron sus sesiones abiertas.`,
    )) {
      setResetId(null); setResetValue('')
    }
  }

  if (loading) return <Section title="④ USUARIOS DEL SISTEMA"><Spinner label="Cargando usuarios…" /></Section>

  return (
    <>
      <Section title="④ CREAR USUARIO">
        <form onSubmit={crear} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <Field label="NOMBRE DE USUARIO" required hint="Mínimo 3 caracteres.">
            <input type="text" value={nuevoUsuario} onChange={e => setNuevoUsuario(e.target.value)}
              placeholder="Ej: operador" autoComplete="off" className={inputCls} />
          </Field>
          <Field label="CONTRASEÑA INICIAL" required hint="Mínimo 8 caracteres.">
            <input type="password" value={nuevaClave} onChange={e => setNuevaClave(e.target.value)}
              placeholder="••••••••" autoComplete="new-password" className={inputCls} />
          </Field>
          <Button type="submit" disabled={creando || !nuevoUsuario.trim() || nuevaClave.length < 8}>
            {creando ? 'Creando…' : '＋ Crear usuario'}
          </Button>
        </form>
      </Section>

      <Section title={`⑤ USUARIOS DEL SISTEMA (${users.length})`}>
        {users.length === 0 ? (
          <EmptyState icon="👥" title="No hay usuarios" />
        ) : (
          <div className="flex flex-col gap-3">
            {users.map(u => {
              const soyYo = u.id === me?.id
              return (
                <div key={u.id}
                  className={`rounded-xl border p-4 ${
                    soyYo ? 'bg-blue-950/20 border-blue-800/40' : 'bg-slate-950/60 border-slate-800/70'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-slate-200">👤 {u.username}</span>
                        {soyYo && <Badge tone="blue">tú</Badge>}
                        {u.mustChangePassword && <Badge tone="slate">⚠️ contraseña sin cambiar</Badge>}
                      </div>
                      <p className="text-xs text-slate-500">Creado el {formatDate(u.createdAt)}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" className="px-3 py-1.5 text-xs"
                        onClick={() => {
                          setRenameId(renameId === u.id ? null : u.id)
                          setRenameValue(u.username); setResetId(null)
                        }}>
                        Renombrar
                      </Button>
                      {!soyYo && (
                        <>
                          <Button variant="ghost" className="px-3 py-1.5 text-xs"
                            onClick={() => {
                              setResetId(resetId === u.id ? null : u.id)
                              setResetValue(''); setRenameId(null)
                            }}>
                            Restablecer contraseña
                          </Button>
                          <Button variant="danger" className="px-3 py-1.5 text-xs"
                            onClick={() => {
                              if (confirm(`¿Eliminar al usuario "${u.username}"?\nPerderá el acceso al sistema de inmediato.`)) {
                                run(() => usersApi.remove(u.id), `Usuario "${u.username}" eliminado.`)
                              }
                            }}>
                            Eliminar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {renameId === u.id && (
                    <div className="mt-3 pt-3 border-t border-slate-800/60">
                      <Field label="NUEVO NOMBRE DE USUARIO">
                        <div className="flex gap-2">
                          <input type="text" value={renameValue} autoFocus
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') renombrar(u) }}
                            className={inputCls} />
                          <Button className="px-3 py-2 text-xs shrink-0" onClick={() => renombrar(u)}>
                            Guardar
                          </Button>
                        </div>
                      </Field>
                    </div>
                  )}

                  {resetId === u.id && (
                    <div className="mt-3 pt-3 border-t border-slate-800/60">
                      <Field label="NUEVA CONTRASEÑA"
                        hint="Se cerrarán sus sesiones y deberá cambiarla al volver a entrar.">
                        <div className="flex gap-2">
                          <input type="password" value={resetValue} autoFocus autoComplete="new-password"
                            onChange={e => setResetValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') resetear(u) }}
                            placeholder="Mínimo 8 caracteres" className={inputCls} />
                          <Button className="px-3 py-2 text-xs shrink-0" onClick={() => resetear(u)}>
                            Restablecer
                          </Button>
                        </div>
                      </Field>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </>
  )
}
