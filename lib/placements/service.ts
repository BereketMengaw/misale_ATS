import { InlineKeyboard, GrammyError } from 'grammy'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getBot } from '@/lib/bot/bot'
import { logMessage } from '@/lib/bot/log'
import { dueForConfirmation, dueForReminder, formatEat, generateSessions, isValidSchedule, type Schedule } from './schedule'

/** Created at hire, with the figures frozen as they were agreed. */
export async function createPlacementFromHire(applicationId: number): Promise<number | null> {
  const db = supabaseAdmin()

  const { data: app } = await db
    .from('applications')
    .select('id, job_post_id, candidate_id, commission_percent, job_posts(rate_amount, rate_period, commission_percent, client_id)')
    .eq('id', applicationId)
    .maybeSingle()
  if (!app) return null

  const job = app.job_posts as unknown as {
    rate_amount: number; rate_period: string; commission_percent: number; client_id: number | null
  } | null
  if (!job) return null

  const { data, error } = await db
    .from('placements')
    .upsert(
      {
        job_post_id: app.job_post_id,
        candidate_id: app.candidate_id,
        client_id: job.client_id,
        rate_amount: job.rate_amount,
        rate_period: job.rate_period,
        // What the tutor accepted, not what the job says today.
        commission_percent: app.commission_percent ?? job.commission_percent,
      },
      { onConflict: 'job_post_id,candidate_id' },
    )
    .select('id')
    .single()

  if (error) {
    console.error('createPlacementFromHire failed', error)
    return null
  }
  return data.id
}

/**
 * Lay out the lessons. Re-running only adds what is missing: the unique
 * (placement, scheduled_at) means an operator can extend the end date without
 * duplicating or losing anything already confirmed.
 */
export async function scheduleSessions(
  placementId: number,
  schedule: Schedule,
  startsOn: string,
  endsOn: string,
): Promise<{ created: number; error?: string }> {
  if (!isValidSchedule(schedule)) return { created: 0, error: 'That schedule is not valid.' }

  const db = supabaseAdmin()
  const times = generateSessions(schedule, startsOn, endsOn)
  if (times.length === 0) return { created: 0, error: 'That produces no lessons.' }

  await db
    .from('placements')
    .update({ schedule, starts_on: startsOn, ends_on: endsOn, status: 'active' })
    .eq('id', placementId)

  const { data, error } = await db
    .from('sessions')
    .upsert(
      times.map((t) => ({
        placement_id: placementId,
        scheduled_at: t.toISOString(),
        planned_hours: schedule.hours,
      })),
      { onConflict: 'placement_id,scheduled_at', ignoreDuplicates: true },
    )
    .select('id')

  if (error) return { created: 0, error: error.message }
  return { created: data?.length ?? 0 }
}

async function reminderSettings(): Promise<{ leadMinutes: number }> {
  const { data } = await supabaseAdmin()
    .from('settings').select('value').eq('key', 'reminders').maybeSingle()
  const v = (data?.value ?? {}) as { lead_minutes?: number }
  return { leadMinutes: v.lead_minutes ?? 120 }
}

async function send(chatId: number | null, text: string, keyboard?: InlineKeyboard): Promise<boolean> {
  if (!chatId) return false
  try {
    const bot = await getBot()
    await bot.api.sendMessage(chatId, text, keyboard ? { reply_markup: keyboard } : undefined)
    await logMessage({ direction: 'out', chatId, kind: 'lesson', payload: { text } })
    return true
  } catch (err) {
    console.error('lesson message failed', err instanceof GrammyError ? err.description : err)
    return false
  }
}

type DueRow = {
  id: number
  scheduled_at: string
  planned_hours: number
  reminder_sent_at: string | null
  asked_at: string | null
  confirmed_at: string | null
  placements: {
    id: number
    candidates: { chat_id: number | null; full_name: string | null } | null
    job_posts: { subject: string; grade: string; area: string } | null
  } | null
}

async function loadDue(): Promise<DueRow[]> {
  // A generous window: the cron may be running hourly or daily, and a session
  // that slipped past one run must still be picked up by the next.
  const from = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
  const to = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString()

  const { data } = await supabaseAdmin()
    .from('sessions')
    .select(
      'id, scheduled_at, planned_hours, reminder_sent_at, asked_at, confirmed_at, ' +
        'placements(id, candidates(chat_id, full_name), job_posts(subject, grade, area))',
    )
    .in('status', ['scheduled', 'reminded'])
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)
    .returns<DueRow[]>()

  return data ?? []
}

export type CronResult = { reminded: number; asked: number }

/**
 * One pass: remind what is about to happen, and ask about what has finished.
 * Idempotent — safe to run every minute or once a day, and safe to run twice.
 */
export async function runLessonCron(now: Date = new Date()): Promise<CronResult> {
  const db = supabaseAdmin()
  const [{ leadMinutes }, rows] = await Promise.all([reminderSettings(), loadDue()])

  const shaped = rows.map((r) => ({
    row: r,
    scheduledAt: new Date(r.scheduled_at),
    hours: Number(r.planned_hours),
    reminderSentAt: r.reminder_sent_at ? new Date(r.reminder_sent_at) : null,
    askedAt: r.asked_at ? new Date(r.asked_at) : null,
    confirmedAt: r.confirmed_at ? new Date(r.confirmed_at) : null,
  }))

  let reminded = 0
  for (const s of dueForReminder(shaped, now, leadMinutes)) {
    const job = s.row.placements?.job_posts
    const chatId = s.row.placements?.candidates?.chat_id ?? null
    const sent = await send(
      chatId,
      [
        'Lesson reminder',
        '',
        job ? `${job.subject}, ${job.grade}, ${job.area}` : 'Your lesson',
        formatEat(s.scheduledAt),
        `${s.hours} hour${s.hours === 1 ? '' : 's'}`,
      ].join('\n'),
    )
    await db
      .from('sessions')
      .update({ reminder_sent_at: new Date().toISOString(), status: 'reminded' })
      .eq('id', s.row.id)
    if (sent) reminded++
  }

  let asked = 0
  for (const s of dueForConfirmation(shaped, now)) {
    const chatId = s.row.placements?.candidates?.chat_id ?? null
    const kb = new InlineKeyboard()
    for (const h of [1, 1.5, 2, 2.5, 3]) kb.text(`${h}h`, `hrs:${s.row.id}:${h}`)
    kb.row().text("Didn't happen", `hrs:${s.row.id}:0`)

    const sent = await send(
      chatId,
      [`How long was the lesson on ${formatEat(s.scheduledAt)}?`, '', 'Tap the hours you taught.'].join('\n'),
      kb,
    )
    await db.from('sessions').update({ asked_at: new Date().toISOString() }).eq('id', s.row.id)
    if (sent) asked++
  }

  return { reminded, asked }
}

/** The tutor's answer. 0 hours means the lesson did not happen. */
export async function confirmHours(
  sessionId: number,
  hours: number,
  telegramId: number,
): Promise<string | null> {
  const db = supabaseAdmin()

  const { data: session } = await db
    .from('sessions')
    .select('id, scheduled_at, confirmed_at, placements(candidates(telegram_id))')
    .eq('id', sessionId)
    .maybeSingle()
  if (!session) return null

  // Only the tutor on the placement may confirm their own hours.
  const owner = (session.placements as unknown as { candidates: { telegram_id: number } | null } | null)?.candidates
  if (!owner || owner.telegram_id !== telegramId) return null
  if (session.confirmed_at) return 'Already recorded — thank you.'

  await db
    .from('sessions')
    .update({
      confirmed_hours: hours,
      confirmed_at: new Date().toISOString(),
      confirmed_by: telegramId,
      status: hours > 0 ? 'confirmed' : 'missed',
    })
    .eq('id', sessionId)

  return hours > 0
    ? `Recorded: ${hours} hour${hours === 1 ? '' : 's'}. Thank you.`
    : 'Recorded as not taught. Thank you for saying.'
}
