import { slotCount, type Availability } from './availability'

/**
 * How much of a profile is filled in, 0-100. Pure.
 *
 * The applicant board sorts on this, and step 8's talent-pool DMs skip profiles
 * too thin to match, so the weights are a real decision rather than cosmetics:
 * a CV is worth more than an institution name, and the fields ranking depends on
 * (subjects, grades, availability, area) are worth most.
 */

export type ProfileFields = {
  fullName?: string | null
  phone?: string | null
  gender?: string | null
  area?: string | null
  education?: string | null
  institution?: string | null
  subjects?: string[] | null
  grades?: string[] | null
  availability?: Availability | null
  experience?: string | null
  expectedRate?: number | null
  cvPath?: string | null
}

const WEIGHTS = {
  fullName: 10,
  phone: 15,
  subjects: 15,
  grades: 10,
  availability: 15,
  area: 10,
  education: 8,
  experience: 7,
  expectedRate: 5,
  cv: 5,
  institution: 0,
  gender: 0,
} as const

export function completeness(p: ProfileFields): number {
  let score = 0

  if (p.fullName?.trim()) score += WEIGHTS.fullName
  if (p.phone?.trim()) score += WEIGHTS.phone
  if (p.subjects?.length) score += WEIGHTS.subjects
  if (p.grades?.length) score += WEIGHTS.grades
  if (p.availability && slotCount(p.availability) > 0) score += WEIGHTS.availability
  if (p.area?.trim()) score += WEIGHTS.area
  if (p.education) score += WEIGHTS.education
  if (p.experience) score += WEIGHTS.experience
  if (p.expectedRate != null && p.expectedRate > 0) score += WEIGHTS.expectedRate
  if (p.cvPath?.trim()) score += WEIGHTS.cv

  return Math.min(100, score)
}

/** The minimum a profile needs before it is worth putting in front of anyone. */
export const USABLE_THRESHOLD = 65

export function isUsable(p: ProfileFields): boolean {
  return completeness(p) >= USABLE_THRESHOLD
}

/** What is still missing, in the order the wizard asks for it. */
export function missingFields(p: ProfileFields): string[] {
  const gaps: string[] = []
  if (!p.fullName?.trim()) gaps.push('name')
  if (!p.phone?.trim()) gaps.push('phone')
  if (!p.area?.trim()) gaps.push('area')
  if (!p.education) gaps.push('education')
  if (!p.subjects?.length) gaps.push('subjects')
  if (!p.grades?.length) gaps.push('grades')
  if (!p.availability || slotCount(p.availability) === 0) gaps.push('availability')
  if (!p.experience) gaps.push('experience')
  if (p.expectedRate == null) gaps.push('expected rate')
  if (!p.cvPath?.trim()) gaps.push('CV')
  return gaps
}
