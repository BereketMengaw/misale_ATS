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
  /** Held on the draft until finish(), when there is a candidate to attach to. */
  documents?: { path: string; name: string; mime: string }[]
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

/**
 * An educational document. Same bucket as the CV under a different prefix:
 * the files are the same kind of thing and the access rules are identical.
 */
export async function storeDocument(
  telegramId: number,
  fileName: string,
  mime: string,
  bytes: ArrayBuffer,
): Promise<string | null> {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  const path = `${telegramId}/docs/${Date.now()}-${safe}`

  const { error } = await supabaseAdmin()
    .storage.from('cvs')
    .upload(path, bytes, { contentType: mime, upsert: false })

  if (error) {
    console.error('storeDocument failed', error)
    return null
  }
  return path
}

/**
 * Attaches the documents collected during registration. Re-registering
 * replaces the profile, so it replaces these too rather than leaving last
 * month's transcript beside this month's answers.
 */
export async function saveDocuments(
  candidateId: number,
  documents: { path: string; name: string; mime: string }[],
): Promise<void> {
  const db = supabaseAdmin()
  try {
    await db.from('candidate_documents').delete().eq('candidate_id', candidateId)
    if (documents.length === 0) return
    const { error } = await db.from('candidate_documents').insert(
      documents.map((d) => ({
        candidate_id: candidateId,
        path: d.path,
        file_name: d.name,
        mime: d.mime,
      })),
    )
    if (error) console.error('saveDocuments failed', error)
  } catch (err) {
    // A lost document must never cost somebody their registration.
    console.error('saveDocuments threw', err)
  }
}

/**
 * A file sent by somebody who has already registered.
 *
 * It becomes their CV if they have not sent one — a registered tutor sending a
 * single file almost always means it as their CV, and the profile counts it —
 * and otherwise joins their educational documents.
 */
export async function attachFile(
  telegramId: number,
  fileName: string,
  mime: string,
  bytes: ArrayBuffer,
): Promise<'cv' | 'document' | 'not-registered' | 'failed'> {
  const db = supabaseAdmin()

  const { data: candidate } = await db
    .from('candidates').select('id, cv_path').eq('telegram_id', telegramId).maybeSingle()
  if (!candidate) return 'not-registered'

  if (!candidate.cv_path) {
    const path = await storeCv(telegramId, fileName, mime, bytes)
    if (!path) return 'failed'
    const { error } = await db
      .from('candidates')
      .update({ cv_path: path, cv_name: fileName, cv_mime: mime })
      .eq('id', candidate.id)
    if (error) {
      console.error('attachFile could not set the cv', error)
      return 'failed'
    }
    return 'cv'
  }

  const path = await storeDocument(telegramId, fileName, mime, bytes)
  if (!path) return 'failed'
  const { error } = await db.from('candidate_documents').insert({
    candidate_id: candidate.id,
    path,
    file_name: fileName,
    mime,
  })
  if (error) {
    console.error('attachFile could not add the document', error)
    return 'failed'
  }
  return 'document'
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
