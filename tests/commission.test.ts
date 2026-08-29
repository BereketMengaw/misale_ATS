import { describe, expect, it } from 'vitest'
import { formatEtb, fromCents, split, splitCents, toCents, tutorPay } from '@/lib/money/commission'

describe('commission split', () => {
  it('splits the advertised rate the way the operator decided', () => {
    const s = split(4500, 20)
    expect(s.grossCents).toBe(450000)
    expect(s.commissionCents).toBe(90000) // 900.00
    expect(s.netCents).toBe(360000) // 3,600.00
    expect(tutorPay(4500, 20)).toBe(3600)
  })

  it('never loses or invents a cent, at any amount or rate', () => {
    for (let gross = 0; gross <= 20000; gross += 7) {
      for (const percent of [0, 5, 12.5, 20, 33.33, 99]) {
        const s = splitCents(gross, percent)
        expect(s.commissionCents + s.netCents).toBe(s.grossCents)
        expect(Number.isInteger(s.commissionCents)).toBe(true)
        expect(Number.isInteger(s.netCents)).toBe(true)
        expect(s.commissionCents).toBeGreaterThanOrEqual(0)
        expect(s.netCents).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('rounds the half cent into the commission, not into thin air', () => {
    // 1 cent at 50% is half a cent.
    const s = splitCents(1, 50)
    expect(s.commissionCents).toBe(1)
    expect(s.netCents).toBe(0)
    expect(s.commissionCents + s.netCents).toBe(1)
  })

  it('survives the amounts that break floating point', () => {
    expect(split(0.1, 20).grossCents).toBe(10)
    expect(split(0.3, 20).grossCents).toBe(30)
    expect(toCents(1234.56)).toBe(123456)
    expect(fromCents(123456)).toBe(1234.56)
    // 8.245 * 100 in floats is 824.4999999999999
    expect(toCents(8.245)).toBe(825)
  })

  it('gives everything to the tutor at 0%', () => {
    const s = split(4500, 0)
    expect(s.commissionCents).toBe(0)
    expect(s.netCents).toBe(450000)
  })

  it('refuses nonsense rather than producing a wrong number', () => {
    expect(() => splitCents(100, 100)).toThrow()
    expect(() => splitCents(100, -1)).toThrow()
    expect(() => splitCents(-100, 20)).toThrow()
    expect(() => splitCents(100.5, 20)).toThrow()
  })

  it('formats the way an invoice should read', () => {
    expect(formatEtb(450000)).toBe('4,500')
    expect(formatEtb(360000)).toBe('3,600')
    expect(formatEtb(123456)).toBe('1,234.56')
    expect(formatEtb(50)).toBe('0.50')
    expect(formatEtb(0)).toBe('0')
  })

  it('a real month, end to end, to the cent', () => {
    // 12 lessons at 375.50 billed to the parent, 20% to the agency.
    const gross = toCents(12 * 375.5)
    const s = splitCents(gross, 20)
    expect(gross).toBe(450600)
    expect(s.commissionCents).toBe(90120) // 901.20
    expect(s.netCents).toBe(360480) // 3,604.80
    expect(formatEtb(s.netCents)).toBe('3,604.80')
  })
})
