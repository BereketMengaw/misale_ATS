import { describe, expect, it } from 'vitest'
import { isValidPhone, normalizePhone } from '@/lib/candidates/phone'

describe('Ethiopian phone numbers', () => {
  it('accepts every way someone writes the same number', () => {
    for (const written of [
      '0911234567',
      '+251911234567',
      '251911234567',
      '00251911234567',
      '911234567',
      '0911 234 567',
      '+251 91 123 4567',
      '0911-234-567',
      '(0911) 234567',
    ]) {
      const r = normalizePhone(written)
      expect(r.ok, written).toBe(true)
      if (r.ok) {
        expect(r.e164).toBe('+251911234567')
        expect(r.national).toBe('0911234567')
      }
    }
  })

  it('accepts Safaricom 07 numbers', () => {
    const r = normalizePhone('0712345678')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.e164).toBe('+251712345678')
  })

  it('accepts the number that got stuck in the wizard', () => {
    const r = normalizePhone('0907152943')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.e164).toBe('+251907152943')
  })

  it('rejects landlines and short numbers', () => {
    expect(normalizePhone('0111234567')).toEqual({ ok: false, reason: 'not_mobile' })
    expect(normalizePhone('091123')).toEqual({ ok: false, reason: 'too_short' })
    expect(normalizePhone('09112345678901')).toEqual({ ok: false, reason: 'too_long' })
  })

  it('rejects other countries', () => {
    expect(isValidPhone('+14155552671')).toBe(false)
    expect(isValidPhone('+442071234567')).toBe(false)
  })

  it('rejects text that is not a number at all', () => {
    for (const junk of ['', '   ', 'E', 'hello', 'call me']) {
      expect(isValidPhone(junk)).toBe(false)
    }
  })

  it('always produces E.164 that Telegram and SMS both accept', () => {
    const r = normalizePhone('0911234567')
    if (r.ok) expect(r.e164).toMatch(/^\+251[97]\d{8}$/)
  })
})
