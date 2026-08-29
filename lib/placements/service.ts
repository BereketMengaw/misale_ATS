import { supabaseAdmin } from '@/lib/supabase/admin'
import { isValidSchedule, type Schedule } from './schedule'

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
