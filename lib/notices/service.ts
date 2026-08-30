import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * A tutor saying they are stopping.
 *
 * The bot still answers them itself — nobody is left waiting on a reply, which
 * is what the design rule is about. This exists so the operator learns that a
 * family is about to lose their tutor, rather than hearing it from the family.
 */

export type OpenNotice = {
  id: number
  message: string
  createdAt: string
  tutorName: string | null
  tutorPhone: string | null
  placementId: number | null
  job: string | null
}

/** Files a notice. Never throws: a lost record must not cost the tutor a reply. */
export async function recordQuitNotice(
  telegramId: number,
  message: string,
): Promise<'filed' | 'already' | 'not-placed' | 'failed'> {
  try {
    const db = supabaseAdmin()

    const { data: candidate } = await db
      .from('candidates').select('id').eq('telegram_id', telegramId).maybeSingle()
    if (!candidate) return 'not-placed'

    const { data: placement } = await db
      .from('placements')
      .select('id')
      .eq('candidate_id', candidate.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Only from somebody who actually has a placement to leave. Otherwise the
    // queue fills with people who never started, and the one row that means a
    // family is about to lose their tutor is lost among them.
    if (!placement) return 'not-placed'

    const { error } = await db.from('quit_notices').insert({
      candidate_id: candidate.id,
      placement_id: placement.id,
      telegram_id: telegramId,
      message: message.slice(0, 1000),
    })

    // The partial unique index: they have already said so and it is still open.
    if (error?.code === '23505') return 'already'
    if (error) {
      console.error('quit notice insert failed', error)
      return 'failed'
    }
    return 'filed'
  } catch (err) {
    console.error('quit notice failed', err)
    return 'failed'
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
