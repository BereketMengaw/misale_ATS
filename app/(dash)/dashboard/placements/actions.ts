'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { scheduleSessions } from '@/lib/placements/service'
import { DAY_INDEX } from '@/lib/placements/schedule'

export type ScheduleState = { error?: string; ok?: string }

export async function setSchedule(_prev: ScheduleState, formData: FormData): Promise<ScheduleState> {
  const placementId = Number(formData.get('id'))
  const days = formData.getAll('days').map(String).filter((d) => d in DAY_INDEX)
  const time = String(formData.get('time') ?? '').trim()
  const hours = Number(formData.get('hours'))
  const startsOn = String(formData.get('startsOn') ?? '').trim()
  const endsOn = String(formData.get('endsOn') ?? '').trim()

  if (!placementId) return { error: 'Missing placement.' }
  if (days.length === 0) return { error: 'Pick at least one day.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) {
    return { error: 'Give a start and end date.' }
  }
  if (endsOn < startsOn) return { error: 'The end date is before the start date.' }

  const result = await scheduleSessions(placementId, { days, time, hours }, startsOn, endsOn)
  if (result.error) return { error: result.error }

  revalidatePath(`/dashboard/placements/${placementId}`)
  return { ok: `${result.created} lesson${result.created === 1 ? '' : 's'} scheduled.` }
}

/** The operator recording hours themselves, when a tutor never taps. */
export async function confirmSessionByHand(formData: FormData): Promise<void> {
  const sessionId = Number(formData.get('sessionId'))
  const placementId = Number(formData.get('id'))
  const hours = Number(formData.get('hours'))
  if (!sessionId) return

  await supabaseAdmin()
    .from('sessions')
    .update({
      confirmed_hours: hours,
      confirmed_at: new Date().toISOString(),
      status: hours > 0 ? 'confirmed' : 'missed',
    })
    .eq('id', sessionId)

  revalidatePath(`/dashboard/placements/${placementId}`)
}
