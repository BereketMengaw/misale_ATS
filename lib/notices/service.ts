import { supabaseAdmin } from '@/lib/supabase/admin'
import { LIVE_STATUSES, noticeTarget, placementLabel, type PlacementRow } from './target'

/**
 * A tutor saying they are stopping.
 *
 * The bot still answers them itself — nobody is left waiting on a reply, which
 * is what the design rule is about. This exists so the operator learns that a
 * family is about to lose their tutor, rather than hearing it from the family.
 *
 * What comes back says which placement it landed on, because the bot has to
 * say so. Filing a notice and then reciting the policy at somebody who has
 * just given it is the machine at its worst: they told us, and we told them to
 * tell us.
 */

export type QuitOutcome =
  /** Recorded against the one live placement they have. */
  | { kind: 'filed'; job: string }
  /** They have said so already and it is still open. Not filed twice. */
  | { kind: 'already'; job: string }
  /** Several live placements. Not filed — the bot asks which. */
  | { kind: 'which'; placements: { id: number; job: string }[] }
  /** Nothing live to leave. The FAQ answer is the right one. */
  | { kind: 'not-placed' }
  | { kind: 'failed' }

export type OpenNotice = {
  id: number
  message: string
  createdAt: string
  tutorName: string | null
  tutorPhone: string | null
  placementId: number | null
  job: string | null
}

/** Every placement of theirs that could still be left. */
async function livePlacements(candidateId: number): Promise<PlacementRow[]> {
  const { data, error } = await supabaseAdmin()
    .from('placements')
    .select('id, status, job_posts(subject, grade, area)')
    .eq('candidate_id', candidateId)
    .in('status', LIVE_STATUSES as unknown as string[])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('could not read placements for a quit notice', error)
    return []
  }

  return (data ?? []).map((row) => {
    const job = row.job_posts as unknown as { subject?: string; grade?: string; area?: string } | null
    return {
      id: row.id as number,
      status: row.status as string,
      subject: job?.subject ?? null,
      grade: job?.grade ?? null,
      area: job?.area ?? null,
    }
  })
}

/** The insert itself. Never throws: a lost record must not cost the tutor a reply. */
async function insertNotice(
  candidateId: number,
  telegramId: number,
  placement: PlacementRow,
  message: string,
): Promise<QuitOutcome> {
  const { error } = await supabaseAdmin().from('quit_notices').insert({
    candidate_id: candidateId,
    placement_id: placement.id,
    telegram_id: telegramId,
    message: message.slice(0, 1000),
  })

  // The partial unique index: they have already said so and it is still open.
  if (error?.code === '23505') return { kind: 'already', job: placementLabel(placement) }
  if (error) {
    console.error('quit notice insert failed', error)
    return { kind: 'failed' }
  }
  return { kind: 'filed', job: placementLabel(placement) }
}

async function candidateIdFor(telegramId: number): Promise<number | null> {
  const { data } = await supabaseAdmin()
    .from('candidates').select('id').eq('telegram_id', telegramId).maybeSingle()
  return (data?.id as number) ?? null
}

/**
 * Files a notice from what somebody typed.
 *
 * Only from somebody who actually has a live placement to leave. Otherwise the
 * queue fills with people who never started, and the one row that means a
 * family is about to lose their tutor is lost among them.
 */
export async function recordQuitNotice(
  telegramId: number,
  message: string,
): Promise<QuitOutcome> {
  try {
    const candidateId = await candidateIdFor(telegramId)
    if (!candidateId) return { kind: 'not-placed' }

    const target = noticeTarget(await livePlacements(candidateId))

    if (target.kind === 'none') return { kind: 'not-placed' }
    if (target.kind === 'which') {
      return {
        kind: 'which',
        placements: target.placements.map((p) => ({ id: p.id, job: placementLabel(p) })),
      }
    }
    return await insertNotice(candidateId, telegramId, target.placement, message)
  } catch (err) {
    console.error('quit notice failed', err)
    return { kind: 'failed' }
  }
}

/**
 * Files a notice against the placement they tapped.
 *
 * The id arrives from a callback, so it is checked against their own live
 * placements before anything is written. A button is not a permission: the id
 * in it is whatever the update says it is.
 */
export async function fileQuitNoticeFor(
  telegramId: number,
  placementId: number,
  message: string,
): Promise<QuitOutcome> {
  try {
    const candidateId = await candidateIdFor(telegramId)
    if (!candidateId) return { kind: 'not-placed' }

    const placement = (await livePlacements(candidateId)).find((p) => p.id === placementId)
    if (!placement) return { kind: 'not-placed' }

    return await insertNotice(candidateId, telegramId, placement, message)
  } catch (err) {
    console.error('quit notice failed', err)
    return { kind: 'failed' }
  }
}

export async function openQuitNotices(): Promise<OpenNotice[]> {
  const { data, error } = await supabaseAdmin()
    .from('quit_notices')
    .select('id, message, created_at, placement_id, candidates(full_name, phone), placements(job_posts(subject, grade, area))')
    .is('handled_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('could not read quit notices', error)
    return []
  }

  return (data ?? []).map((row) => {
    const candidate = row.candidates as unknown as { full_name?: string; phone?: string } | null
    const placement = row.placements as unknown as { job_posts?: { subject?: string; grade?: string; area?: string } } | null
    const job = placement?.job_posts
    return {
      id: row.id as number,
      message: row.message as string,
      createdAt: row.created_at as string,
      tutorName: candidate?.full_name ?? null,
      tutorPhone: candidate?.phone ?? null,
      placementId: (row.placement_id as number) ?? null,
      job: job?.subject ? `${job.subject} · ${job.grade} · ${job.area}` : null,
    }
  })
}
