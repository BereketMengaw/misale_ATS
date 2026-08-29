import { describe, expect, it } from 'vitest'
import { availableDays, hasSlot, slotCount, summarise, toggleSlot } from '@/lib/candidates/availability'

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
