import { useApp } from '../context/AppContext'
import FormPage from './FormPage'
import LoadingPage from './LoadingPage'
import DonePage from './DonePage'

export default function GeneratorPage() {
  const { step } = useApp()

  if (step === 'loading') return <LoadingPage />
  if (step === 'done') return <DonePage />
  return <FormPage />
}
