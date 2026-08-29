'use server'

import { revalidatePath } from 'next/cache'
import { setPlacementSchedule } from '@/lib/placements/service'
import { DAY_INDEX } from '@/lib/placements/schedule'

export type ScheduleState = { error?: string; ok?: string }

/** Records what was agreed. Nothing is scheduled or sent. */
export async function setSchedule(_prev: ScheduleState, formData: FormData): Promise<ScheduleState> {
  const placementId = Number(formData.get('id'))
  const days = formData.getAll('days').map(String).filter((d) => d in DAY_INDEX)
  const time = String(formData.get('time') ?? '').trim()
  const hours = Number(formData.get('hours'))
  const startsOn = String(formData.get('startsOn') ?? '').trim() || null
  const endsOn = String(formData.get('endsOn') ?? '').trim() || null

  if (!placementId) return { error: 'Missing placement.' }
  if (days.length === 0) return { error: 'Pick at least one day.' }

  const result = await setPlacementSchedule(placementId, { days, time, hours }, startsOn, endsOn)
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/placements/${placementId}`)
  return { ok: 'Saved.' }
}
