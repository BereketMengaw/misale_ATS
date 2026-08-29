import { supabaseAdmin } from '@/lib/supabase/admin'
import { compareRanked, DEFAULT_WEIGHTS, rank, type RankResult, type Weights } from './rank'
import type { Availability } from '@/lib/candidates/availability'

/** Weights live in `settings` so they are tunable without a deploy. */
export async function rankingWeights(): Promise<Weights> {
  const { data } = await supabaseAdmin()
    .from('settings')
    .select('value')
    .eq('key', 'ranking_weights')
    .maybeSingle()

  const stored = (data?.value ?? {}) as Partial<Weights>
  return { ...DEFAULT_WEIGHTS, ...stored }
}

export type Applicant = {
  applicationId: number
  candidateId: number
  status: string
  appliedAt: string
  name: string
  phone: string | null
  area: string | null
  completeness: number
  hasCv: boolean
  channelTitle: string | null
  rank: RankResult
}

type Row = {
  id: number
  status: string
  created_at: string
  candidate_id: number
  candidates: {
    id: number
    full_name: string | null
    phone: string | null
    area: string | null
    subjects: string[] | null
    grades: string[] | null
    availability: Availability | null
    experience: string | null
    education: string | null
    gender: string | null
    rating: number | null
    completeness: number
    cv_path: string | null
  } | null
  post_publications: { channels: { title: string } | null } | null
}

/**
 * Everyone who applied for a job, scored and ordered.
 * Scoring happens here on read rather than being trusted from the row, so
 * changing a weight in settings reorders the board immediately.
 */
export async function applicantsFor(jobId: number): Promise<Applicant[]> {
  const db = supabaseAdmin()

  const [{ data: job }, weights] = await Promise.all([
    db
      .from('job_posts')
      .select('subject, grade, area, days_per_week, gender_pref')
      .eq('id', jobId)
      .maybeSingle(),
    rankingWeights(),
  ])
  if (!job) return []

  const { data } = await db
    .from('applications')
    .select(
      'id, status, created_at, candidate_id, ' +
        'candidates(id, full_name, phone, area, subjects, grades, availability, experience, education, gender, rating, completeness, cv_path), ' +
        'post_publications(channels(title))',
    )
    .eq('job_post_id', jobId)
    .returns<Row[]>()

  const rankable = {
    subject: job.subject,
    grade: job.grade,
    area: job.area,
    daysPerWeek: job.days_per_week,
    genderPref: job.gender_pref,
  }

  const applicants = (data ?? [])
    .filter((row): row is Row & { candidates: NonNullable<Row['candidates']> } => row.candidates !== null)
    .map((row) => {
      const c = row.candidates
      return {
        applicationId: row.id,
        candidateId: c.id,
        status: row.status,
        appliedAt: row.created_at,
        name: c.full_name ?? 'Unnamed',
        phone: c.phone,
        area: c.area,
        completeness: c.completeness,
        hasCv: Boolean(c.cv_path),
        channelTitle: row.post_publications?.channels?.title ?? null,
        rank: rank(
          rankable,
          {
            subjects: c.subjects ?? [],
            grades: c.grades ?? [],
            area: c.area,
            availability: c.availability,
            experience: c.experience,
            education: c.education,
            rating: c.rating,
            gender: c.gender,
          },
          weights,
        ),
      }
    })

  return applicants.sort(compareRanked)
}

/**
 * Write the scores back onto the applications. The board does not need this —
 * it scores on read — but step 7 presents a fixed Top 3, and that has to be
 * the scores as they stood when the operator looked.
 */
export async function persistScores(jobId: number): Promise<number> {
  const applicants = await applicantsFor(jobId)
  const db = supabaseAdmin()

  for (const a of applicants) {
    await db
      .from('applications')
      .update({
        score: a.rank.excluded ? 0 : a.rank.score,
        score_breakdown: { breakdown: a.rank.breakdown, excluded: a.rank.excluded, reason: a.rank.excludedReason },
        status: a.status === 'applied' ? 'ranked' : a.status,
      })
      .eq('id', a.applicationId)
  }
  return applicants.length
}
