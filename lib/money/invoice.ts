import { DAY_INDEX, type Schedule } from '@/lib/placements/schedule'
import { splitCents, toCents, type Split } from './commission'

/**
 * What a parent owes for one month. PURE — see CLAUDE.md.
 *
 * Billing is monthly. A placement paid per month is billed its rate flat; one
 * paid per hour or per session is billed for the lessons that the AGREED
 * SCHEDULE actually places in that month, counted from the calendar rather
 * than estimated at 4.33 weeks. September and February are not the same month.
 */

export type BillablePlacement = {
  rateAmountEtb: number
  ratePeriod: 'per_hour' | 'per_session' | 'per_month'
  commissionPercent: number
  schedule: Schedule | null
}

/** How many times each scheduled weekday falls in a given month. */
export function lessonsInMonth(schedule: Schedule | null, year: number, month1to12: number): number {
  if (!schedule?.days?.length) return 0

  const wanted = new Set(schedule.days.map((d) => DAY_INDEX[d]).filter((n) => n !== undefined))
  if (wanted.size === 0) return 0

  const daysInMonth = new Date(Date.UTC(year, month1to12, 0)).getUTCDate()
  let count = 0
  for (let day = 1; day <= daysInMonth; day++) {
    if (wanted.has(new Date(Date.UTC(year, month1to12 - 1, day)).getUTCDay())) count++
  }
  return count
}

export type InvoiceLine = {
  description: string
  lessons: number
  hours: number
  grossCents: number
}

export function monthlyLine(
  p: BillablePlacement,
  year: number,
  month1to12: number,
): InvoiceLine {
  if (p.ratePeriod === 'per_month') {
    return {
      description: 'Monthly fee',
      lessons: lessonsInMonth(p.schedule, year, month1to12),
      hours: 0,
      grossCents: toCents(p.rateAmountEtb),
    }
  }

  const lessons = lessonsInMonth(p.schedule, year, month1to12)
  const hoursEach = p.schedule?.hours ?? 0

  if (p.ratePeriod === 'per_session') {
    return {
      description: `${lessons} lessons`,
      lessons,
      hours: lessons * hoursEach,
      grossCents: toCents(p.rateAmountEtb * lessons),
    }
  }

  const hours = lessons * hoursEach
  return {
    description: `${hours} hours`,
    lessons,
    hours,
    grossCents: toCents(p.rateAmountEtb * hours),
  }
}

export type MonthlyInvoice = InvoiceLine & { split: Split; period: string }

export function buildMonthlyInvoice(
  p: BillablePlacement,
  year: number,
  month1to12: number,
): MonthlyInvoice {
  const line = monthlyLine(p, year, month1to12)
  return {
    ...line,
    split: splitCents(line.grossCents, p.commissionPercent),
    period: periodKey(year, month1to12),
  }
}

/** "2026-09" — the month an invoice covers, and the half of its uniqueness key. */
export function periodKey(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, '0')}`
}

export function parsePeriod(period: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(period)
  if (!m) return null
  const month = Number(m[2])
  return month >= 1 && month <= 12 ? { year: Number(m[1]), month } : null
}

/** Issued on a date, payable within N days. */
export function dueDate(issuedOn: Date, dueInDays: number): Date {
  const d = new Date(issuedOn)
  d.setUTCDate(d.getUTCDate() + dueInDays)
  return d
}

export function isOverdue(due: Date, paidAt: Date | null, now: Date): boolean {
  if (paidAt) return false
  return now.getTime() > due.getTime()
}
