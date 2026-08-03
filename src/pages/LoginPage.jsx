import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Field, Button, Alert, inputCls } from '../components/ui'

export default function LoginPage() {
  const { login, defaultCreds } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function usarPorDefecto() {
    setUsername(defaultCreds.username)
    setPassword(defaultCreds.password)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md animate-fade-in">
        {/* Marca */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-400 flex items-center justify-center text-2xl shadow-lg shadow-blue-500/30 shrink-0">
            📡
          </div>
          <div>
            <h1 className="font-bold text-lg text-blue-400 tracking-widest leading-none">
              NETWORK REPORT GENERATOR
            </h1>
            <p className="text-[10px] text-blue-900 tracking-[0.2em] mt-1">
              ANÁLISIS DE TRÁFICO · ACCESO PRIVADO
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/80 border border-blue-900/30 rounded-2xl p-7 flex flex-col gap-5"
        >
          <div>
            <h2 className="text-sm font-bold text-slate-200 mb-1">Iniciar sesión</h2>
            <p className="text-xs text-slate-500">
              Introduce tus credenciales para acceder al generador de informes.
            </p>
          </div>

          <Alert kind="error">{error}</Alert>

          {/* Pista de las credenciales por defecto, hasta que se cambien */}
          {defaultCreds && (
            <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 py-3 text-xs text-amber-300">
              <p className="font-semibold mb-1.5">🔑 Credenciales por defecto</p>
              <p className="text-amber-400/90 mb-2">
                Usuario <code className="bg-amber-900/40 px-1.5 py-0.5 rounded">{defaultCreds.username}</code>
                {' · '}
                Contraseña <code className="bg-amber-900/40 px-1.5 py-0.5 rounded">{defaultCreds.password}</code>
              </p>
              <p className="text-amber-600 mb-2.5">
                Cámbialas en Ajustes → Mi cuenta en cuanto entres: mientras sigan
                activas, cualquiera que llegue a esta pantalla puede entrar.
              </p>
              <button
                type="button"
                onClick={usarPorDefecto}
                className="underline underline-offset-2 hover:text-amber-200 font-semibold"
              >
                Rellenar automáticamente →
              </button>
            </div>
          )}

          <Field label="USUARIO" required>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              className={inputCls}
              placeholder="admin"
            />
          </Field>

          <Field label="CONTRASEÑA" required>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              className={inputCls}
              placeholder="••••••••"
            />
          </Field>

          <Button type="submit" disabled={busy || !username.trim() || !password} className="w-full py-3.5 mt-1">
            {busy ? 'Un momento…' : 'ENTRAR'}
          </Button>
        </form>

        <p className="text-center text-[11px] text-slate-700 mt-6 tracking-wide">
          Las API keys de IA se gestionan dentro del sistema, en Ajustes.
        </p>
      </div>
    </div>
  )
}
