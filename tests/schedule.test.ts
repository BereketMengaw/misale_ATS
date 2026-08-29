import { describe, expect, it } from 'vitest'
import {
  dueForConfirmation, dueForReminder, eatToUtc, formatEat, generateSessions,
  hoursPerWeek, isValidSchedule, lessonsPerWeek, utcToEatParts, type Schedule,
} from '@/lib/placements/schedule'

const mwf: Schedule = { days: ['mon', 'wed', 'fri'], time: '17:00', hours: 2 }

describe('Addis time', () => {
  it('converts local wall clock to the right UTC instant', () => {
    // 17:00 in Addis is 14:00 UTC.
    expect(eatToUtc(2026, 8, 7, '17:00').toISOString()).toBe('2026-09-07T14:00:00.000Z')
  })

  it('round-trips', () => {
    const utc = eatToUtc(2026, 8, 7, '17:00')
    const p = utcToEatParts(utc)
    expect([p.y, p.mo, p.d, p.h, p.mi]).toEqual([2026, 8, 7, 17, 0])
  })

  it('keeps an early lesson on the right local day', () => {
    // 01:00 Monday in Addis is 22:00 Sunday UTC — the date must not slip.
    const utc = eatToUtc(2026, 8, 7, '01:00')
    expect(utc.toISOString()).toBe('2026-09-06T22:00:00.000Z')
    expect(utcToEatParts(utc).d).toBe(7)
  })

  it('reads back the way a person would say it', () => {
    expect(formatEat(eatToUtc(2026, 8, 7, '17:00'))).toBe('Monday 7 Sep, 17:00')
  })
})

describe('generating lessons', () => {
  it('produces one lesson per chosen day, in order', () => {
    const sessions = generateSessions(mwf, '2026-09-07', '2026-09-13')
    expect(sessions).toHaveLength(3)
    expect(sessions.map(formatEat)).toEqual([
      'Monday 7 Sep, 17:00',
      'Wednesday 9 Sep, 17:00',
      'Friday 11 Sep, 17:00',
    ])
  })

  it('covers a whole month without drifting', () => {
    const sessions = generateSessions(mwf, '2026-09-01', '2026-09-30')
    expect(sessions).toHaveLength(13)
    for (const s of sessions) expect(utcToEatParts(s).h).toBe(17)
  })

  it('crosses a month boundary', () => {
    const sessions = generateSessions({ ...mwf, days: ['wed'] }, '2026-09-28', '2026-10-08')
    expect(sessions.map(formatEat)).toEqual(['Wednesday 30 Sep, 17:00', 'Wednesday 7 Oct, 17:00'])
  })

  it('includes both ends of the range', () => {
    const sessions = generateSessions({ ...mwf, days: ['mon'] }, '2026-09-07', '2026-09-07')
    expect(sessions).toHaveLength(1)
  })

  it('returns nothing rather than guessing at bad input', () => {
    expect(generateSessions({ days: [], time: '17:00', hours: 2 }, '2026-09-01', '2026-09-30')).toEqual([])
    expect(generateSessions({ days: ['xxx'], time: '17:00', hours: 2 }, '2026-09-01', '2026-09-30')).toEqual([])
    expect(generateSessions({ ...mwf, time: '25:00' }, '2026-09-01', '2026-09-30')).toEqual([])
    expect(generateSessions(mwf, '2026-09-30', '2026-09-01')).toEqual([])
  })

  it('counts a week the way an invoice will', () => {
    expect(lessonsPerWeek(mwf)).toBe(3)
    expect(hoursPerWeek(mwf)).toBe(6)
  })
})

describe('validation', () => {
  it('accepts what the form can produce and rejects what it cannot', () => {
    expect(isValidSchedule(mwf)).toBe(true)
    expect(isValidSchedule({ ...mwf, time: '7:00' })).toBe(false)
    expect(isValidSchedule({ ...mwf, time: '23:59' })).toBe(true)
    expect(isValidSchedule({ ...mwf, hours: 0 })).toBe(false)
    expect(isValidSchedule({ ...mwf, hours: 13 })).toBe(false)
  })
})

describe('reminders', () => {
  const at = (iso: string) => new Date(iso)

  it('reminds inside the lead window', () => {
    const sessions = [{ scheduledAt: at('2026-09-07T14:00:00Z'), reminderSentAt: null }]
    expect(dueForReminder(sessions, at('2026-09-07T12:30:00Z'), 120)).toHaveLength(1)
  })

  it('does not remind too early', () => {
    const sessions = [{ scheduledAt: at('2026-09-07T14:00:00Z'), reminderSentAt: null }]
    expect(dueForReminder(sessions, at('2026-09-07T08:00:00Z'), 120)).toHaveLength(0)
  })

  it('never reminds after the lesson has started', () => {
    const sessions = [{ scheduledAt: at('2026-09-07T14:00:00Z'), reminderSentAt: null }]
    expect(dueForReminder(sessions, at('2026-09-07T14:30:00Z'), 120)).toHaveLength(0)
  })

  it('never reminds twice', () => {
    const sessions = [{ scheduledAt: at('2026-09-07T14:00:00Z'), reminderSentAt: at('2026-09-07T12:00:00Z') }]
    expect(dueForReminder(sessions, at('2026-09-07T13:00:00Z'), 120)).toHaveLength(0)
  })
})

describe('asking for hours', () => {
  const at = (iso: string) => new Date(iso)
  const base = { scheduledAt: at('2026-09-07T14:00:00Z'), hours: 2, confirmedAt: null, askedAt: null }

  it('waits until the lesson has actually ended', () => {
    expect(dueForConfirmation([base], at('2026-09-07T15:00:00Z'))).toHaveLength(0)
    expect(dueForConfirmation([base], at('2026-09-07T16:00:00Z'))).toHaveLength(1)
  })

  it('does not ask twice, or ask about a confirmed lesson', () => {
    const asked = { ...base, askedAt: at('2026-09-07T16:00:00Z') }
    const done = { ...base, confirmedAt: at('2026-09-07T16:05:00Z') }
    expect(dueForConfirmation([asked], at('2026-09-07T18:00:00Z'))).toHaveLength(0)
    expect(dueForConfirmation([done], at('2026-09-07T18:00:00Z'))).toHaveLength(0)
  })
})
