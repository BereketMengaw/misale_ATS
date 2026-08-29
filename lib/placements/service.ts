import { supabaseAdmin } from '@/lib/supabase/admin'
import { isValidSchedule, type Schedule } from './schedule'

/**
 * The application, with the job it is for.
 *
 * The embed names its foreign key on purpose: job_posts.hired_application_id
 * points back at applications, so there are TWO relationships between these
 * tables and an unqualified `job_posts(...)` is rejected as ambiguous.
 */
type HiredApplication = {
  id: number
  job_post_id: number
  candidate_id: number
  commission_percent: number | null
  job_posts: {
    rate_amount: number
    rate_period: string
    commission_percent: number
    client_id: number | null
  } | null
}

const HIRED_APPLICATION_SELECT =
  'id, job_post_id, candidate_id, commission_percent, ' +
  'job_posts!applications_job_post_id_fkey(rate_amount, rate_period, commission_percent, client_id)'

/** Created at hire, with the figures frozen as they were agreed. */
export async function createPlacementFromHire(applicationId: number): Promise<number | null> {
  const db = supabaseAdmin()

  const { data: app, error: appError } = await db
    .from('applications')
    .select(HIRED_APPLICATION_SELECT)
    .eq('id', applicationId)
    .maybeSingle<HiredApplication>()

  if (appError || !app?.job_posts) {
    console.error('createPlacementFromHire could not read the application', appError)
    return null
  }

  const job = app.job_posts

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
        status: 'active',
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

/** Record what was agreed. Nothing is scheduled or sent — it is a note. */
export async function setPlacementSchedule(
  placementId: number,
  schedule: Schedule,
  startsOn: string | null,
  endsOn: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidSchedule(schedule)) return { ok: false, error: 'That schedule is not valid.' }

  const { error } = await supabaseAdmin()
    .from('placements')
    .update({ schedule, starts_on: startsOn, ends_on: endsOn })
    .eq('id', placementId)

  return error ? { ok: false, error: error.message } : { ok: true }
}
