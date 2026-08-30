'use client'

import { ALL_SUBJECTS, DEFAULT_SUBJECTS } from '@/lib/candidates/options'

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

/** The stored answers, for the edit case. Absent means a blank new job. */
export type JobDefaults = {
  id: number
  subject: string
  grade: string
  area: string
  daysPerWeek: number
  hoursPerSession: number | null
  rateAmount: number
  ratePeriod: string
  genderPref: string
  startsOn: string | null
  notes: string | null
  commissionPercent: number
}

/**
 * One form, two jobs: writing a new post and correcting an existing one. The
 * fields are the same either way, so they are not written out twice.
 */
export function JobForm({
  action: serverAction = createJob,
  initial,
  submitLabel = 'Write the post',
  pendingLabel = 'Writing…',
}: {
  action?: (prev: FormState, formData: FormData) => Promise<FormState>
  initial?: JobDefaults
  submitLabel?: string
  pendingLabel?: string
} = {}) {
  const [state, action] = useActionState(serverAction, {} as FormState)
  const e = state.errors ?? {}

  return (
    <form action={action} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {/*
        Grade leads, because that is what families hire on: a tutor takes
        grade 5 and teaches everything in it. Subject follows, and defaults to
        every subject — a post for one named subject is the exception here,
        not the rule, and the form used to assume the opposite.
      */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Grade" error={e.grade}>
          <input name="grade" defaultValue={initial?.grade} className={input} placeholder="Grade 9" required />
        </Field>
        <Field label="Area" error={e.area}>
          <input name="area" defaultValue={initial?.area} className={input} placeholder="Bole, Addis Ababa" required />
        </Field>
      </div>

      <Field label="Subject" error={e.subject}>
        <select name="subject" defaultValue={initial?.subject ?? ALL_SUBJECTS} className={input} required>
          <option value={ALL_SUBJECTS}>{ALL_SUBJECTS}</option>
          {DEFAULT_SUBJECTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
          {initial?.subject && ![ALL_SUBJECTS, ...DEFAULT_SUBJECTS].includes(initial.subject) && (
            <option value={initial.subject}>{initial.subject}</option>
          )}
        </select>
        <p className="mt-1 text-xs text-neutral-500">
          Leave as “{ALL_SUBJECTS}” unless the family wants one subject only. Only a tutor
          who teaches everything is matched to an all-subjects post.
        </p>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Days per week" error={e.daysPerWeek}>
          <input name="daysPerWeek" type="number" min={1} max={7} defaultValue={initial?.daysPerWeek ?? 3} className={input} required />
        </Field>
        <Field label="Hours per session" hint="optional" error={e.hoursPerSession}>
          <input name="hoursPerSession" type="number" step="0.5" min={0.5} max={12} defaultValue={initial?.hoursPerSession ?? undefined} className={input} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Pay (ETB)" error={e.rateAmount}>
          <input name="rateAmount" type="number" step="1" min={1} defaultValue={initial?.rateAmount} className={input} placeholder="4500" required />
        </Field>
        <Field label="Per" error={e.ratePeriod}>
          <select name="ratePeriod" defaultValue={initial?.ratePeriod ?? 'per_month'} className={input}>
            <option value="per_hour">Hour</option>
            <option value="per_session">Session</option>
            <option value="per_month">Month</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Tutor gender" error={e.genderPref}>
          <select name="genderPref" defaultValue={initial?.genderPref ?? 'any'} className={input}>
            <option value="any">No preference</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </Field>
        <Field label="Starts on" hint="optional" error={e.startsOn}>
          <input name="startsOn" type="date" defaultValue={initial?.startsOn ?? undefined} className={input} />
        </Field>
        <Field label="Commission %" error={e.commissionPercent}>
          <input name="commissionPercent" type="number" step="1" min={0} max={99} defaultValue={initial?.commissionPercent ?? 20} className={input} />
        </Field>
      </div>

      <Field label="Note for the post" hint="optional — appears in both languages" error={e.notes}>
        <textarea name="notes" rows={2} maxLength={400} defaultValue={initial?.notes ?? undefined} className={input} placeholder="Exam preparation, evenings only." />
      </Field>

      {e.form && <p className="text-sm text-red-600">{e.form}</p>}

      <Button variant="primary" pendingLabel={pendingLabel}>
        {submitLabel}
      </Button>
    </form>
  )
}
