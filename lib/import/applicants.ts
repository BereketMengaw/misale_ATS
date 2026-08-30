/**
 * Reading the Google Form the agency used before this system existed. PURE.
 *
 * 771 rows of free text written by 771 different people over two years. The
 * mapping is here, tested, rather than inside a one-off script: a rule that
 * quietly reads "bachelor degree" as a student mislabels hundreds of people,
 * and nobody would ever notice by looking.
 *
 * The rule throughout is that an unreadable answer becomes NO answer, never a
 * guessed one. `completeness` then shows it as the gap it is, and the ranker
 * already handles missing fields. An invented value would score somebody into
 * or out of a job on something they never said.
 */

import type { Availability } from '@/lib/candidates/availability'
import { normalizePhone } from '@/lib/candidates/phone'

export type FormRow = {
  timestamp: string
  fullName: string
  phone: string
  education: string
  subCity: string
  residence: string
  grades: string
  days: string
}

// ---------------------------------------------------------------------------
// Education — 369 distinct spellings of about six things
// ---------------------------------------------------------------------------

/**
 * Order matters and is the whole design.
 *
 * "university student" and "bachelor student" both contain a degree word, and
 * both describe somebody still studying — so student is tested before degree.
 * Anything else that mentions a degree, a BSc, a BA or graduating is a degree.
 */
export function readEducation(raw: string): string | null {
  const t = raw.toLowerCase().trim()
  if (!t) return null

  if (/\b(phd|ph\.d|doctorate|doctoral)\b/.test(t)) return 'phd'
  if (/\b(masters?|msc|m\.sc|ma\b|mba|postgrad)/.test(t)) return 'masters'
  if (/\b(diploma|tvet|level\s*[1-5]|certificate)\b/.test(t)) return 'diploma'
  // Somebody part-way through a degree describes it by year, not by the word.
  if (/\bstudent\b|undergrad|freshman|freahman|sophomore|\d(?:st|nd|rd|th)\s*year/.test(t)) return 'student'
  // "dgree", "degre", "bcs" — four people cannot all be wrong in a new way.
  if (/\b(degree|dgree|degre|bsc|bcs|b\.sc|ba\b|bachelor|batchelor|graduat|medical doctor|md\b)/.test(t)) {
    return 'degree'
  }

  // A field of study is not a level. "Civil engineering" says what they know,
  // not how far they got, and reading it as a degree would be inventing one.
  return 'other'
}

/**
 * The phone number, from a box people put more than one number in.
 *
 * Twenty-nine answers were rejected outright and most were two numbers in one
 * cell — "0943594619/0912416814", "0919801247 or 0703529299". The first is the
 * one they led with. Taking it beats dropping the person, and dropping the
 * person is what happened before.
 */
export function readPhone(raw: string): string | null {
  const candidates = raw
    .split(/\s*(?:\/|,|;|\bor\b|\||&)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)

  for (const candidate of candidates.length ? candidates : [raw]) {
    const parsed = normalizePhone(candidate)
    if (parsed.ok) return parsed.e164
  }
  return null
}

// ---------------------------------------------------------------------------
// Grades — "grade 9 - grade 11" covers two of our bands
// ---------------------------------------------------------------------------

const BANDS: { value: string; from: number; to: number }[] = [
  { value: '1-4', from: 1, to: 4 },
  { value: '5-8', from: 5, to: 8 },
  { value: '9-10', from: 9, to: 10 },
  { value: '11-12', from: 11, to: 12 },
]

/**
 * Every band the answer actually touches.
 *
 * The form's ranges are not ours: "grade 9 - grade 11" spans three grades and
 * so covers both 9-10 and 11-12. Reading the numbers rather than matching the
 * string is what makes that fall out on its own.
 *
 * KG has no band here, so somebody who only teaches KG gets no grades at all —
 * which is honest. Inventing 1-4 for them would put them in front of families
 * looking for a grade 4 tutor.
 */
export function readGrades(raw: string): string[] {
  const t = raw.toLowerCase()
  const found = new Set<string>()

  // Each selection is its own clause; Forms joins multiple with a comma.
  for (const part of t.split(',')) {
    const grades = [...part.matchAll(/grade\s*(\d{1,2})/g)].map((m) => Number(m[1]))
    if (grades.length === 0) continue

    const lo = Math.min(...grades)
    const hi = Math.max(...grades)
    for (const b of BANDS) {
      if (lo <= b.to && hi >= b.from) found.add(b.value)
    }
  }

  return BANDS.filter((b) => found.has(b.value)).map((b) => b.value)
}

// ---------------------------------------------------------------------------
// Availability — days chosen, on a form that asked about after school
// ---------------------------------------------------------------------------

const DAY_WORDS: Record<string, string> = {
  monday: 'mon', mon: 'mon',
  tuesday: 'tue', tue: 'tue',
  wednesday: 'wed', wed: 'wed',
  thursday: 'thu', thu: 'thu',
  friday: 'fri', fri: 'fri',
  saturday: 'sat', sat: 'sat',
  sunday: 'sun', sun: 'sun',
}

/**
 * The form asked "Which day you will be available? (mostly after-school)" and
 * offered no times at all, so the times here come from the question's own
 * framing rather than from anything the applicant said. It is the one
 * assumption in this file, and it is recorded rather than hidden: an imported
 * tutor can correct it in the bot under Change something.
 *
 * Leaving availability empty instead was the alternative, and it is worse —
 * the ranker scores availability, so every imported tutor would lose those
 * points to a question they were never asked.
 */
export const IMPORTED_SLOTS = ['afternoon', 'evening']

export function readAvailability(raw: string): Availability {
  const days = new Set<string>()
  for (const word of raw.toLowerCase().split(/[,\s/]+/)) {
    const day = DAY_WORDS[word.trim()]
    if (day) days.add(day)
  }

  const grid: Availability = {}
  for (const d of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
    if (days.has(d)) grid[d] = [...IMPORTED_SLOTS].sort()
  }
  return grid
}

// ---------------------------------------------------------------------------
// Area — one sub-city, spelled 154 ways
// ---------------------------------------------------------------------------

const AREA_ALIASES: Record<string, string> = {
  bole: 'Bole',
  yeka: 'Yeka',
  kirkos: 'Kirkos',
  arada: 'Arada',
  lideta: 'Lideta',
  'addis ketema': 'Addis Ketema',
  gulele: 'Gulele',
  gullele: 'Gulele',
  'kolfe keranio': 'Kolfe Keranio',
  'kolfe keraniyo': 'Kolfe Keranio',
  kolfe: 'Kolfe Keranio',
  'nifas silk lafto': 'Nifas Silk-Lafto',
  'nifas silk-lafto': 'Nifas Silk-Lafto',
  'nifas silk': 'Nifas Silk-Lafto',
  'nifassilk': 'Nifas Silk-Lafto',
  'akaki kality': 'Akaky Kaliti',
  'akaky kaliti': 'Akaky Kaliti',
  akaki: 'Akaky Kaliti',
  'lemi kura': 'Lemi Kura',
  lemikura: 'Lemi Kura',
  'lemi-kura': 'Lemi Kura',
}

/**
 * A named sub-city where the answer is one, and nothing where it is not.
 *
 * "Addis Ababa" is the city, not a sub-city: 54 people answered the question
 * with it, and it locates nobody. Storing it would look like an answer while
 * matching no job, which is worse for the operator than an obvious blank.
 */
export function readArea(subCity: string, residence: string): string | null {
  const tidy = (s: string) => s.toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim()

  for (const candidate of [tidy(subCity), tidy(residence)]) {
    if (!candidate) continue
    if (AREA_ALIASES[candidate]) return AREA_ALIASES[candidate]

    // "bole bulbula", "yeka abado" — the sub-city with a neighbourhood after it.
    for (const [alias, area] of Object.entries(AREA_ALIASES)) {
      if (candidate.startsWith(`${alias} `) || candidate.endsWith(` ${alias}`)) return area
    }
  }
  return null
}

/** Title case, for a name typed in whatever case the phone was in. */
export function readName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < 2) return null
  return name
    .split(' ')
    .map((w) => (w.length > 1 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toUpperCase()))
    .join(' ')
    .slice(0, 80)
}
