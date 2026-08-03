import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi, ApiError } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [defaultCreds, setDefaultCreds] = useState(null) // pista en la pantalla de login
  const [loading, setLoading] = useState(true)

  const loadStatus = useCallback(async () => {
    try {
      const status = await authApi.status()
      setDefaultCreds(status.usingDefaultCredentials
        ? { username: status.defaultUsername, password: status.defaultPassword }
        : null)
    } catch {
      setDefaultCreds(null)
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const { user } = await authApi.me()
      setUser(user)
    } catch (e) {
      setUser(null)
      if (e instanceof ApiError && e.status === 401) await loadStatus()
    } finally {
      setLoading(false)
    }
  }, [loadStatus])

  useEffect(() => { refresh() }, [refresh])

  const login = useCallback(async (username, password) => {
    const { user } = await authApi.login(username, password)
    setUser(user)
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout() } finally {
      setUser(null)
      await loadStatus()
    }
  }, [loadStatus])

  /** Las pantallas de Ajustes llaman aquí tras cambiar usuario o contraseña. */
  const updateUser = useCallback((next) => setUser(next), [])

  return (
    <AuthContext.Provider value={{
      user, defaultCreds, loading,
      login, logout, refresh, updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
