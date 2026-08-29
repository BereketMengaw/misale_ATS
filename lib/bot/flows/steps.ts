/**
 * The wizard's order, as data. Pure — the bot walks this list, so "what comes
 * next" is one lookup rather than a chain of ifs scattered across handlers.
 */
export const REGISTER_STEPS = [
  'consent',
  'name',
  'phone',
  'gender',
  'area',
  'education',
  'subjects',
  'grades',
  'days',
  'times',
  'experience',
  'rate',
  'cv',
] as const

export type RegisterStep = (typeof REGISTER_STEPS)[number]

export function nextStep(step: RegisterStep): RegisterStep | null {
  const i = REGISTER_STEPS.indexOf(step)
  return i >= 0 && i < REGISTER_STEPS.length - 1 ? REGISTER_STEPS[i + 1] : null
}

export function stepNumber(step: RegisterStep): number {
  return REGISTER_STEPS.indexOf(step) + 1
}

export const TOTAL_STEPS = REGISTER_STEPS.length

/** "Step 4 of 13" — an applicant who can see the end is likelier to reach it. */
export function progress(step: RegisterStep): string {
  return `Step ${stepNumber(step)} of ${TOTAL_STEPS}`
}
