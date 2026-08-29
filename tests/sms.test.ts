import { describe, expect, it } from 'vitest'
import { describeCost, smsCost } from '@/lib/messaging/sms'

describe('SMS cost', () => {
  it('fits 160 plain English characters in one segment', () => {
    expect(smsCost('a'.repeat(160))).toMatchObject({ encoding: 'GSM-7', segments: 1 })
    expect(smsCost('a'.repeat(161)).segments).toBe(2)
  })

  it('drops to 70 the moment a single Amharic letter appears', () => {
    const c = smsCost('Hello ሰላም')
    expect(c.encoding).toBe('UCS-2')
    expect(c.perSegment).toBe(70)
  })

  it('costs an Amharic message about three times an English one', () => {
    const english = smsCost('a'.repeat(140))
    const amharic = smsCost('ሀ'.repeat(140))
    expect(english.segments).toBe(1)
    expect(amharic.segments).toBe(3)
  })

  it('counts the escape characters that bill as two', () => {
    expect(smsCost('{}').units).toBe(4)
    expect(smsCost('€').units).toBe(2)
  })

  it('loses units to the header once a message is split', () => {
    expect(smsCost('a'.repeat(200)).perSegment).toBe(153)
    expect(smsCost('ሀ'.repeat(100)).perSegment).toBe(67)
  })

  it('bills an emoji outside the basic plane as two units', () => {
    expect(smsCost('🎉').units).toBe(2)
  })

  it('never reports zero segments', () => {
    expect(smsCost('').segments).toBe(1)
  })

  it('says something the operator can act on', () => {
    expect(describeCost('ሰላም')).toContain('Amharic')
    expect(describeCost('Hello')).toContain('English')
    expect(describeCost('Hello')).toContain('1 SMS')
  })
})
