import { InlineKeyboard, GrammyError } from 'grammy'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getBot } from '@/lib/bot/bot'
import { logMessage } from '@/lib/bot/log'
import { applicantsFor } from '@/lib/scoring/board'
import {
  commissionAccepted, commissionDeclined, commissionOffer, filledPost,
  hired, notChosen, notChosenAfterShortlist, type JobSummary,
} from './messages'
import { introductionAm } from '@/lib/messaging/parent'

export type Release = 'on_hire' | 'after_first_payment' | 'never'

async function contactRelease(): Promise<Release> {
  const { data } = await supabaseAdmin()
    .from('settings').select('value').eq('key', 'contact_release').maybeSingle()
  const rule = (data?.value as { rule?: string } | null)?.rule
  return rule === 'on_hire' || rule === 'never' ? rule : 'after_first_payment'
}

type JobRow = JobSummary & {
  id: number
  commission_percent: number
  client_id: number | null
  status: string
}

async function loadJob(jobId: number): Promise<JobRow | null> {
  const { data } = await supabaseAdmin()
    .from('job_posts')
    .select('id, subject, grade, area, days_per_week, rate_amount, rate_period, commission_percent, client_id, status')
    .eq('id', jobId)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    subject: data.subject,
    grade: data.grade,
    area: data.area,
    daysPerWeek: data.days_per_week,
    rateAmount: Number(data.rate_amount),
    ratePeriod: data.rate_period,
    commission_percent: Number(data.commission_percent),
    client_id: data.client_id,
    status: data.status,
  }
}

/** Send, but never let one unreachable tutor stop the rest. */
async function tell(chatId: number | null, text: string, keyboard?: InlineKeyboard): Promise<boolean> {
  if (!chatId) return false
  try {
    const bot = await getBot()
    await bot.api.sendMessage(chatId, text, keyboard ? { reply_markup: keyboard } : undefined)
    await logMessage({ direction: 'out', chatId, kind: 'hiring', payload: { text } })
    return true
  } catch (err) {
    // A tutor who blocked the bot must not break a hire.
    console.error('hiring message failed', err instanceof GrammyError ? err.description : err)
    return false
  }
}

// ---------------------------------------------------------------------------
// Presenting: the 3, then the 5
// ---------------------------------------------------------------------------

export type PresentResult = { presented: number; messaged: number; error?: string }

/**
 * Take the top N applicants who have not been presented yet, freeze their
 * scores into a batch, and ask each to accept the commission.
 */
export async function presentBatch(
  jobId: number,
  size: number,
  operatorId: string | null,
): Promise<PresentResult> {
  const db = supabaseAdmin()
  const job = await loadJob(jobId)
  if (!job) return { presented: 0, messaged: 0, error: 'Job not found.' }

  const ranked = await applicantsFor(jobId)
  const eligible = ranked.filter((a) => !a.rank.excluded && a.status === 'applied')
  const chosen = eligible.slice(0, size)

  if (chosen.length === 0) {
    return { presented: 0, messaged: 0, error: 'Nobody new to present.' }
  }

  const { data: batch, error: batchError } = await db
    .from('presentation_batches')
    .insert({ job_post_id: jobId, size: chosen.length, created_by: operatorId })
    .select('id')
    .single()
  if (batchError || !batch) return { presented: 0, messaged: 0, error: batchError?.message }

  await db.from('presentation_items').insert(
    chosen.map((a, i) => ({
      batch_id: batch.id,
      application_id: a.applicationId,
      rank_at_time: i + 1,
      score_at_time: a.rank.score,
    })),
  )

  const offer = commissionOffer(job, job.commission_percent)
  let messaged = 0

  for (const a of chosen) {
    const { data: candidate } = await db
      .from('candidates').select('chat_id').eq('id', a.candidateId).maybeSingle()

    const sent = await tell(
      candidate?.chat_id ?? null,
      offer,
      new InlineKeyboard()
        .text('Accept', `comm:${a.applicationId}:yes`)
        .text('Decline', `comm:${a.applicationId}:no`),
    )
    if (sent) messaged++

    await db
      .from('applications')
      .update({
        status: 'shortlisted',
        score: a.rank.score,
        score_breakdown: { breakdown: a.rank.breakdown },
        commission_percent: job.commission_percent,
      })
      .eq('id', a.applicationId)
  }

  return { presented: chosen.length, messaged }
}

// ---------------------------------------------------------------------------
// The tutor's answer
// ---------------------------------------------------------------------------

export async function recordCommissionDecision(
  applicationId: number,
  accepted: boolean,
): Promise<string | null> {
  const db = supabaseAdmin()

  const { data: app } = await db
    .from('applications')
    .select('id, job_post_id, status')
    .eq('id', applicationId)
    .maybeSingle()
  if (!app) return null

  // Once a job is decided, a late tap must not reopen anything.
  const job = await loadJob(app.job_post_id)
  if (!job || job.status !== 'open') return null
  if (app.status !== 'shortlisted') return null

  await db
    .from('applications')
    .update({
      status: accepted ? 'commission_agreed' : 'rejected',
      commission_at: accepted ? new Date().toISOString() : null,
      decided_at: new Date().toISOString(),
    })
    .eq('id', applicationId)

  return accepted ? commissionAccepted(job) : commissionDeclined(job)
}

// ---------------------------------------------------------------------------
// The hire, and everything that has to follow it
// ---------------------------------------------------------------------------

export type HireResult = {
  ok: boolean
  error?: string
  postsEdited?: number
  postsFailed?: number
  toldShortlisted?: number
  toldOthers?: number
  parentMessage?: string
}

export async function hireCandidate(applicationId: number, operatorId: string | null): Promise<HireResult> {
  const db = supabaseAdmin()

  const { data: app } = await db
    .from('applications')
    .select('id, job_post_id, candidate_id, status')
    .eq('id', applicationId)
    .maybeSingle()
  if (!app) return { ok: false, error: 'Application not found.' }

  const job = await loadJob(app.job_post_id)
  if (!job) return { ok: false, error: 'Job not found.' }
  if (job.status !== 'open') return { ok: false, error: 'This job is already closed.' }

  const release = await contactRelease()

  const [{ data: candidate }, { data: client }] = await Promise.all([
    db.from('candidates').select('id, full_name, phone, chat_id').eq('id', app.candidate_id).maybeSingle(),
    job.client_id
      ? db.from('clients').select('full_name, phone').eq('id', job.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const parentName = client?.full_name?.split(' ')[0] ?? 'the family'

  // 1. The hire itself.
  await db
    .from('applications')
    .update({ status: 'hired', decided_at: new Date().toISOString() })
    .eq('id', applicationId)

  await db
    .from('job_posts')
    .update({
      status: 'closed_filled',
      hired_application_id: applicationId,
      closed_at: new Date().toISOString(),
    })
    .eq('id', job.id)

  // 2. The placement: the figures as agreed, frozen away from later edits.
  const { createPlacementFromHire } = await import('@/lib/placements/service')
  await createPlacementFromHire(applicationId)

  // 3. Tell the tutor who got it.
  await tell(
    candidate?.chat_id ?? null,
    hired(job, parentName, job.commission_percent, release, client?.phone ?? null),
  )

  // 4. Close out everyone else. Nobody is left waiting on a reply that never comes.
  const { data: others } = await db
    .from('applications')
    .select('id, status, candidates(chat_id)')
    .eq('job_post_id', job.id)
    .neq('id', applicationId)

  let toldShortlisted = 0
  let toldOthers = 0

  for (const other of others ?? []) {
    const chatId = (other.candidates as unknown as { chat_id: number | null } | null)?.chat_id ?? null
    const wasShortlisted = other.status === 'shortlisted' || other.status === 'commission_agreed'

    const sent = await tell(chatId, wasShortlisted ? notChosenAfterShortlist(job) : notChosen(job))
    if (sent) wasShortlisted ? toldShortlisted++ : toldOthers++

    await db
      .from('applications')
      .update({
        status: wasShortlisted ? 'rejected' : 'pooled',
        closed_message_at: sent ? new Date().toISOString() : null,
      })
      .eq('id', other.id)
  }

  // 5. Rewrite every channel post in place: it keeps its views and position.
  const posts = await markPostsFilled(job.id)

  return {
    ok: true,
    ...posts,
    toldShortlisted,
    toldOthers,
    parentMessage: candidate ? buildParentIntro(candidate.full_name, candidate.phone, job, release) : undefined,
  }
}

/** Amharic: this is the one message in the system a family actually reads. */
function buildParentIntro(
  tutorName: string | null,
  tutorPhone: string | null,
  job: JobSummary,
  release: Release,
): string {
  return introductionAm(
    tutorName ?? 'አስተማሪዎ',
    tutorPhone,
    { subject: job.subject, grade: job.grade, area: job.area, daysPerWeek: job.daysPerWeek },
    release === 'on_hire',
  )
}

/**
 * Edit each channel post to FILLED and take the Apply button off. Editing in
 * place keeps the post's views and position; deleting and reposting loses both.
 */
export async function markPostsFilled(jobId: number): Promise<{ postsEdited: number; postsFailed: number }> {
  const db = supabaseAdmin()

  const { data: job } = await db.from('job_posts').select('body').eq('id', jobId).maybeSingle()
  const { data: publications } = await db
    .from('post_publications')
    .select('id, message_id, channels(chat_id)')
    .eq('job_post_id', jobId)
    .not('message_id', 'is', null)

  if (!job || !publications?.length) return { postsEdited: 0, postsFailed: 0 }

  const body = filledPost(job.body)
  let postsEdited = 0
  let postsFailed = 0

  for (const p of publications) {
    const chatId = (p.channels as unknown as { chat_id: number | null } | null)?.chat_id
    if (!chatId || !p.message_id) continue

    try {
      const bot = await getBot()
      await bot.api.editMessageText(chatId, p.message_id, body, { reply_markup: undefined })
      await db.from('post_publications').update({ closed_at: new Date().toISOString() }).eq('id', p.id)
      postsEdited++
    } catch (err) {
      const detail = err instanceof GrammyError ? err.description : String(err)
      // "message is not modified" means it already says FILLED — not a failure.
      if (detail.includes('not modified')) {
        postsEdited++
      } else {
        console.error('could not mark post filled', detail)
        await db.from('post_publications').update({ error: detail }).eq('id', p.id)
        postsFailed++
      }
    }
  }

  return { postsEdited, postsFailed }
}
