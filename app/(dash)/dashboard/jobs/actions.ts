'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'
import { normalizeFormData, parseJobFields, toAiFields } from '@/lib/jobs/fields'
import { writePost } from '@/lib/ai/provider'

export type FormState = { errors?: Record<string, string> }

async function currentOperatorId(): Promise<string | null> {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function expiryDays(): Promise<number> {
  const { data } = await supabaseAdmin()
    .from('settings')
    .select('value')
    .eq('key', 'post_expiry_days')
    .maybeSingle()
  const value = Number(data?.value)
  return Number.isFinite(value) && value > 0 ? value : 30
}

export async function createJob(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseJobFields(normalizeFormData(formData))
  if (!parsed.ok) return { errors: parsed.errors }

  const values = parsed.values
  const draft = await writePost(toAiFields(values))

  const days = await expiryDays()
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin()
    .from('job_posts')
    .insert({
      subject: values.subject,
      grade: values.grade,
      area: values.area,
      days_per_week: values.daysPerWeek,
      hours_per_session: values.hoursPerSession,
      rate_amount: values.rateAmount,
      rate_period: values.ratePeriod,
      gender_pref: values.genderPref,
      starts_on: values.startsOn,
      notes: values.notes,
      commission_percent: values.commissionPercent,
      body: draft.body,
      generated_by: draft.generatedBy,
      expires_at: expiresAt,
      created_by: await currentOperatorId(),
    })
    .select('id')
    .single()

  if (error) return { errors: { form: error.message } }

  revalidatePath('/dashboard/jobs')
  redirect(`/dashboard/jobs/${data.id}`)
}

/** Re-run the writer from the stored fields. Discards any hand edits. */
export async function regenerateJob(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'))
  const db = supabaseAdmin()

  const { data: job, error } = await db.from('job_posts').select('*').eq('id', id).single()
  if (error || !job) return

  const draft = await writePost({
    subject: job.subject,
    grade: job.grade,
    area: job.area,
    daysPerWeek: job.days_per_week,
    hoursPerSession: job.hours_per_session,
    rateAmount: Number(job.rate_amount),
    ratePeriod: job.rate_period,
    genderPref: job.gender_pref,
    startsOn: job.starts_on,
    notes: job.notes,
    commissionPercent: Number(job.commission_percent),
  })

  await db
    .from('job_posts')
    .update({
      body: draft.body,
      generated_by: draft.generatedBy,
      body_edited: false,
      approved_at: null,
    })
    .eq('id', id)

  revalidatePath(`/dashboard/jobs/${id}`)
}

/** Hand edits win over the generator until the operator regenerates. */
export async function saveBody(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'))
  const body = String(formData.get('body') ?? '').trim()
  if (!id || !body) return

  await supabaseAdmin()
    .from('job_posts')
    .update({ body, body_edited: true, approved_at: null })
    .eq('id', id)

  revalidatePath(`/dashboard/jobs/${id}`)
}

/**
 * Approve marks the draft ready. It does not publish — step 3 owns the move
 * to `open`, the channels and the Apply deep link.
 */
export async function setApproval(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'))
  const approve = formData.get('approve') === '1'
  if (!id) return

  await supabaseAdmin()
    .from('job_posts')
    .update({ approved_at: approve ? new Date().toISOString() : null })
    .eq('id', id)

  revalidatePath(`/dashboard/jobs/${id}`)
  revalidatePath('/dashboard/jobs')
  revalidatePath('/dashboard')
}

/** Publish an approved job to the selected channels. */
export async function publishToChannels(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'))
  const channelIds = formData
    .getAll('channelIds')
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n))

  if (!id || channelIds.length === 0) return

  const { publishJob } = await import('@/lib/telegram/publish')
  await publishJob(id, channelIds, await currentOperatorId())

  revalidatePath(`/dashboard/jobs/${id}`)
  revalidatePath('/dashboard/jobs')
  revalidatePath('/dashboard')
}

/**
 * A channel the bot cannot post to. The operator pastes the pack, then stamps
 * it here — which is what makes the post countable and closable later.
 */
export async function markManualPosted(formData: FormData): Promise<void> {
  const publicationId = Number(formData.get('publicationId'))
  const jobId = Number(formData.get('id'))
  if (!publicationId) return

  const db = supabaseAdmin()
  await db
    .from('post_publications')
    .update({ posted_at: new Date().toISOString(), posted_by: await currentOperatorId() })
    .eq('id', publicationId)

  await db.from('job_posts').update({ status: 'open' }).eq('id', jobId).eq('status', 'draft')

  revalidatePath(`/dashboard/jobs/${jobId}`)
  revalidatePath('/dashboard/jobs')
  revalidatePath('/dashboard')
}

/** Ask the top N to accept the commission. The 3, then the 5. */
export async function presentTop(formData: FormData): Promise<void> {
  const jobId = Number(formData.get('id'))
  const size = Number(formData.get('size'))
  if (!jobId || !size) return

  const { presentBatch } = await import('@/lib/hiring/service')
  await presentBatch(jobId, size, await currentOperatorId())

  revalidatePath(`/dashboard/jobs/${jobId}`)
  revalidatePath('/dashboard')
}

/**
 * Hire. Closes the job, tells the tutor, tells everyone else honestly, and
 * rewrites every channel post to FILLED.
 */
export async function hire(formData: FormData): Promise<void> {
  const jobId = Number(formData.get('id'))
  const applicationId = Number(formData.get('applicationId'))
  if (!jobId || !applicationId) return

  const { hireCandidate } = await import('@/lib/hiring/service')
  await hireCandidate(applicationId, await currentOperatorId())

  revalidatePath(`/dashboard/jobs/${jobId}`)
  revalidatePath('/dashboard/jobs')
  revalidatePath('/dashboard')
}

/** Attach the parent paying for the lessons. Introductions need someone to introduce to. */
export async function setClient(formData: FormData): Promise<void> {
  const jobId = Number(formData.get('id'))
  const fullName = String(formData.get('clientName') ?? '').trim()
  const phone = String(formData.get('clientPhone') ?? '').trim()
  if (!jobId || !fullName) return

  const db = supabaseAdmin()
  const { data: client } = await db
    .from('clients')
    .insert({ full_name: fullName, phone: phone || null })
    .select('id')
    .single()

  if (client) await db.from('job_posts').update({ client_id: client.id }).eq('id', jobId)

  revalidatePath(`/dashboard/jobs/${jobId}`)
}

/** Message the matching tutors already in the pool. */
export async function messageTalentPool(formData: FormData): Promise<void> {
  const jobId = Number(formData.get('id'))
  if (!jobId) return

  const { sendTalentDms } = await import('@/lib/talent/service')
  await sendTalentDms(jobId)

  revalidatePath(`/dashboard/jobs/${jobId}`)
}

export type ScheduleState = { error?: string; ok?: string }

/**
 * Records what was agreed for the placement. Nothing is scheduled and nothing
 * is sent. It lives with the job's actions because the placement is now shown
 * inside its job rather than on a page of its own.
 */
export async function setSchedule(_prev: ScheduleState, formData: FormData): Promise<ScheduleState> {
  const placementId = Number(formData.get('id'))
  const { DAY_INDEX } = await import('@/lib/placements/schedule')
  const days = formData.getAll('days').map(String).filter((d) => d in DAY_INDEX)
  const time = String(formData.get('time') ?? '').trim()
  const hours = Number(formData.get('hours'))
  const startsOn = String(formData.get('startsOn') ?? '').trim() || null
  const endsOn = String(formData.get('endsOn') ?? '').trim() || null

  if (!placementId) return { error: 'Missing placement.' }
  if (days.length === 0) return { error: 'Pick at least one day.' }

  const { setPlacementSchedule } = await import('@/lib/placements/service')
  const result = await setPlacementSchedule(placementId, { days, time, hours }, startsOn, endsOn)
  if (!result.ok) return { error: result.error }

  const { data: placement } = await supabaseAdmin()
    .from('placements')
    .select('job_post_id')
    .eq('id', placementId)
    .maybeSingle()

  if (placement) revalidatePath(`/dashboard/jobs/${placement.job_post_id}`)
  return { ok: 'Saved.' }
}
