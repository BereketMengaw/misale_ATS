import { InlineKeyboard, GrammyError } from 'grammy'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getBot } from '@/lib/bot/bot'
import { logMessage } from '@/lib/bot/log'
import { rank, type RankableJob } from '@/lib/scoring/rank'
import { rankingWeights } from '@/lib/scoring/board'
import { split } from '@/lib/money/commission'
import { DEFAULT_RULES, selectForDm, type MatchRules, type PoolCandidate, type Skipped } from './select'
import type { Availability } from '@/lib/candidates/availability'

const PERIOD: Record<string, string> = {
  per_hour: 'per hour',
  per_session: 'per session',
  per_month: 'per month',
}

/** The DM itself. Short — it is unsolicited, so it earns attention or gets muted. */
export function talentDm(job: {
  subject: string; grade: string; area: string; daysPerWeek: number
  rateAmount: number; ratePeriod: string; commissionPercent: number
}): string {
  const net = split(job.rateAmount, job.commissionPercent)
  return [
    'A job came up that fits your profile:',
    '',
    `${job.subject}, ${job.grade}, ${job.area}`,
    `${job.daysPerWeek} days a week · ${(net.netCents / 100).toLocaleString()} ETB ${PERIOD[job.ratePeriod] ?? ''} to you`,
    '',
    'One tap to apply — we already have your details.',
  ].join('\n')
}

async function matchRules(): Promise<MatchRules> {
  const { data } = await supabaseAdmin()
    .from('settings').select('value').eq('key', 'talent_match').maybeSingle()
  const v = (data?.value ?? {}) as Partial<{ min_score: number; max_per_job: number; cooldown_days: number }>
  return {
    minScore: v.min_score ?? DEFAULT_RULES.minScore,
    maxPerJob: v.max_per_job ?? DEFAULT_RULES.maxPerJob,
    cooldownDays: v.cooldown_days ?? DEFAULT_RULES.cooldownDays,
  }
}

export type PoolPreview = {
  jobId: number
  chosen: { candidateId: number; name: string; score: number }[]
  /** Everyone the rules ruled out, and the rule that ruled them out. */
  skipped: (Skipped & { name: string })[]
  rules: MatchRules
}

/** Who would be messaged, and why the rest would not be. Sends nothing. */
export async function previewPool(jobId: number): Promise<PoolPreview | null> {
  const db = supabaseAdmin()

  const [{ data: job }, weights, rules] = await Promise.all([
    db.from('job_posts')
      .select('id, subject, grade, area, days_per_week, gender_pref, status')
      .eq('id', jobId).maybeSingle(),
    rankingWeights(),
    matchRules(),
  ])
  if (!job || job.status !== 'open') return null

  const rankable: RankableJob = {
    subject: job.subject, grade: job.grade, area: job.area,
    daysPerWeek: job.days_per_week, genderPref: job.gender_pref,
  }

  const [{ data: candidates }, { data: applied }, { data: matched }] = await Promise.all([
    db.from('candidates')
      .select('id, full_name, chat_id, subjects, grades, area, availability, experience, education, gender, rating')
      .eq('status', 'active'),
    db.from('applications').select('candidate_id').eq('job_post_id', jobId),
    db.from('talent_matches').select('candidate_id').eq('job_post_id', jobId),
  ])

  const hasApplied = new Set((applied ?? []).map((a) => a.candidate_id))
  const alreadyMatched = new Set((matched ?? []).map((m) => m.candidate_id))

  // One query for everyone's last DM, rather than one per candidate.
  const { data: lastDms } = await db
    .from('talent_matches')
    .select('candidate_id, sent_at')
    .not('sent_at', 'is', null)
    .order('sent_at', { ascending: false })

  const lastDmBy = new Map<number, string>()
  for (const row of lastDms ?? []) {
    if (!lastDmBy.has(row.candidate_id)) lastDmBy.set(row.candidate_id, row.sent_at as string)
  }

  const names = new Map<number, string>()
  const pool: PoolCandidate[] = (candidates ?? []).map((c) => {
    names.set(c.id, c.full_name ?? 'Unnamed')
    const r = rank(
      rankable,
      {
        subjects: c.subjects ?? [], grades: c.grades ?? [], area: c.area,
        availability: c.availability as Availability | null,
        experience: c.experience, education: c.education, rating: c.rating, gender: c.gender,
      },
      weights,
    )
    return {
      candidateId: c.id,
      score: r.score,
      excluded: r.excluded,
      hasApplied: hasApplied.has(c.id),
      alreadyMatched: alreadyMatched.has(c.id),
      lastDmAt: lastDmBy.get(c.id) ?? null,
      reachable: Boolean(c.chat_id),
    }
  })

  const { chosen, skipped } = selectForDm(pool, rules)

  return {
    jobId,
    chosen: chosen.map((c) => ({ candidateId: c.candidateId, name: names.get(c.candidateId) ?? 'Unnamed', score: c.score })),
    skipped: skipped.map((x) => ({ ...x, name: names.get(x.candidateId) ?? 'Unnamed' })),
    rules,
  }
}

export type SendResult = { sent: number; failed: number; error?: string }

/** Send the DMs the preview chose. Records every one, so nobody is asked twice. */
export async function sendTalentDms(jobId: number): Promise<SendResult> {
  const db = supabaseAdmin()
  const preview = await previewPool(jobId)
  if (!preview) return { sent: 0, failed: 0, error: 'Job is not open.' }
  if (preview.chosen.length === 0) return { sent: 0, failed: 0, error: 'Nobody new to message.' }

  const { data: job } = await db
    .from('job_posts')
    .select('subject, grade, area, days_per_week, rate_amount, rate_period, commission_percent')
    .eq('id', jobId)
    .maybeSingle()
  if (!job) return { sent: 0, failed: 0, error: 'Job not found.' }

  const text = talentDm({
    subject: job.subject, grade: job.grade, area: job.area,
    daysPerWeek: job.days_per_week, rateAmount: Number(job.rate_amount),
    ratePeriod: job.rate_period, commissionPercent: Number(job.commission_percent),
  })

  let sent = 0
  let failed = 0

  for (const c of preview.chosen) {
    const { data: candidate } = await db
      .from('candidates').select('chat_id').eq('id', c.candidateId).maybeSingle()
    if (!candidate?.chat_id) { failed++; continue }

    let error: string | null = null
    try {
      const bot = await getBot()
      // The same apply: button the channel post uses, so one tap is enough.
      await bot.api.sendMessage(candidate.chat_id, text, {
        reply_markup: new InlineKeyboard().text('Apply for this job', `apply:${jobId}`),
      })
      await logMessage({ direction: 'out', chatId: candidate.chat_id, kind: 'talent_dm', payload: { text } })
      sent++
    } catch (err) {
      error = err instanceof GrammyError ? err.description : String(err)
      failed++
    }

    await db.from('talent_matches').upsert(
      {
        job_post_id: jobId,
        candidate_id: c.candidateId,
        score: c.score,
        sent_at: error ? null : new Date().toISOString(),
        error,
      },
      { onConflict: 'job_post_id,candidate_id' },
    )
  }

  return { sent, failed }
}

/** Called when someone applies, so the DM channel's worth is measurable. */
export async function markTalentApplied(jobId: number, candidateId: number): Promise<void> {
  await supabaseAdmin()
    .from('talent_matches')
    .update({ applied_at: new Date().toISOString() })
    .eq('job_post_id', jobId)
    .eq('candidate_id', candidateId)
    .is('applied_at', null)
}
