/**
 * Turning "Mon, Wed, Fri at 17:00 for 2 hours" into actual lesson times.
 * PURE — no clock reads except the ones passed in, so every case is testable.
 *
 * Ethiopia is UTC+3 all year and has never observed daylight saving, so the
 * offset is a constant rather than a lookup. Everything is stored in UTC and
 * rendered back in local time; getting this backwards sends a reminder three
 * hours late, which is worse than not sending one.
 */

export const EAT_OFFSET_HOURS = 3

export const DAY_INDEX: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

export type Schedule = {
  /** 'mon' | 'tue' | … */
  days: string[]
  /** Local 24h time, "17:00". */
  time: string
  /** Length of one lesson. */
  hours: number
}

export function isValidSchedule(s: Schedule): boolean {
  if (!Array.isArray(s.days) || s.days.length === 0) return false
  if (!s.days.every((d) => d in DAY_INDEX)) return false
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)) return false
  return s.hours > 0 && s.hours <= 12
}

/** Local wall-clock time in Addis → the UTC instant it happens. */
export function eatToUtc(year: number, month: number, day: number, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  return new Date(Date.UTC(year, month, day, h - EAT_OFFSET_HOURS, m, 0, 0))
}

/** A UTC instant → the wall-clock time someone in Addis sees. */
export function utcToEatParts(date: Date): { y: number; mo: number; d: number; h: number; mi: number; dow: number } {
  const shifted = new Date(date.getTime() + EAT_OFFSET_HOURS * 60 * 60 * 1000)
  return {
    y: shifted.getUTCFullYear(),
    mo: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    h: shifted.getUTCHours(),
    mi: shifted.getUTCMinutes(),
    dow: shifted.getUTCDay(),
  }
}

export function formatEat(date: Date): string {
  const p = utcToEatParts(date)
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const hh = String(p.h).padStart(2, '0')
  const mm = String(p.mi).padStart(2, '0')
  return `${days[p.dow]} ${p.d} ${months[p.mo]}, ${hh}:${mm}`
}

/**
 * Every lesson between two dates, inclusive of the start day and exclusive of
 * the day after the end. `from` and `to` are plain YYYY-MM-DD local dates.
 */
export function generateSessions(schedule: Schedule, from: string, to: string): Date[] {
  if (!isValidSchedule(schedule)) return []

  const wanted = new Set(schedule.days.map((d) => DAY_INDEX[d]))
  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return []

  const out: Date[] = []
  // Walk local calendar days, not UTC instants: a lesson at 01:00 local belongs
  // to the previous UTC day, and iterating UTC would put it on the wrong date.
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (!wanted.has(cursor.getUTCDay())) continue
    out.push(
      eatToUtc(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), schedule.time),
    )
  }
  return out
}

/** How many lessons a schedule produces in a week — used for invoice estimates. */
export function lessonsPerWeek(schedule: Schedule): number {
  return isValidSchedule(schedule) ? schedule.days.length : 0
}

export function hoursPerWeek(schedule: Schedule): number {
  return lessonsPerWeek(schedule) * (schedule.hours || 0)
}

/** Which sessions are due a reminder right now. Pure: the clock is an argument. */
export function dueForReminder<T extends { scheduledAt: Date; reminderSentAt: Date | null }>(
  sessions: T[],
  now: Date,
  leadMinutes: number,
): T[] {
  const windowStart = now.getTime()
  const windowEnd = now.getTime() + leadMinutes * 60 * 1000

  return sessions.filter((s) => {
    if (s.reminderSentAt) return false
    const at = s.scheduledAt.getTime()
    // Inside the lead window and not already past — a reminder after the lesson
    // is worse than none, so late ones are dropped rather than sent.
    return at >= windowStart && at <= windowEnd
  })
}

/** Sessions that have finished and still need the tutor to confirm hours. */
export function dueForConfirmation<T extends { scheduledAt: Date; hours: number; confirmedAt: Date | null; askedAt: Date | null }>(
  sessions: T[],
  now: Date,
): T[] {
  return sessions.filter((s) => {
    if (s.confirmedAt || s.askedAt) return false
    const endsAt = s.scheduledAt.getTime() + s.hours * 60 * 60 * 1000
    return endsAt <= now.getTime()
  })
}
