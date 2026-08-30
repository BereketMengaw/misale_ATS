import { supabaseAdmin } from '@/lib/supabase/admin'
import { parseCv } from '@/lib/ai/provider'
import { completeness, type ProfileFields } from './completeness'
import { MAX_UPLOAD_BYTES, READABLE_MIME } from './files'
import { mergeCv, readCvFacts, saysNothing, type CvReading } from './cv'

/**
 * Reading one tutor's CV into their profile. The I/O half of step 5 — the
 * decisions are all in `cv.ts`, which is pure and tested.
 *
 * Nothing here runs on its own. There is no trigger on upload and no cron: the
 * operator opens a profile and presses a button. That is what keeps the cost
 * rule in CLAUDE.md true — answering a typed question stays the only model call
 * a stranger can set off, and somebody who uploads a hundred CVs has spent a
 * hundred rows of storage and no tokens.
 *
 * The same file is never read twice. A reading records the `cv_path` it was
 * made from, so pressing the button again on an unchanged CV returns what is
 * already stored; a tutor who sends a better CV changes the path, and that is
 * the thing worth spending a call on.
 */

export type ReadFailure =
  | 'no-candidate'
  | 'no-cv'
  | 'unreadable-type'
  | 'too-big'
  | 'download-failed'
  | 'no-model'
  | 'says-nothing'
  | 'save-failed'

export type ReadOutcome =
  | { ok: true; reading: CvReading; filled: number; already: boolean }
  | { ok: false; reason: ReadFailure }

type Row = {
  id: number
  full_name: string | null
  phone: string | null
  area: string | null
  education: string | null
  institution: string | null
  subjects: string[] | null
  grades: string[] | null
  availability: Record<string, string[]> | null
  experience: string | null
  expected_rate: number | null
  cv_path: string | null
  cv_mime: string | null
  cv_parsed: unknown
  cv_parsed_from: string | null
}

const COLUMNS =
  'id, full_name, phone, area, education, institution, subjects, grades, availability, ' +
  'experience, expected_rate, cv_path, cv_mime, cv_parsed, cv_parsed_from'

function profileOf(row: Row): ProfileFields {
  return {
    fullName: row.full_name,
    phone: row.phone,
    area: row.area,
    education: row.education,
    institution: row.institution,
    subjects: row.subjects,
    grades: row.grades,
    availability: row.availability ?? {},
    experience: row.experience,
    expectedRate: row.expected_rate,
    cvPath: row.cv_path,
  }
}

/** Fills, in the columns they are written to. Only fields the tutor left empty. */
const COLUMN_OF: Record<string, string> = {
  fullName: 'full_name',
  phone: 'phone',
  education: 'education',
  institution: 'institution',
  area: 'area',
  experience: 'experience',
  subjects: 'subjects',
  grades: 'grades',
}

export async function readCandidateCv(
  candidateId: number,
  { force = false }: { force?: boolean } = {},
): Promise<ReadOutcome> {
  const db = supabaseAdmin()

  const { data } = await db.from('candidates').select(COLUMNS).eq('id', candidateId).maybeSingle()
  const row = data as Row | null
  if (!row) return { ok: false, reason: 'no-candidate' }
  if (!row.cv_path) return { ok: false, reason: 'no-cv' }

  // Already read, and the file has not changed since. No call, no charge.
  if (!force && row.cv_parsed && row.cv_parsed_from === row.cv_path) {
    return { ok: true, reading: row.cv_parsed as CvReading, filled: 0, already: true }
  }

  // A CV can be a Word document. It is a fine thing to store and open, and
  // there is no reader for it here, so it is declined by name rather than sent.
  if (!READABLE_MIME.test(row.cv_mime ?? '')) return { ok: false, reason: 'unreadable-type' }

  const { data: file, error: downloadError } = await db.storage.from('cvs').download(row.cv_path)
  if (downloadError || !file) {
    console.error('readCandidateCv could not download the cv', downloadError)
    return { ok: false, reason: 'download-failed' }
  }
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: 'too-big' }

  const read = await parseCv({
    bytes: await file.arrayBuffer(),
    mime: row.cv_mime ?? 'application/pdf',
    name: row.cv_path.split('/').pop() ?? null,
  })

  // No model configured, or the call came back with nothing. Neither is an
  // error the operator has to do anything about: the profile is exactly as
  // complete as it was, and the CV is still there to open.
  if (!read.read) return { ok: false, reason: 'no-model' }

  const profile = profileOf(row)
  const reading = mergeCv(profile, readCvFacts(read.raw))

  if (saysNothing(reading)) {
    // Still recorded. Without this the button would look untouched and the
    // same CV would be sent again on every visit to the page.
    await db
      .from('candidates')
      .update({
        cv_parsed: reading,
        cv_parsed_at: new Date().toISOString(),
        cv_parsed_from: row.cv_path,
        cv_parsed_by: read.generatedBy,
      })
      .eq('id', candidateId)
    return { ok: false, reason: 'says-nothing' }
  }

  // Apply the fills, and only the fills. Every one of them is a field the tutor
  // left empty, so none of them can overwrite something they said themselves —
  // which is why this needs no confirmation and the conflicts below do.
  const update: Record<string, unknown> = {
    cv_parsed: reading,
    cv_parsed_at: new Date().toISOString(),
    cv_parsed_from: row.cv_path,
    cv_parsed_by: read.generatedBy,
  }
  const filledProfile: ProfileFields = { ...profile }

  for (const fill of reading.fills) {
    const column = COLUMN_OF[fill.field]
    if (!column) continue
    update[column] = fill.value
    Object.assign(filledProfile, { [fill.field]: fill.value })
  }

  // A filled field changes how complete the profile is, and the applicant board
  // sorts on that. Recomputed here rather than left for the next save, which
  // might be never.
  if (reading.fills.length > 0) update.completeness = completeness(filledProfile)

  const { error } = await db.from('candidates').update(update).eq('id', candidateId)
  if (error) {
    console.error('readCandidateCv could not save the reading', error)
    return { ok: false, reason: 'save-failed' }
  }

  return { ok: true, reading, filled: reading.fills.length, already: false }
}

/** What to put in front of the operator when a reading did not happen. */
export function readFailureMessage(reason: ReadFailure): string {
  switch (reason) {
    case 'no-candidate':
      return 'That tutor is gone.'
    case 'no-cv':
      return 'There is no CV on this profile to read.'
    case 'unreadable-type':
      return 'This CV is a Word document, which cannot be read automatically. Open it yourself, or ask them for a PDF.'
    case 'too-big':
      return 'This CV is too large to read.'
    case 'download-failed':
      return 'The CV could not be opened from storage. Try again.'
    case 'no-model':
      return 'No CV reader is configured, so nothing was read. The CV is still there to open.'
    case 'says-nothing':
      return 'It was read, and there was nothing in it the profile can use.'
    case 'save-failed':
      return 'It was read, but the result could not be saved. Try again.'
  }
}
