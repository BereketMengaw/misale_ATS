/**
 * How a placement's lessons are described. Pure.
 *
 * There are no reminders and no per-lesson records: billing is a flat monthly
 * rate, so the schedule is a note of what was agreed, not a timetable the
 * system drives.
 */

export const DAY_INDEX: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

const DAY_LABEL: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

export type Schedule = {
  days: string[]
  /** Local 24h time in Addis, "17:00". */
  time: string
  hours: number
}

export function isValidSchedule(s: Schedule): boolean {
  if (!Array.isArray(s.days) || s.days.length === 0) return false
  if (!s.days.every((d) => d in DAY_INDEX)) return false
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)) return false
  return s.hours > 0 && s.hours <= 12
}

/** "Mon, Wed, Fri at 17:00 · 2h" */
export function describeSchedule(s: Schedule | null | undefined): string {
  if (!s || !isValidSchedule(s)) return 'Not set'
  const days = [...s.days]
    .sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b])
    .map((d) => DAY_LABEL[d] ?? d)
    .join(', ')
  return `${days} at ${s.time} · ${s.hours}h`
}

export function lessonsPerWeek(s: Schedule): number {
  return isValidSchedule(s) ? s.days.length : 0
}

export function hoursPerWeek(s: Schedule): number {
  return lessonsPerWeek(s) * (s.hours || 0)
}

/**
 * A first schedule, worked out from what both sides already said. PURE.
 *
 * The job carries days per week and often hours per session; the tutor's
 * availability says which days and roughly when. Between them that is a
 * schedule, and a placement with none cannot be billed or priced at all — an
 * hourly placement with no schedule has no billable period, so its tutor was
 * never asked for a pre-payment and its family was never invoiced.
 *
 * It is a starting point, not a decision. The operator can change it on the
 * placement, and what the tutor and family actually agree wins.
 *
 * The one thing this will NOT invent is `hours` on an hourly placement. There,
 * hours are multiplied by the rate to make the bill: guessing two hours
 * because two is a common answer would invent what a family owes. Every other
 * rate ignores hours entirely, so a note of 2 costs nobody anything.
 */

/** After school, which is when tutoring in Addis happens. */
const DEFAULT_TIME = '17:00'

const SLOT_TIME: Record<string, string> = {
  morning: '09:00',
  afternoon: '14:00',
  evening: '17:00',
}

/** Weekdays first: a family asking for three days a week means school days. */
const PREFERRED_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/**
 * Pick `n` days spread across those available rather than the first `n`.
 * Three lessons on Mon, Tue, Wed is a worse week than Mon, Wed, Fri.
 */
export function spreadDays(available: string[], n: number): string[] {
  const days = PREFERRED_ORDER.filter((d) => available.includes(d))
  if (n >= days.length) return days
  if (n <= 0) return []

  const step = (days.length - 1) / (n - 1 || 1)
  const picked = new Set<string>()
  for (let i = 0; i < n; i++) picked.add(days[Math.round(i * step)])

  // Rounding can collide on a short list; fill from what is left, in order.
  for (const d of days) {
    if (picked.size >= n) break
    picked.add(d)
  }
  return PREFERRED_ORDER.filter((d) => picked.has(d))
}

export type DerivedSchedule =
  | { schedule: Schedule; provisional: true }
  | { schedule: null; reason: string }

export function deriveSchedule(input: {
  daysPerWeek: number
  hoursPerSession: number | null
  ratePeriod: 'per_hour' | 'per_session' | 'per_month'
  /** The tutor's grid, if they gave one: { mon: ['evening'], ... } */
  availability: Record<string, string[]> | null
}): DerivedSchedule {
  const { daysPerWeek, hoursPerSession, ratePeriod, availability } = input

  if (!Number.isFinite(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7) {
    return { schedule: null, reason: 'the job does not say how many days a week' }
  }

  // Hours are the bill on an hourly placement. Nothing here may guess them.
  if (ratePeriod === 'per_hour' && !(hoursPerSession && hoursPerSession > 0)) {
    return {
      schedule: null,
      reason: 'the job is priced by the hour and does not say how long a session runs',
    }
  }

  const offered = Object.keys(availability ?? {}).filter((d) => (availability?.[d] ?? []).length > 0)
  // No availability on file is not a blocker: days per week was agreed, and
  // weekdays are the honest default for school tutoring.
  const pool = offered.length > 0 ? offered : PREFERRED_ORDER.slice(0, 5)

  const days = spreadDays(pool, daysPerWeek)
  if (days.length === 0) return { schedule: null, reason: 'no day could be chosen' }

  // The earliest slot the tutor offers on the days chosen, so the time is one
  // they actually said yes to.
  const slots = days.flatMap((d) => availability?.[d] ?? [])
  const time =
    (['morning', 'afternoon', 'evening'].find((s) => slots.includes(s)) &&
      SLOT_TIME[['morning', 'afternoon', 'evening'].find((s) => slots.includes(s))!]) ||
    DEFAULT_TIME

  const schedule: Schedule = {
    days,
    time,
    hours: hoursPerSession && hoursPerSession > 0 ? hoursPerSession : 2,
  }

  return isValidSchedule(schedule)
    ? { schedule, provisional: true }
    : { schedule: null, reason: 'what was agreed does not make a valid schedule' }
}
