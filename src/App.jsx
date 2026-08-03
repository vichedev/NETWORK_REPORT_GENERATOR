import { AuthProvider, useAuth } from './context/AuthContext'
import { AppProvider, useApp } from './context/AppContext'
import Header from './components/Header'
import LoginPage from './pages/LoginPage'
import GeneratorPage from './pages/GeneratorPage'
import EmpresasPage from './pages/EmpresasPage'
import HistorialPage from './pages/HistorialPage'
import SettingsPage from './pages/SettingsPage'

function Router() {
  const { page } = useApp()
  return (
    <main className="max-w-5xl mx-auto px-5 py-10">
      {page === 'generator' && <GeneratorPage />}
      {page === 'empresas'  && <EmpresasPage />}
      {page === 'historial' && <HistorialPage />}
      {page === 'ajustes'   && <SettingsPage />}
    </main>
  )
}

function Shell() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-4xl animate-spin">⚡</div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  return (
    <AppProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Header />
        <Router />
      </div>
    </AppProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
