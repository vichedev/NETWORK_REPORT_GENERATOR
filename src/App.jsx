import { AppProvider, useApp } from './context/AppContext'
import Header from './components/Header'
import FormPage from './pages/FormPage'
import LoadingPage from './pages/LoadingPage'
import DonePage from './pages/DonePage'

function Router() {
  const { page } = useApp()
  return (
    <main className="max-w-4xl mx-auto px-5 py-10">
      {page === 'form'    && <FormPage />}
      {page === 'loading' && <LoadingPage />}
      {page === 'done'    && <DonePage />}
    </main>
  )
}

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Header />
        <Router />
      </div>
    </AppProvider>
  )
}
