'use client'

import { useActionState } from 'react'
import { createJob, type FormState } from '../actions'
import { Button } from '@/components/ui/button'
import { inputClass as input } from '@/components/ui/styles'

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      {hint && <span className="ml-2 text-xs text-neutral-400">{hint}</span>}
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  )
}

export function JobForm() {
  const [state, action] = useActionState(createJob, {} as FormState)
  const e = state.errors ?? {}

  return (
    <form action={action} className="space-y-4">
      <Field label="Subject" error={e.subject}>
        <input name="subject" className={input} placeholder="Mathematics" required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Grade" error={e.grade}>
          <input name="grade" className={input} placeholder="Grade 9" required />
        </Field>
        <Field label="Area" error={e.area}>
          <input name="area" className={input} placeholder="Bole, Addis Ababa" required />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Days per week" error={e.daysPerWeek}>
          <input name="daysPerWeek" type="number" min={1} max={7} defaultValue={3} className={input} required />
        </Field>
        <Field label="Hours per session" hint="optional" error={e.hoursPerSession}>
          <input name="hoursPerSession" type="number" step="0.5" min={0.5} max={12} className={input} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Pay (ETB)" error={e.rateAmount}>
          <input name="rateAmount" type="number" step="1" min={1} className={input} placeholder="4500" required />
        </Field>
        <Field label="Per" error={e.ratePeriod}>
          <select name="ratePeriod" defaultValue="per_month" className={input}>
            <option value="per_hour">Hour</option>
            <option value="per_session">Session</option>
            <option value="per_month">Month</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Tutor gender" error={e.genderPref}>
          <select name="genderPref" defaultValue="any" className={input}>
            <option value="any">No preference</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </Field>
        <Field label="Starts on" hint="optional" error={e.startsOn}>
          <input name="startsOn" type="date" className={input} />
        </Field>
        <Field label="Commission %" error={e.commissionPercent}>
          <input name="commissionPercent" type="number" step="1" min={0} max={99} defaultValue={20} className={input} />
        </Field>
      </div>

      <Field label="Note for the post" hint="optional — appears in both languages" error={e.notes}>
        <textarea name="notes" rows={2} maxLength={400} className={input} placeholder="Exam preparation, evenings only." />
      </Field>

      {e.form && <p className="text-sm text-red-600">{e.form}</p>}

      <Button variant="primary" pendingLabel="Writing…">
        Write the post
      </Button>
    </form>
  )
}
