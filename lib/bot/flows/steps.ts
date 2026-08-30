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
  'documents',
] as const

export type RegisterStep = (typeof REGISTER_STEPS)[number]

export function nextStep(step: RegisterStep): RegisterStep | null {
  const i = REGISTER_STEPS.indexOf(step)
  return i >= 0 && i < REGISTER_STEPS.length - 1 ? REGISTER_STEPS[i + 1] : null
}

export function prevStep(step: RegisterStep): RegisterStep | null {
  const i = REGISTER_STEPS.indexOf(step)
  return i > 0 ? REGISTER_STEPS[i - 1] : null
}

/**
 * Which callback field belongs to which step.
 *
 * Every answered step used to leave its buttons live, and a tap on an old one
 * wrote its value and then advanced from wherever the wizard had got to —
 * skipping whatever step was actually on screen. A tap now has to belong to
 * the step it arrives at.
 */
export const STEP_FIELD: Record<RegisterStep, string> = {
  consent: 'consent',
  name: 'name',
  phone: 'phone',
  gender: 'gender',
  area: 'area',
  education: 'education',
  subjects: 'subject',
  grades: 'grade',
  days: 'day',
  times: 'time',
  experience: 'experience',
  rate: 'rate',
  cv: 'cv',
  documents: 'document',
}

export function ownsStep(step: RegisterStep, field: string): boolean {
  return STEP_FIELD[step] === field
}

/** The word an answered step is filed under in the transcript. */
export const STEP_LABEL: Record<RegisterStep, string> = {
  consent: 'Consent',
  name: 'Name',
  phone: 'Phone',
  gender: 'Gender',
  area: 'Area',
  education: 'Education',
  subjects: 'Subjects',
  grades: 'Grades',
  days: 'Days',
  times: 'Times',
  experience: 'Experience',
  rate: 'Rate',
  cv: 'CV',
  documents: 'Documents',
}

export function stepNumber(step: RegisterStep): number {
  return REGISTER_STEPS.indexOf(step) + 1
}

export const TOTAL_STEPS = REGISTER_STEPS.length

/** "Step 4 of 13" — an applicant who can see the end is likelier to reach it. */
export function progress(step: RegisterStep): string {
  return `Step ${stepNumber(step)} of ${TOTAL_STEPS}`
}

/**
 * What a registered tutor may change afterwards.
 *
 * Everything except consent, which is a thing they did rather than a value they
 * hold — un-agreeing to storage is deleting the profile, not editing a field.
 */
export const EDITABLE_STEPS = REGISTER_STEPS.filter((s) => s !== 'consent')

export function isEditable(step: string): step is RegisterStep {
  return (EDITABLE_STEPS as readonly string[]).includes(step)
}

/** The word on the button that changes it. */
export const EDIT_LABEL: Record<(typeof EDITABLE_STEPS)[number], string> = {
  name: 'Name',
  phone: 'Phone number',
  gender: 'Gender',
  area: 'Area',
  education: 'Education',
  subjects: 'Subjects',
  grades: 'Grades',
  days: 'Days',
  times: 'Times',
  experience: 'Experience',
  rate: 'Expected rate',
  cv: 'CV',
  documents: 'Documents',
}
