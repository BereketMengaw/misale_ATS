import { describe, expect, it } from 'vitest'
import {
  daysUntilDue, isPrepaymentOverdue, PREPAYMENT_WINDOW_DAYS, prepaymentStage,
  prepaymentTerms, prepaymentTotals, type CountablePrepayment, type StageInput,
} from '@/lib/money/prepayment'
import { prepayment, split, toCents } from '@/lib/money/commission'
import { checkAccount, isPayable } from '@/lib/candidates/payout-details'
import { matchPrepayment, type PrepaymentCandidate } from '@/lib/payments/match-prepayment'
import type { ParsedPayment } from '@/lib/payments/parse'

const met = new Date('2026-09-01T00:00:00Z')

describe('the pre-payment charge', () => {
  it('is one billing period of the fee, to the cent', () => {
    const gross = toCents(24000)
    expect(prepaymentTerms(gross, 20, met).amountCents).toBe(480000)
    expect(prepaymentTerms(gross, 20, met).amountCents).toBe(prepayment(24000, 20))
  })

  it('falls due two weeks after they meet the family', () => {
    expect(prepaymentTerms(toCents(24000), 20, met).dueOn.toISOString().slice(0, 10)).toBe('2026-09-15')
    expect(PREPAYMENT_WINDOW_DAYS).toBe(14)
  })

  it('carries the window across a month end rather than into day 30-something', () => {
    const late = new Date('2026-09-25T00:00:00Z')
    expect(prepaymentTerms(toCents(24000), 20, late).dueOn.toISOString().slice(0, 10)).toBe('2026-10-09')
  })

  /**
   * The whole reason `prepaymentCents` is its own function. A tutor pays the
   * fee twice over their first period, and any test that let these net off
   * would be asserting a lie the tutor was never told.
   */
  it('is on top of the monthly fee, never instead of it', () => {
    const gross = toCents(24000)
    const terms = prepaymentTerms(gross, 20, met)
    const monthly = split(24000, 20)

    expect(terms.amountCents).toBe(monthly.commissionCents)
    expect(terms.amountCents + monthly.commissionCents).toBe(960000)
    expect(monthly.netCents).toBe(1920000)
  })

  it('is nothing at all when the agency takes nothing', () => {
    expect(prepaymentTerms(toCents(24000), 0, met).amountCents).toBe(0)
  })

  it('refuses a window that runs backwards', () => {
    expect(() => prepaymentTerms(toCents(24000), 20, met, -1)).toThrow()
  })
})

describe('whether a tutor is late', () => {
  const due = new Date('2026-09-15T00:00:00Z')

  it('is late only once the day has passed and nothing arrived', () => {
    expect(isPrepaymentOverdue(due, null, new Date('2026-09-14T00:00:00Z'))).toBe(false)
    expect(isPrepaymentOverdue(due, null, new Date('2026-09-16T00:00:00Z'))).toBe(true)
  })

  it('is never late once it is paid, however long it took', () => {
    expect(isPrepaymentOverdue(due, new Date('2026-10-30T00:00:00Z'), new Date('2026-11-01T00:00:00Z'))).toBe(false)
  })

  it('counts whole days either side of the date', () => {
    expect(daysUntilDue(due, new Date('2026-09-10T22:00:00Z'))).toBe(5)
    expect(daysUntilDue(due, new Date('2026-09-15T09:00:00Z'))).toBe(0)
    expect(daysUntilDue(due, new Date('2026-09-18T01:00:00Z'))).toBe(-3)
  })
})

describe('where a tutor stands', () => {
  const base: StageInput = {
    status: 'due',
    dueOn: new Date('2026-09-15T00:00:00Z'),
    paidAt: null,
    notified: true,
  }
  const after = new Date('2026-09-20T00:00:00Z')
  const before = new Date('2026-09-10T00:00:00Z')

  /**
   * The rule that matters most in this file. Nobody is chased for a payment the
   * system never gave them an account for — an overdue badge on a tutor who was
   * never asked is the agency's failure being shown as theirs.
   */
  it('is never late when they were never asked', () => {
    expect(prepaymentStage({ ...base, notified: false }, after)).toBe('awaiting_details')
    expect(prepaymentStage({ ...base, notified: true }, after)).toBe('overdue')
  })

  it('reads asked, then late, as the date passes', () => {
    expect(prepaymentStage(base, before)).toBe('due')
    expect(prepaymentStage(base, after)).toBe('overdue')
  })

  it('lets paid and waived outrank everything, including being late', () => {
    expect(prepaymentStage({ ...base, status: 'paid', paidAt: after }, after)).toBe('paid')
    expect(prepaymentStage({ ...base, status: 'waived' }, after)).toBe('waived')
    expect(prepaymentStage({ ...base, status: 'paid', notified: false }, after)).toBe('paid')
  })
})

describe('the pre-payment books', () => {
  const now = new Date('2026-09-20T00:00:00Z')
  const at = (d: string) => new Date(`${d}T00:00:00Z`)

  const rows: CountablePrepayment[] = [
    { amountCents: 480000, status: 'due', dueOn: at('2026-09-15'), paidAt: null, notified: true },
    { amountCents: 300000, status: 'due', dueOn: at('2026-09-30'), paidAt: null, notified: true },
    { amountCents: 200000, status: 'due', dueOn: at('2026-09-01'), paidAt: null, notified: false },
    { amountCents: 100000, status: 'paid', dueOn: at('2026-09-01'), paidAt: at('2026-09-02'), notified: true },
    { amountCents: 900000, status: 'waived', dueOn: at('2026-09-01'), paidAt: null, notified: true },
  ]

  it('counts every stage exactly once', () => {
    const t = prepaymentTotals(rows, now)
    expect(t.overdue).toBe(1)
    expect(t.due).toBe(1)
    expect(t.awaitingDetails).toBe(1)
    expect(t.paid).toBe(1)
    expect(t.waived).toBe(1)
    expect(t.overdue + t.due + t.awaitingDetails + t.paid + t.waived).toBe(rows.length)
  })

  it('adds outstanding money to the cent', () => {
    expect(prepaymentTotals(rows, now).outstandingCents).toBe(480000 + 300000 + 200000)
    expect(prepaymentTotals(rows, now).collectedCents).toBe(100000)
  })

  /** Waived money is not owed and was not received. It belongs in neither column. */
  it('never counts a waived charge as owed or as collected', () => {
    const t = prepaymentTotals(rows, now)
    const withoutIt = prepaymentTotals(rows.filter((r) => r.status !== 'waived'), now)

    // Every birr in the books is either still owed or already collected.
    expect(t.outstandingCents + t.collectedCents).toBe(1080000)
    // And dropping the waived row moves neither figure by a cent.
    expect(t.outstandingCents).toBe(withoutIt.outstandingCents)
    expect(t.collectedCents).toBe(withoutIt.collectedCents)
  })

  it('is all zeroes with nothing to count', () => {
    const t = prepaymentTotals([], now)
    expect(t.outstandingCents).toBe(0)
    expect(t.collectedCents).toBe(0)
  })
})

describe('where a tutor is paid', () => {
  it('takes an account number however it was spaced', () => {
    expect(checkAccount('1000 1234 56789')).toEqual({ ok: true, account: '1000123456789' })
    expect(checkAccount('0911-234-567')).toEqual({ ok: true, account: '0911234567' })
  })

  it('refuses what is not an account number, with a reason', () => {
    expect(checkAccount('')).toMatchObject({ ok: false, reason: 'empty' })
    expect(checkAccount('Abebe Kebede')).toMatchObject({ ok: false, reason: 'not-digits' })
    expect(checkAccount('12345')).toMatchObject({ ok: false, reason: 'too-short' })
    expect(checkAccount('1'.repeat(21))).toMatchObject({ ok: false, reason: 'too-long' })
  })

  it('is payable only with all three of provider, account and name', () => {
    expect(isPayable({ provider: 'cbe', account: '1000123456789', name: 'Abebe' })).toBe(true)
    expect(isPayable({ provider: 'cbe', account: '1000123456789', name: null })).toBe(false)
    expect(isPayable({ provider: null, account: '1000123456789', name: 'Abebe' })).toBe(false)
  })
})

describe('matching a tutor payment', () => {
  const paid = (over: Partial<ParsedPayment> = {}): ParsedPayment =>
    ({
      provider: 'cbe',
      amountCents: 480000,
      payer: 'ABEBE KEBEDE',
      txnRef: 'FT26090001',
      reference: 'TUT-HK7N',
      receiptUrl: null,
      isCredit: true,
      ...over,
    }) as ParsedPayment

  const candidates: PrepaymentCandidate[] = [
    { prepaymentId: 1, reference: 'TUT-HK7N', amountCents: 480000, tutorName: 'Abebe Kebede', settled: false },
    { prepaymentId: 2, reference: 'TUT-J4RP', amountCents: 480000, tutorName: 'Sara Tesfaye', settled: false },
  ]

  it('settles on the code and the exact amount, and only then', () => {
    const m = matchPrepayment(paid(), candidates)
    expect(m).toMatchObject({ prepaymentId: 1, confidence: 'high', autoApply: true })
  })

  /**
   * The reason this matcher is stricter than the invoice one: two tutors on the
   * same rate owe the same figure to the cent, so amount is almost no evidence.
   */
  it('never auto-applies on the amount alone, however unique it looks', () => {
    const m = matchPrepayment(paid({ reference: null }), candidates)
    expect(m.autoApply).toBe(false)
    expect(m.prepaymentId).toBeNull()
  })

  it('never touches a family invoice code', () => {
    const m = matchPrepayment(paid({ reference: 'MIS-HK7N' }), candidates)
    expect(m).toMatchObject({ prepaymentId: null, autoApply: false, reason: 'no tutor reference' })
  })

  it('hands a part payment to a person rather than settling it', () => {
    const m = matchPrepayment(paid({ amountCents: 200000 }), candidates)
    expect(m).toMatchObject({ prepaymentId: 1, confidence: 'low', autoApply: false })
  })

  it('does not settle the same charge twice', () => {
    const settled = candidates.map((c) => ({ ...c, settled: true }))
    expect(matchPrepayment(paid(), settled).autoApply).toBe(false)
  })

  it('ignores money going out', () => {
    expect(matchPrepayment(paid({ isCredit: false }), candidates).autoApply).toBe(false)
  })

  it('says so plainly when the code belongs to nothing', () => {
    const m = matchPrepayment(paid({ reference: 'TUT-W9XZ' }), candidates)
    expect(m).toMatchObject({ prepaymentId: null, reason: 'reference not known' })
  })
})
