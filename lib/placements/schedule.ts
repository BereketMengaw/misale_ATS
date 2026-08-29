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
