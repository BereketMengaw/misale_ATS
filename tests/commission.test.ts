import { describe, expect, it } from 'vitest'
import { firstPeriodCost, formatEtb, fromCents, prepayment, split, splitCents, toCents, tutorPay } from '@/lib/money/commission'

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

describe('the tutor pre-payment', () => {
  it('is one period of commission, paid up front', () => {
    expect(prepayment(4500, 20)).toBe(90000)
    expect(prepayment(4000, 20)).toBe(80000)
  })

  it('is charged ON TOP of the monthly deduction, not instead of it', () => {
    // A tutor on 4,000/month at 20% pays 800 up front AND has 800 deducted
    // from the first month. Treating the pre-payment as a deposit would make
    // this 800, and would short the agency by a month's fee on every hire.
    expect(firstPeriodCost(4000, 20)).toBe(160000)
    expect(firstPeriodCost(4000, 20)).toBe(prepayment(4000, 20) + split(4000, 20).commissionCents)
  })

  it('never loses a cent against the split it comes from', () => {
    for (const amount of [1, 33.33, 999.99, 4500, 12345.67]) {
      for (const percent of [0, 7.5, 20, 33, 99]) {
        expect(prepayment(amount, percent)).toBe(split(amount, percent).commissionCents)
      }
    }
  })

  it('is nothing when the agency takes nothing', () => {
    expect(prepayment(4500, 0)).toBe(0)
    expect(firstPeriodCost(4500, 0)).toBe(0)
  })
})
