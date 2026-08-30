import { describe, expect, it } from 'vitest'
import {
  deriveSchedule, describeSchedule, hoursPerWeek, isValidSchedule, lessonsPerWeek,
  spreadDays, type Schedule,
} from '@/lib/placements/schedule'

const mwf: Schedule = { days: ['wed', 'mon', 'fri'], time: '17:00', hours: 2 }

describe('placement schedule', () => {
  it('reads back in day order, whatever order it was picked in', () => {
    expect(describeSchedule(mwf)).toBe('Mon, Wed, Fri at 17:00 · 2h')
  })

  it('says so plainly when there is no schedule', () => {
    expect(describeSchedule(null)).toBe('Not set')
    expect(describeSchedule({ days: [], time: '17:00', hours: 2 })).toBe('Not set')
  })

  it('accepts what the form produces and rejects what it cannot', () => {
    expect(isValidSchedule(mwf)).toBe(true)
    expect(isValidSchedule({ ...mwf, time: '7:00' })).toBe(false)
    expect(isValidSchedule({ ...mwf, time: '23:59' })).toBe(true)
    expect(isValidSchedule({ ...mwf, days: ['funday'] })).toBe(false)
    expect(isValidSchedule({ ...mwf, hours: 0 })).toBe(false)
  })

  it('counts a week the way an invoice estimate would', () => {
    expect(lessonsPerWeek(mwf)).toBe(3)
    expect(hoursPerWeek(mwf)).toBe(6)
  })
})

/**
 * A placement with no schedule cannot be billed or priced: an hourly job has
 * no billable period, so its family is never invoiced and its tutor is never
 * asked for a pre-payment. The job already says days per week and usually
 * hours per session, and the tutor already said which days they are free.
 */
describe('working out a first schedule', () => {
  const monWedFri = { mon: ['evening'], wed: ['evening'], fri: ['evening'] }

  it('takes the days per week the job asked for', () => {
    const d = deriveSchedule({
      daysPerWeek: 3, hoursPerSession: 2, ratePeriod: 'per_hour', availability: null,
    })
    expect(d.schedule?.days).toHaveLength(3)
    expect(d.schedule?.hours).toBe(2)
  })

  it('uses only days the tutor said they were free', () => {
    const d = deriveSchedule({
      daysPerWeek: 2, hoursPerSession: 1.5, ratePeriod: 'per_hour', availability: monWedFri,
    })
    for (const day of d.schedule!.days) expect(['mon', 'wed', 'fri']).toContain(day)
  })

  it('takes the time from a slot the tutor actually offered', () => {
    const morning = deriveSchedule({
      daysPerWeek: 1, hoursPerSession: 1, ratePeriod: 'per_hour',
      availability: { tue: ['morning'] },
    })
    expect(morning.schedule?.time).toBe('09:00')
  })

  /**
   * The one number this may never invent. On an hourly placement hours are
   * multiplied by the rate to make the bill, so guessing two because two is
   * common would invent what a family owes.
   */
  it('refuses to guess hours when hours are the bill', () => {
    const d = deriveSchedule({
      daysPerWeek: 3, hoursPerSession: null, ratePeriod: 'per_hour', availability: monWedFri,
    })
    expect(d.schedule).toBeNull()
    expect((d as { reason: string }).reason).toContain('how long a session runs')
  })

  it('is happy without hours when hours change nothing', () => {
    for (const ratePeriod of ['per_month', 'per_session'] as const) {
      const d = deriveSchedule({ daysPerWeek: 3, hoursPerSession: null, ratePeriod, availability: monWedFri })
      expect(d.schedule, ratePeriod).not.toBeNull()
    }
  })

  it('always produces a schedule the rest of the system accepts', () => {
    for (let days = 1; days <= 7; days++) {
      const d = deriveSchedule({
        daysPerWeek: days, hoursPerSession: 2, ratePeriod: 'per_hour', availability: null,
      })
      expect(isValidSchedule(d.schedule!), `${days} days`).toBe(true)
    }
  })

  it('says why rather than returning nothing when it cannot', () => {
    const d = deriveSchedule({
      daysPerWeek: 0, hoursPerSession: 2, ratePeriod: 'per_month', availability: null,
    })
    expect(d.schedule).toBeNull()
    expect((d as { reason: string }).reason).toBeTruthy()
  })
})

describe('spreading lessons across a week', () => {
  const week = ['mon', 'tue', 'wed', 'thu', 'fri']

  it('does not stack three lessons on consecutive days', () => {
    expect(spreadDays(week, 3)).toEqual(['mon', 'wed', 'fri'])
  })

  it('gives back everything when asked for more than there is', () => {
    expect(spreadDays(['mon', 'tue'], 5)).toEqual(['mon', 'tue'])
  })

  it('keeps the days in week order whatever order they arrive in', () => {
    expect(spreadDays(['fri', 'mon', 'wed'], 3)).toEqual(['mon', 'wed', 'fri'])
  })

  it('returns exactly what was asked for, when it can', () => {
    for (let n = 1; n <= 5; n++) expect(spreadDays(week, n)).toHaveLength(n)
  })

  it('is empty for nothing to pick from', () => {
    expect(spreadDays([], 3)).toEqual([])
    expect(spreadDays(week, 0)).toEqual([])
  })
})
