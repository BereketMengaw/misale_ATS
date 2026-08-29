export type PhaseState = 'done' | 'current' | 'todo'

function Mark({ state }: { state: PhaseState }) {
  if (state === 'done') {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
        <path d="M4 12.5l5.5 5.5L20 6" />
      </svg>
    )
  }
  if (state === 'current') {
    return <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-neutral-900 ring-4 ring-neutral-200" aria-hidden="true" />
  }
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-neutral-300" aria-hidden="true" />
}

/**
 * One step in a job's life. Finished steps collapse to a line that still
 * carries their numbers; only the step he is actually on opens itself.
 *
 * Before this the page rendered all eight panels at once, so a fresh draft
 * showed an empty applicant list, an empty talent pool and a publish panel
 * saying "approve it first" — four dead sections and one live one.
 */
export function Phase({
  id,
  title,
  summary,
  state,
  children,
}: {
  id: string
  title: string
  summary: React.ReactNode
  state: PhaseState
  children: React.ReactNode
}) {
  return (
    <details
      id={id}
      open={state === 'current'}
      className={`group rounded-md border bg-white ${
        state === 'current' ? 'border-neutral-300' : state === 'todo' ? 'border-dashed border-neutral-300' : 'border-neutral-200'
      }`}
    >
      <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-4">
        <Mark state={state} />
        <span className={`text-sm font-medium ${state === 'todo' ? 'text-neutral-500' : ''}`}>{title}</span>
        <span className="text-xs text-neutral-500">{summary}</span>
        <span className="grow" />
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="#a3a3a3"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 transition-transform group-open:rotate-90"
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </summary>
      <div className="border-t border-neutral-100 p-4">{children}</div>
    </details>
  )
}

/** The whole life of the job, in one line, so he can see where it stopped. */
export function Stepper({ steps }: { steps: { label: string; state: PhaseState }[] }) {
  return (
    <ol className="flex rounded-md border border-neutral-200 bg-white p-4">
      {steps.map((step, i) => (
        <li key={step.label} className="flex min-w-0 grow flex-col gap-2">
          <div className="flex items-center">
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                step.state === 'done'
                  ? 'bg-green-600'
                  : step.state === 'current'
                    ? 'bg-neutral-900 ring-4 ring-neutral-200'
                    : 'border-2 border-neutral-200 bg-white'
              }`}
            >
              {step.state === 'done' && (
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 12.5l5.5 5.5L20 6" />
                </svg>
              )}
            </span>
            {i < steps.length - 1 && (
              <span className={`h-0.5 grow ${step.state === 'done' ? 'bg-green-600' : 'bg-neutral-200'}`} />
            )}
          </div>
          <span
            className={`truncate text-xs ${
              step.state === 'current' ? 'font-medium text-neutral-900' : step.state === 'done' ? 'text-neutral-500' : 'text-neutral-400'
            }`}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  )
}
