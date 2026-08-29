import { describe, expect, it } from 'vitest'
import { describeSchedule, hoursPerWeek, isValidSchedule, lessonsPerWeek, type Schedule } from '@/lib/placements/schedule'

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
