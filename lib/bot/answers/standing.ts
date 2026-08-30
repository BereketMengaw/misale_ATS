/**
 * Where this person actually is, in one sentence the model can read.
 *
 * "When can I start?" means something different from someone who has never
 * applied, someone waiting on a shortlist, and someone hired last week. The
 * bot knew which all along — it is in the database — and answered all three
 * the same way.
 *
 * Every line here is read from a row. Nothing is inferred, so the model is
 * never handed a status that might not be true.
 */
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function standingOf(telegramId: number): Promise<string | null> {
  const db = supabaseAdmin()

  try {
    const { data: candidate } = await db
      .from('candidates')
      .select('id, full_name, area, subjects, grades, cv_path')
      .eq('telegram_id', telegramId)
      .maybeSingle()

    if (!candidate) return 'They have not registered yet.'

    const facts: string[] = ['They are registered.']
    if (candidate.area) facts.push(`They live in ${candidate.area}.`)
    if (!candidate.cv_path) facts.push('They have not sent a CV.')

    const { data: placement } = await db
      .from('placements')
      .select('id, created_at, job_posts(subject, grade, area)')
      .eq('candidate_id', candidate.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (placement) {
      const job = placement.job_posts as unknown as { subject?: string; grade?: string } | null
      facts.push(
        `They have been hired${job?.subject ? ` for ${job.subject}, ${job.grade}` : ''} and are teaching now.`,
      )
      return facts.join(' ')
    }

    const { data: applications } = await db
      .from('applications')
      .select('status, created_at, job_posts(subject, grade, area)')
      .eq('candidate_id', candidate.id)
      .order('created_at', { ascending: false })
      .limit(3)

    if (!applications?.length) {
      facts.push('They have not applied to any job yet.')
      return facts.join(' ')
    }

    const latest = applications[0]
    const job = latest.job_posts as unknown as { subject?: string; grade?: string; area?: string } | null
    const label = job?.subject ? `${job.subject}, ${job.grade}, ${job.area}` : 'a job'

    facts.push(
      applications.length > 1
        ? `They have applied to ${applications.length} jobs, most recently ${label}.`
        : `They have applied to ${label}.`,
    )

    // The word the pipeline uses, said plainly rather than as a status code.
    const said: Record<string, string> = {
      applied: 'They are waiting to hear and have not been shortlisted.',
      shortlisted: 'They have been shortlisted and were sent the terms.',
      accepted: 'They accepted the terms; the family is choosing now.',
      declined: 'They declined the terms for that job.',
      hired: 'They were hired for that job.',
      rejected: 'They were not chosen for that job.',
    }
    if (latest.status && said[latest.status]) facts.push(said[latest.status])

    return facts.join(' ')
  } catch (err) {
    // Answering without knowing who they are beats not answering.
    console.error('could not read standing', err)
    return null
  }
}
