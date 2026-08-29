'use client'

import { useActionState } from 'react'
import { setSchedule, type ScheduleState } from '../actions'
import { DAYS } from '@/lib/candidates/options'

const input =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none'

export function ScheduleForm({
  placementId,
  current,
  startsOn,
  endsOn,
}: {
  placementId: number
  current: { days?: string[]; time?: string; hours?: number } | null
  startsOn: string | null
  endsOn: string | null
}) {
  const [state, action, pending] = useActionState(setSchedule, {} as ScheduleState)
  const chosen = new Set(current?.days ?? [])

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={placementId} />

      <div>
        <span className="text-sm font-medium text-neutral-700">Days</span>
        <div className="mt-1 flex flex-wrap gap-3">
          {DAYS.map((d) => (
            <label key={d.value} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="days" value={d.value} defaultChecked={chosen.has(d.value)} />
              {d.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">Time</span>
          <input name="time" type="time" defaultValue={current?.time ?? '17:00'} className={`mt-1 ${input}`} required />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">Hours</span>
          <input name="hours" type="number" step="0.5" min={0.5} max={12} defaultValue={current?.hours ?? 2} className={`mt-1 ${input}`} required />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">From</span>
          <input name="startsOn" type="date" defaultValue={startsOn ?? ''} className={`mt-1 ${input}`} required />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">Until</span>
          <input name="endsOn" type="date" defaultValue={endsOn ?? ''} className={`mt-1 ${input}`} required />
        </label>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}

      <button
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Scheduling…' : 'Schedule lessons'}
      </button>
      <p className="text-xs text-neutral-400">
        Times are Addis time. Re-running only adds what is missing — nothing already confirmed is touched.
      </p>
    </form>
  )
}
