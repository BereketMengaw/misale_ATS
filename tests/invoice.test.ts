import { describe, expect, it } from 'vitest'
import {
  buildMonthlyInvoice, dueDate, isOverdue, lessonsInMonth,
  monthlyLine, parsePeriod, periodKey, type BillablePlacement,
} from '@/lib/money/invoice'
import { formatEtb } from '@/lib/money/commission'

const mwf = { days: ['mon', 'wed', 'fri'], time: '17:00', hours: 2 }

const monthly: BillablePlacement = {
  rateAmountEtb: 4500, ratePeriod: 'per_month', commissionPercent: 20, schedule: mwf,
}

describe('lessons in a month', () => {
  it('counts from the calendar, not from 4.33 weeks', () => {
    // September 2026: Mondays 7,14,21,28 · Wednesdays 2,9,16,23,30 · Fridays 4,11,18,25
    expect(lessonsInMonth(mwf, 2026, 9)).toBe(13)
  })

  it('gives February fewer lessons than September, as it should', () => {
    expect(lessonsInMonth(mwf, 2026, 2)).toBeLessThan(lessonsInMonth(mwf, 2026, 9))
  })

  it('handles a leap February', () => {
    expect(lessonsInMonth({ ...mwf, days: ['sat'] }, 2028, 2)).toBe(4)
  })

  it('is 0 when nothing was agreed', () => {
    expect(lessonsInMonth(null, 2026, 9)).toBe(0)
    expect(lessonsInMonth({ ...mwf, days: [] }, 2026, 9)).toBe(0)
    expect(lessonsInMonth({ ...mwf, days: ['funday'] }, 2026, 9)).toBe(0)
  })
})

describe('a monthly invoice', () => {
  it('bills a monthly rate flat, whatever the calendar says', () => {
    const sep = buildMonthlyInvoice(monthly, 2026, 9)
    const feb = buildMonthlyInvoice(monthly, 2026, 2)
    expect(sep.grossCents).toBe(450000)
    expect(feb.grossCents).toBe(450000)
  })

  it('splits it exactly the way the tutor was quoted', () => {
    const { split } = buildMonthlyInvoice(monthly, 2026, 9)
    expect(split.grossCents).toBe(450000)
    expect(split.commissionCents).toBe(90000)
    expect(split.netCents).toBe(360000)
    expect(split.commissionCents + split.netCents).toBe(split.grossCents)
    expect(formatEtb(split.netCents)).toBe('3,600')
  })

  it('bills an hourly placement for the hours the schedule actually places', () => {
    const hourly: BillablePlacement = { ...monthly, rateAmountEtb: 200, ratePeriod: 'per_hour' }
    const line = monthlyLine(hourly, 2026, 9)
    expect(line.lessons).toBe(13)
    expect(line.hours).toBe(26)
    expect(line.grossCents).toBe(520000) // 26 × 200
    expect(line.description).toBe('26 hours')
  })

  it('bills a per-session placement per lesson', () => {
    const perSession: BillablePlacement = { ...monthly, rateAmountEtb: 400, ratePeriod: 'per_session' }
    const line = monthlyLine(perSession, 2026, 9)
    expect(line.grossCents).toBe(520000) // 13 × 400
    expect(line.description).toBe('13 lessons')
  })

  it('bills nothing for an hourly placement with no agreed schedule', () => {
    const noSchedule: BillablePlacement = { ...monthly, ratePeriod: 'per_hour', schedule: null }
    expect(monthlyLine(noSchedule, 2026, 9).grossCents).toBe(0)
  })

  it('still bills a monthly placement with no schedule — the rate is the rate', () => {
    expect(monthlyLine({ ...monthly, schedule: null }, 2026, 9).grossCents).toBe(450000)
  })

  it('never loses a cent, across every month of a year', () => {
    for (let m = 1; m <= 12; m++) {
      const { split } = buildMonthlyInvoice({ ...monthly, rateAmountEtb: 4333.33 }, 2026, m)
      expect(split.commissionCents + split.netCents).toBe(split.grossCents)
    }
  })
})

describe('periods and due dates', () => {
  it('round-trips a period key', () => {
    expect(periodKey(2026, 9)).toBe('2026-09')
    expect(parsePeriod('2026-09')).toEqual({ year: 2026, month: 9 })
    expect(periodKey(2026, 12)).toBe('2026-12')
  })

  it('refuses a period that is not one', () => {
    for (const bad of ['2026-13', '2026-00', '26-09', 'September', '']) {
      expect(parsePeriod(bad), bad).toBeNull()
    }
  })

  it('counts due days forward, across a month boundary', () => {
    expect(dueDate(new Date('2026-09-28T00:00:00Z'), 7).toISOString().slice(0, 10)).toBe('2026-10-05')
  })

  it('is overdue only after the date, and never once paid', () => {
    const due = new Date('2026-09-30T00:00:00Z')
    expect(isOverdue(due, null, new Date('2026-09-29T00:00:00Z'))).toBe(false)
    expect(isOverdue(due, null, new Date('2026-10-01T00:00:00Z'))).toBe(true)
    expect(isOverdue(due, new Date('2026-10-05T00:00:00Z'), new Date('2026-10-10T00:00:00Z'))).toBe(false)
  })
})
