/**
 * Every answer the wizard accepts. One place, so the bot's buttons and the
 * dashboard's labels can never drift apart.
 *
 * Areas and subjects are the two lists an operator will actually want to
 * change; they are seeded into `settings` so they are tunable without a deploy.
 */

export type Option<T extends string = string> = { value: T; label: string }

export const GENDERS: Option[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
]

export const EDUCATION: Option[] = [
  { value: 'student', label: 'Still a student' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'degree', label: "Bachelor's degree" },
  { value: 'masters', label: "Master's degree" },
  { value: 'phd', label: 'PhD' },
  { value: 'other', label: 'Something else' },
]

export const EXPERIENCE: Option[] = [
  { value: 'none', label: 'No experience yet' },
  { value: 'under_1', label: 'Under a year' },
  { value: '1_2', label: '1–2 years' },
  { value: '3_5', label: '3–5 years' },
  { value: 'over_5', label: 'Over 5 years' },
]

export const GRADE_BANDS: Option[] = [
  { value: '1-4', label: 'Grades 1–4' },
  { value: '5-8', label: 'Grades 5–8' },
  { value: '9-10', label: 'Grades 9–10' },
  { value: '11-12', label: 'Grades 11–12' },
  { value: 'university', label: 'University' },
]

export const DAYS: Option[] = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
]

export const SLOTS: Option[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
]

export const RATE_BANDS: Option[] = [
  { value: '100', label: 'Up to 100 ETB/hr' },
  { value: '150', label: '100–150 ETB/hr' },
  { value: '200', label: '150–200 ETB/hr' },
  { value: '300', label: '200–300 ETB/hr' },
  { value: '400', label: 'Over 300 ETB/hr' },
]

/** Defaults; the live lists come from `settings` so they change without a deploy. */
/**
 * Most tutoring here is hired by grade, not by subject: a family wants someone
 * for grade 5, and that person teaches everything. Both sides of the match can
 * say so — a tutor taps this, and an operator types it as a job's subject.
 */
export const ALL_SUBJECTS = 'All subjects'

export const DEFAULT_SUBJECTS = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English',
  'Amharic', 'Geography', 'History', 'Economics', 'ICT',
]

export const DEFAULT_AREAS = [
  'Bole', 'Yeka', 'Kirkos', 'Arada', 'Lideta',
  'Addis Ketema', 'Gulele', 'Kolfe Keranio', 'Nifas Silk-Lafto', 'Akaky Kaliti',
]

/** What the wizard offers: the wildcard first, then the named subjects. */
export const SUBJECT_CHOICES = [ALL_SUBJECTS, ...DEFAULT_SUBJECTS]

export function labelFor(options: Option[], value: string | null | undefined): string {
  if (!value) return '—'
  return options.find((o) => o.value === value)?.label ?? value
}
