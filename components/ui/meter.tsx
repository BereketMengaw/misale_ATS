/**
 * A 0–100 bar. Used for an applicant's score and a candidate's completeness —
 * the same shape means the same thing in both places.
 */
export function Meter({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  const tone = clamped >= 75 ? 'bg-green-600' : clamped >= 50 ? 'bg-amber-500' : 'bg-neutral-400'

  return (
    <div className="flex shrink-0 items-center gap-2" title={label ?? `${clamped} of 100`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200">
        <div className={`h-full ${tone}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="w-8 text-right text-sm font-medium tabular-nums">{clamped}</span>
    </div>
  )
}

/** A figure and what it counts. */
export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'good' | 'warn'
}) {
  const colour = tone === 'good' ? 'text-green-800' : tone === 'warn' ? 'text-amber-700' : ''
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${colour}`}>{value}</p>
      {sub && <p className="text-xs text-neutral-400">{sub}</p>}
    </div>
  )
}
