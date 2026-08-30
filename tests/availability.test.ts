import { describe, expect, it } from 'vitest'
import {
  availableDays, hasSlot, slotCount, splitAvailability, summarise, toggleSlot,
} from '@/lib/candidates/availability'
import { draftAvailability } from '@/lib/candidates/store'

describe('availability grid', () => {
  it('turns a slot on and back off', () => {
    let a = toggleSlot({}, 'mon', 'evening')
    expect(hasSlot(a, 'mon', 'evening')).toBe(true)
    a = toggleSlot(a, 'mon', 'evening')
    expect(hasSlot(a, 'mon', 'evening')).toBe(false)
  })

  it('drops the day entirely once its last slot goes', () => {
    let a = toggleSlot({}, 'sat', 'morning')
    expect(Object.keys(a)).toEqual(['sat'])
    a = toggleSlot(a, 'sat', 'morning')
    expect(a).toEqual({})
  })

  it('never mutates what it was given', () => {
    const original = { mon: ['morning'] }
    const next = toggleSlot(original, 'mon', 'evening')
    expect(original).toEqual({ mon: ['morning'] })
    expect(next.mon).toEqual(['evening', 'morning'])
  })

  it('counts every slot, not every day', () => {
    let a = toggleSlot({}, 'mon', 'morning')
    a = toggleSlot(a, 'mon', 'evening')
    a = toggleSlot(a, 'wed', 'afternoon')
    expect(slotCount(a)).toBe(3)
    expect(availableDays(a).sort()).toEqual(['mon', 'wed'])
  })

  it('reads back as something a person can check', () => {
    let a = toggleSlot({}, 'mon', 'morning')
    a = toggleSlot(a, 'mon', 'evening')
    expect(summarise(a, { mon: 'Mon' })).toBe('Mon (2)')
    expect(summarise({}, {})).toBe('Not set')
  })
})

/**
 * Editing one field re-saves the whole profile, so the grid has to survive a
 * round trip through the two questions that built it. If it does not, a tutor
 * correcting their phone number silently loses their availability — and the
 * ranker scores them on it.
 */
describe('taking the grid back apart', () => {
  it('returns exactly the days and times that built it', () => {
    const days = ['mon', 'wed', 'fri']
    const times = ['evening', 'morning']
    const grid = draftAvailability({ days, times })

    const back = splitAvailability(grid)
    expect(back.days.sort()).toEqual([...days].sort())
    expect(back.times).toEqual([...times].sort())
  })

  it('round-trips to the identical grid, for any answer', () => {
    const everyDay = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    const everySlot = ['morning', 'afternoon', 'evening']

    for (let d = 1; d <= everyDay.length; d++) {
      for (let t = 1; t <= everySlot.length; t++) {
        const grid = draftAvailability({ days: everyDay.slice(0, d), times: everySlot.slice(0, t) })
        expect(draftAvailability(splitAvailability(grid))).toEqual(grid)
      }
    }
  })

  it('is empty for an empty grid rather than throwing', () => {
    expect(splitAvailability({})).toEqual({ days: [], times: [] })
  })

  it('drops a day left with no slots', () => {
    expect(splitAvailability({ mon: ['morning'], tue: [] }).days).toEqual(['mon'])
  })

  /** A grid written by something other than the wizard must not narrow anyone. */
  it('keeps every time when days disagree', () => {
    const uneven = { mon: ['morning'], wed: ['evening'] }
    expect(splitAvailability(uneven).times).toEqual(['evening', 'morning'])
  })
})
