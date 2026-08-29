export type Tone = 'neutral' | 'green' | 'blue' | 'amber' | 'red' | 'solid-green' | 'faded'

const TONES: Record<Tone, string> = {
  neutral: 'bg-neutral-100 text-neutral-600',
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  'solid-green': 'bg-green-600 text-white',
  faded: 'bg-neutral-100 text-neutral-400',
}

/** One pill. Every status in the app renders through this. */
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  )
}
