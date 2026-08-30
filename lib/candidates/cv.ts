import { ALL_SUBJECTS, DEFAULT_AREAS, DEFAULT_SUBJECTS, EDUCATION, GRADE_BANDS } from './options'
import { normalizePhone } from './phone'
import type { ProfileFields } from './completeness'
import type { RawCv } from '@/lib/ai/types'

/**
 * What a CV is allowed to say about a profile, and what happens when it
 * disagrees with the tutor. PURE — text in, decisions out, no I/O.
 *
 * This is where the model's word stops being prose and becomes the same enums
 * the wizard collects, because `lib/scoring/rank.ts` sorts on them: a CV that
 * yields "Maths" or "BSc Applied Physics" is worth nothing to the ranker until
 * it is 'Mathematics' and 'degree'. Anything that does not normalise to a known
 * value is dropped rather than stored — a profile carrying a subject no job can
 * ask for is worse than a profile that never claimed it.
 *
 * The other half is the rule about who wins. The wizard's buttons are the
 * tutor's own statement; a CV is evidence about them. So the CV only ever fills
 * a field the tutor left empty. Where it disagrees, the profile is left exactly
 * as it was and the disagreement is handed to the operator — a `conflict` here
 * is a thing for a human to look at, never a write.
 */

// ---------------------------------------------------------------------------
// The fields a CV may speak to
// ---------------------------------------------------------------------------

/**
 * Deliberately not here: gender, availability and expected rate. A CV does not
 * state when somebody is free, the rate on one is what they were last paid
 * rather than what they would accept, and inferring gender from a document is
 * guessing at a person from their name.
 */
export const CV_FIELDS = [
  'fullName',
  'phone',
  'education',
  'institution',
  'area',
  'experience',
  'subjects',
  'grades',
] as const

export type CvField = (typeof CV_FIELDS)[number]

/** A CV's claims, already normalised to the wizard's own vocabulary. */
export type CvFacts = {
  fullName?: string | null
  phone?: string | null
  education?: string | null
  institution?: string | null
  area?: string | null
  experience?: string | null
  subjects?: string[]
  grades?: string[]
}

export const CV_FIELD_LABEL: Record<CvField, string> = {
  fullName: 'Name',
  phone: 'Phone',
  education: 'Education',
  institution: 'Institution',
  area: 'Area',
  experience: 'Experience',
  subjects: 'Subjects',
  grades: 'Grades',
}

// ---------------------------------------------------------------------------
// Normalising one field at a time
// ---------------------------------------------------------------------------

/** Collapsed, trimmed, and refused outright if it is longer than a value can be. */
function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const t = value.replace(/\s+/g, ' ').trim()
  return t && t.length <= max ? t : null
}

/**
 * A name, or nothing. Digits and a sentence's worth of words are both signs
 * the model handed back a heading ("CURRICULUM VITAE 2024") rather than a person.
 */
export function nameFrom(value: unknown): string | null {
  const t = text(value, 80)
  if (!t || /\d/.test(t)) return null
  const words = t.split(' ')
  return words.length >= 1 && words.length <= 5 ? t : null
}

export function phoneFrom(value: unknown): string | null {
  const t = text(value, 40)
  if (!t) return null
  const parsed = normalizePhone(t)
  return parsed.ok ? parsed.e164 : null
}

export function institutionFrom(value: unknown): string | null {
  return text(value, 80)
}

const EDUCATION_VALUES = new Set(EDUCATION.map((e) => e.value))

/**
 * Highest qualification first: a CV reading "BSc, now studying for an MSc"
 * matches both, and the later one is the answer.
 */
const EDUCATION_WORDS: [RegExp, string][] = [
  [/\bph\.?\s?d\b|\bdoctorate\b|\bdoctoral\b|\bd\.?phil\b/i, 'phd'],
  [/\bm\.?\s?sc\b|\bm\.?\s?a\b|\bm\.?\s?ed\b|\bmba\b|\bmaster'?s?\b/i, 'masters'],
  [/\bb\.?\s?sc\b|\bb\.?\s?a\b|\bb\.?\s?ed\b|\bbachelor'?s?\b|\bdegree\b/i, 'degree'],
  [/\bdiploma\b|\btvet\b|\blevel\s?[ivx]+\b/i, 'diploma'],
  [/\bstudent\b|\bundergraduate\b|\bfreshman\b|\bsophomore\b|\byear\s?\d\b/i, 'student'],
]

/**
 * 'other' is dropped rather than kept. As a stored answer it means "I told you
 * and it was none of these"; coming back from a CV it means the reader could
 * not tell, and writing that over an empty field would replace "not known" with
 * "known to be unclassifiable".
 */
export function educationFrom(value: unknown): string | null {
  const t = text(value, 120)
  if (!t) return null
  const lower = t.toLowerCase()
  if (lower !== 'other' && EDUCATION_VALUES.has(lower)) return lower
  for (const [pattern, level] of EDUCATION_WORDS) if (pattern.test(t)) return level
  return null
}

/**
 * Years of teaching → the band the wizard offers. Derived rather than asked
 * for: "how many years" is a fact a CV states, and which band that lands in is
 * arithmetic that belongs here where it is tested, not in a prompt.
 */
export function experienceFrom(years: unknown): string | null {
  if (typeof years !== 'number' || !Number.isFinite(years)) return null
  if (years < 0 || years > 60) return null
  if (years === 0) return 'none'
  if (years < 1) return 'under_1'
  if (years < 3) return '1_2'
  if (years <= 5) return '3_5'
  return 'over_5'
}

/**
 * Spellings that mean a subject the wizard already offers. A Map rather than an
 * object literal, so a CV listing "constructor" cannot reach up the prototype
 * chain and come back as a match.
 */
const SUBJECT_ALIASES = new Map<string, string>([
  ['math', 'Mathematics'],
  ['maths', 'Mathematics'],
  ['math1', 'Mathematics'],
  ['applied mathematics', 'Mathematics'],
  ['further mathematics', 'Mathematics'],
  ['general mathematics', 'Mathematics'],
  ['physic', 'Physics'],
  ['applied physics', 'Physics'],
  ['chem', 'Chemistry'],
  ['bio', 'Biology'],
  ['english language', 'English'],
  ['english literature', 'English'],
  ['spoken english', 'English'],
  ['amharic language', 'Amharic'],
  ['civics', 'History'],
  ['it', 'ICT'],
  ['computer', 'ICT'],
  ['computers', 'ICT'],
  ['computer science', 'ICT'],
  ['information technology', 'ICT'],
  ['all subjects', ALL_SUBJECTS],
  ['every subject', ALL_SUBJECTS],
  ['all', ALL_SUBJECTS],
])

export function subjectsFrom(values: unknown, known: string[] = DEFAULT_SUBJECTS): string[] {
  if (!Array.isArray(values)) return []
  const out: string[] = []
  for (const value of values) {
    const t = text(value, 60)
    if (!t) continue
    const lower = t.toLowerCase()
    const hit = known.find((s) => s.toLowerCase() === lower) ?? SUBJECT_ALIASES.get(lower) ?? null
    if (hit && !out.includes(hit)) out.push(hit)
  }
  return out
}

const BAND_VALUES = new Set(GRADE_BANDS.map((g) => g.value))
const NUMERIC_BANDS: [string, number, number][] = [
  ['1-4', 1, 4],
  ['5-8', 5, 8],
  ['9-10', 9, 10],
  ['11-12', 11, 12],
]

/**
 * "grades 7-12" is one claim covering three of the wizard's bands, and CVs are
 * written that way far more often than they are written in bands. Every band
 * the stated range touches is claimed: somebody who teaches 7 to 12 does teach
 * grade 5-8s, and under-claiming costs them jobs they can do.
 */
function bandsInRange(value: string): string[] {
  const numbers = (value.match(/\d{1,2}/g) ?? []).map(Number).filter((n) => n >= 1 && n <= 12)
  if (numbers.length === 0) return []
  const low = Math.min(...numbers)
  const high = Math.max(...numbers)
  return NUMERIC_BANDS.filter(([, from, to]) => from <= high && to >= low).map(([band]) => band)
}

export function gradesFrom(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const out: string[] = []
  const push = (band: string) => {
    if (!out.includes(band)) out.push(band)
  }

  for (const value of values) {
    const t = text(value, 40)
    if (!t) continue
    const lower = t.toLowerCase()
    if (BAND_VALUES.has(lower)) {
      push(lower)
      continue
    }
    if (/univers|college|tertiary|undergrad/.test(lower)) {
      push('university')
      continue
    }
    for (const band of bandsInRange(lower)) push(band)
  }

  // The wizard's own order, so two profiles holding the same bands look the same.
  return GRADE_BANDS.map((g) => g.value).filter((v) => out.includes(v))
}

/**
 * The sub-city, matched against the list the wizard offers. A CV writes an
 * address, not a button value: "Bole, Addis Ababa" and "Yeka sub-city" both
 * have to land on the same word the ranker compares.
 *
 * Longest name first, so "Addis Ketema" is not read as the "Addis" in an
 * address that says Addis Ababa.
 */
export function areaFrom(value: unknown, known: string[] = DEFAULT_AREAS): string | null {
  const t = text(value, 80)
  if (!t) return null
  const lower = t.toLowerCase()
  const byLength = [...known].sort((a, b) => b.length - a.length)
  return byLength.find((area) => lower.includes(area.toLowerCase())) ?? null
}

/**
 * Everything a model handed back, reduced to what the profile can hold.
 *
 * Whatever the prompt asked for, this is the guarantee: a value that is not a
 * known enum, a known subject or a real Ethiopian mobile number does not
 * survive this function.
 */
export function readCvFacts(
  raw: RawCv,
  lists: { subjects?: string[]; areas?: string[] } = {},
): CvFacts {
  return {
    fullName: nameFrom(raw.fullName),
    phone: phoneFrom(raw.phone),
    education: educationFrom(raw.education),
    institution: institutionFrom(raw.institution),
    area: areaFrom(raw.area, lists.areas ?? DEFAULT_AREAS),
    experience: experienceFrom(raw.experienceYears),
    subjects: subjectsFrom(raw.subjects, lists.subjects ?? DEFAULT_SUBJECTS),
    grades: gradesFrom(raw.grades),
  }
}

// ---------------------------------------------------------------------------
// What to do about each claim
// ---------------------------------------------------------------------------

/** A field the tutor left empty that the CV can answer. Safe to write. */
export type Fill = { field: CvField; value: string | string[] }

/** The tutor said one thing and their CV says another. Never written. */
export type Conflict = { field: CvField; profile: string | string[]; cv: string | string[] }

/** Subjects or grades the CV names that the profile does not. Never written. */
export type Addition = { field: CvField; values: string[] }

export type CvReading = {
  facts: CvFacts
  fills: Fill[]
  confirmed: CvField[]
  conflicts: Conflict[]
  additions: Addition[]
}

/** The profile fields a CV is compared against — completeness's, plus the institution. */
export type CvProfile = ProfileFields

function blank(value: string | null | undefined): boolean {
  return !value || !value.trim()
}

/**
 * Whether two names are the same person. A middle name on one side and not the
 * other is how Ethiopian names are actually written down, and calling that a
 * conflict would flag nearly every CV; a different surname is worth flagging,
 * because it usually means somebody sent a friend's CV.
 */
export function sameName(a: string, b: string): boolean {
  const tokens = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean)
  const left = tokens(a)
  const right = tokens(b)
  if (left.length === 0 || right.length === 0) return false
  const [short, long] = left.length <= right.length ? [left, right] : [right, left]
  return short.every((word) => long.includes(word))
}

function compare(
  field: CvField,
  profileValue: string | null | undefined,
  cvValue: string | null | undefined,
  same: (a: string, b: string) => boolean = (a, b) => a === b,
): { fill?: Fill; confirmed?: CvField; conflict?: Conflict } {
  if (blank(cvValue)) return {}
  const cv = cvValue!.trim()
  if (blank(profileValue)) return { fill: { field, value: cv } }
  const profile = profileValue!.trim()
  return same(profile, cv)
    ? { confirmed: field }
    : { conflict: { field, profile, cv } }
}

/**
 * A list the CV names against the list the tutor picked.
 *
 * These never conflict, and that is a decision rather than an oversight: a CV
 * is not an exhaustive list of what somebody can teach, so a subject missing
 * from it contradicts nothing. What the CV adds is reported for the operator to
 * accept or ignore — silently adding it would change who ranks for which job on
 * the strength of a document nobody read.
 */
function compareList(
  field: CvField,
  profileValues: string[] | null | undefined,
  cvValues: string[],
): { fill?: Fill; confirmed?: CvField; addition?: Addition } {
  if (cvValues.length === 0) return {}
  const held = profileValues ?? []
  if (held.length === 0) return { fill: { field, value: cvValues } }

  const extra = cvValues.filter((v) => !held.includes(v))
  if (extra.length === 0) return { confirmed: field }
  return { addition: { field, values: extra } }
}

/**
 * The whole of step 5's "merge, conflicts flagged", as one pure function.
 *
 * Nothing here writes. The caller applies `fills` — and only `fills` — because
 * they are the fields on which the tutor said nothing to contradict.
 */
export function mergeCv(profile: CvProfile, facts: CvFacts): CvReading {
  const fills: Fill[] = []
  const confirmed: CvField[] = []
  const conflicts: Conflict[] = []
  const additions: Addition[] = []

  const take = (r: { fill?: Fill; confirmed?: CvField; conflict?: Conflict; addition?: Addition }) => {
    if (r.fill) fills.push(r.fill)
    if (r.confirmed) confirmed.push(r.confirmed)
    if (r.conflict) conflicts.push(r.conflict)
    if (r.addition) additions.push(r.addition)
  }

  take(compare('fullName', profile.fullName, facts.fullName, sameName))
  take(compare('phone', profile.phone, facts.phone))
  take(compare('education', profile.education, facts.education))
  take(compare('institution', profile.institution, facts.institution))
  take(compare('area', profile.area, facts.area))
  take(compare('experience', profile.experience, facts.experience))
  take(compareList('subjects', profile.subjects, facts.subjects ?? []))
  take(compareList('grades', profile.grades, facts.grades ?? []))

  return { facts, fills, confirmed, conflicts, additions }
}

/** True when the CV was read and told us nothing the profile can use. */
export function saysNothing(reading: CvReading): boolean {
  return (
    reading.fills.length === 0 &&
    reading.confirmed.length === 0 &&
    reading.conflicts.length === 0 &&
    reading.additions.length === 0
  )
}
