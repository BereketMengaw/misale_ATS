import { gradeBand } from './grades'
import type { Availability } from '@/lib/candidates/availability'
import { availableDays } from '@/lib/candidates/availability'

/**
 * The scorer. PURE — data in, data out, no database, no Telegram, no model.
 * See CLAUDE.md: this is one of the two things that must never be wrong.
 *
 * A component the data cannot answer (an unrated candidate, a job with no
 * grade) is dropped from BOTH sides of the fraction rather than scored zero.
 * Scoring it zero would punish a new tutor for having no history, which is not
 * a judgement anyone intends to make.
 */

export type Weights = {
  subject: number
  grade: number
  area: number
  availability: number
  experience: number
  education: number
  rating: number
}

export const DEFAULT_WEIGHTS: Weights = {
  subject: 30,
  grade: 15,
  area: 20,
  availability: 15,
  experience: 10,
  education: 5,
  rating: 5,
}

export type RankableJob = {
  subject: string
  grade: string
  area: string
  daysPerWeek: number
  genderPref?: 'any' | 'female' | 'male' | null
}

export type RankableCandidate = {
  subjects: string[]
  grades: string[]
  area?: string | null
  availability?: Availability | null
  experience?: string | null
  education?: string | null
  rating?: number | null
  gender?: string | null
}

export type Component = {
  key: keyof Weights
  label: string
  points: number
  max: number
}

export type RankResult = {
  score: number
  breakdown: Component[]
  /** Set when the job asked for a gender this candidate is not. */
  excluded: boolean
  excludedReason?: string
}

const EXPERIENCE_VALUE: Record<string, number> = {
  none: 0,
  under_1: 0.25,
  '1_2': 0.5,
  '3_5': 0.8,
  over_5: 1,
}

const EDUCATION_VALUE: Record<string, number> = {
  student: 0.3,
  diploma: 0.5,
  degree: 0.8,
  masters: 1,
  phd: 1,
  other: 0.4,
}

const EXPERIENCE_LABEL: Record<string, string> = {
  none: 'No experience',
  under_1: 'Under a year',
  '1_2': '1–2 years',
  '3_5': '3–5 years',
  over_5: 'Over 5 years',
}

const EDUCATION_LABEL: Record<string, string> = {
  student: 'Student',
  diploma: 'Diploma',
  degree: "Bachelor's",
  masters: "Master's",
  phd: 'PhD',
  other: 'Other education',
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

export function rank(
  job: RankableJob,
  candidate: RankableCandidate,
  weights: Weights = DEFAULT_WEIGHTS,
): RankResult {
  const barred = genderExcluded(job.genderPref, candidate.gender)
  if (barred) return { score: 0, breakdown: [], excluded: true, excludedReason: barred }

  const breakdown: Component[] = []
  let earned = 0
  let possible = 0

  const add = (key: keyof Weights, label: string, fraction: number | null) => {
    if (fraction === null) return // not answerable — drop from both sides
    const max = weights[key]
    const points = Math.round(fraction * max)
    breakdown.push({ key, label, points, max })
    earned += points
    possible += max
  }

  // --- subject: the whole point of the match ---
  const wanted = norm(job.subject)
  const teaches = candidate.subjects.map(norm)
  add(
    'subject',
    teaches.includes(wanted) ? `Teaches ${job.subject}` : `Does not teach ${job.subject}`,
    teaches.includes(wanted) ? 1 : 0,
  )

  // --- grade band ---
  const band = gradeBand(job.grade)
  add(
    'grade',
    band ? (candidate.grades.includes(band) ? `Teaches ${band}` : `Not ${band}`) : 'Grade unknown',
    band ? (candidate.grades.includes(band) ? 1 : 0) : null,
  )

  // --- area ---
  const jobArea = norm(job.area)
  const homeArea = candidate.area ? norm(candidate.area) : null
  const sameArea = homeArea !== null && (jobArea.includes(homeArea) || homeArea.includes(jobArea))
  add(
    'area',
    homeArea === null ? 'Area unknown' : sameArea ? `In ${candidate.area}` : `In ${candidate.area}, job is ${job.area}`,
    homeArea === null ? null : sameArea ? 1 : 0,
  )

  // --- availability: enough days for what the job needs ---
  const days = candidate.availability ? availableDays(candidate.availability).length : 0
  const needed = Math.max(1, job.daysPerWeek)
  add(
    'availability',
    candidate.availability && days > 0
      ? `Free ${days} day${days === 1 ? '' : 's'}, job needs ${needed}`
      : 'Availability not set',
    candidate.availability && days > 0 ? Math.min(1, days / needed) : null,
  )

  // --- experience ---
  const exp = candidate.experience ?? null
  add(
    'experience',
    exp ? (EXPERIENCE_LABEL[exp] ?? exp) : 'Experience unknown',
    exp && exp in EXPERIENCE_VALUE ? EXPERIENCE_VALUE[exp] : null,
  )

  // --- education ---
  const edu = candidate.education ?? null
  add(
    'education',
    edu ? (EDUCATION_LABEL[edu] ?? edu) : 'Education unknown',
    edu && edu in EDUCATION_VALUE ? EDUCATION_VALUE[edu] : null,
  )

  // --- past rating, out of 5. Unrated is not the same as bad. ---
  const rating = candidate.rating ?? null
  add(
    'rating',
    rating === null ? 'No placements yet' : `Rated ${rating.toFixed(1)} / 5`,
    rating === null ? null : Math.max(0, Math.min(1, rating / 5)),
  )

  const score = possible === 0 ? 0 : Math.round((earned / possible) * 100)

  return { score, breakdown, excluded: false }
}

/** Highest first; ties broken by the components that matter most. */
/**
 * The one hard filter, not a score: a family that asked for a female tutor is
 * not served better by a high-scoring male one. PURE.
 *
 * Exported because the boards need to know who can be asked WITHOUT ranking
 * everyone — and because a board that counted an excluded applicant as askable
 * offered a button that could not work.
 */
export function genderExcluded(
  genderPref: string | null | undefined,
  gender: string | null | undefined,
): string | null {
  if (genderPref && genderPref !== 'any' && gender && gender !== genderPref) {
    return `Job asks for a ${genderPref} tutor`
  }
  return null
}

export function compareRanked<T extends { rank: RankResult }>(a: T, b: T): number {
  if (a.rank.excluded !== b.rank.excluded) return a.rank.excluded ? 1 : -1
  if (b.rank.score !== a.rank.score) return b.rank.score - a.rank.score

  const points = (r: RankResult, key: keyof Weights) =>
    r.breakdown.find((c) => c.key === key)?.points ?? 0

  for (const key of ['subject', 'area', 'availability'] as const) {
    const diff = points(b.rank, key) - points(a.rank, key)
    if (diff !== 0) return diff
  }
  return 0
}
