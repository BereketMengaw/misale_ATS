import { supabaseAdmin } from '@/lib/supabase/admin'
import { completeness, type ProfileFields } from './completeness'
import type { Availability } from './availability'

/** The wizard's answers, accumulated in bot_sessions until it finishes. */
export type Draft = {
  fullName?: string
  phone?: string
  gender?: string
  area?: string
  education?: string
  subjects?: string[]
  grades?: string[]
  days?: string[]
  times?: string[]
  experience?: string
  expectedRate?: number
  cvPath?: string
  cvName?: string
  cvMime?: string
}

/** Days and times are collected separately, then combined into the grid. */
export function draftAvailability(draft: Draft): Availability {
  const days = draft.days ?? []
  const times = draft.times ?? []
  if (days.length === 0 || times.length === 0) return {}
  return Object.fromEntries(days.map((d) => [d, [...times].sort()]))
}

function toProfile(draft: Draft): ProfileFields {
  return {
    fullName: draft.fullName,
    phone: draft.phone,
    gender: draft.gender,
    area: draft.area,
    education: draft.education,
    subjects: draft.subjects,
    grades: draft.grades,
    availability: draftAvailability(draft),
    experience: draft.experience,
    expectedRate: draft.expectedRate,
    cvPath: draft.cvPath,
  }
}

export type SavedCandidate = { id: number; completeness: number }

/**
 * Write the finished profile. Upsert on telegram_id: someone who registers
 * twice updates their profile rather than creating a duplicate.
 */
export async function saveCandidate(
  telegramId: number,
  chatId: number,
  draft: Draft,
): Promise<SavedCandidate | null> {
  const score = completeness(toProfile(draft))

  const { data, error } = await supabaseAdmin()
    .from('candidates')
    .upsert(
      {
        telegram_id: telegramId,
        chat_id: chatId,
        full_name: draft.fullName ?? null,
        phone: draft.phone ?? null,
        gender: draft.gender ?? null,
        area: draft.area ?? null,
        education: draft.education ?? null,
        subjects: draft.subjects ?? [],
        grades: draft.grades ?? [],
        availability: draftAvailability(draft),
        experience: draft.experience ?? null,
        expected_rate: draft.expectedRate ?? null,
        expected_rate_period: draft.expectedRate ? 'per_hour' : null,
        cv_path: draft.cvPath ?? null,
        cv_name: draft.cvName ?? null,
        cv_mime: draft.cvMime ?? null,
        completeness: score,
        status: score > 0 ? 'active' : 'incomplete',
        consent_at: new Date().toISOString(),
      },
      { onConflict: 'telegram_id' },
    )
    .select('id, completeness')
    .single()

  if (error) {
    console.error('saveCandidate failed', error)
    return null
  }
  return { id: data.id, completeness: data.completeness }
}

/**
 * Record the application. Unique on (job, candidate), so tapping Apply twice
 * from two forwarded copies of the same post does not duplicate them.
 */
export async function applyToJob(
  candidateId: number,
  jobId: number,
  publicationId: number | null,
): Promise<'created' | 'already' | 'failed'> {
  const { error } = await supabaseAdmin().from('applications').insert({
    job_post_id: jobId,
    candidate_id: candidateId,
    publication_id: publicationId,
  })

  if (!error) return 'created'
  if (error.code === '23505') return 'already' // unique violation
  console.error('applyToJob failed', error)
  return 'failed'
}

export async function findCandidate(telegramId: number) {
  const { data } = await supabaseAdmin()
    .from('candidates')
    .select('id, full_name, completeness, status')
    .eq('telegram_id', telegramId)
    .maybeSingle()
  return data
}

/** CVs are personal data: private bucket, reached only with the secret key. */
export async function storeCv(
  telegramId: number,
  fileName: string,
  mime: string,
  bytes: ArrayBuffer,
): Promise<string | null> {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  const path = `${telegramId}/${Date.now()}-${safe}`

  const { error } = await supabaseAdmin()
    .storage.from('cvs')
    .upload(path, bytes, { contentType: mime, upsert: false })

  if (error) {
    console.error('storeCv failed', error)
    return null
  }
  return path
}

/** Everything "My profile" shows. One read, no scoring. */
export async function candidateProfile(telegramId: number) {
  const { data } = await supabaseAdmin()
    .from('candidates')
    .select(
      'id, full_name, phone, area, education, experience, subjects, grades, availability, expected_rate, cv_path, completeness',
    )
    .eq('telegram_id', telegramId)
    .maybeSingle()
  return data
}
