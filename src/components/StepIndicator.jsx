const STEPS = [
  { n: 1, label: 'Configuración' },
  { n: 2, label: 'Subir imágenes' },
  { n: 3, label: 'Detallar cada imagen' },
  { n: 4, label: 'Generar informe' },
]

export default function StepIndicator({ currentStep = 1 }) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-blue-900/40 mb-8">
      {STEPS.map((step, i) => {
        const done = step.n < currentStep
        const active = step.n === currentStep
        return (
          <div
            key={step.n}
            className={[
              'flex-1 py-3 px-2 text-center text-[11px] font-bold tracking-wider',
              'border-r border-blue-900/40 last:border-r-0',
              done   ? 'bg-blue-900/30 text-blue-300' : '',
              active ? 'bg-blue-800/20 text-blue-400' : '',
              !done && !active ? 'bg-slate-950/60 text-slate-600' : '',
            ].join(' ')}
          >
            <span className={done ? 'text-green-400' : active ? 'text-blue-400' : 'text-slate-600'}>
              {done ? '✓' : step.n}.
            </span>{' '}
            {step.label.toUpperCase()}
          </div>
        )
      })}
    </div>
  )
}
