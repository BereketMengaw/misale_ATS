import { describe, expect, it } from 'vitest'
import { writePostTemplate } from '@/lib/ai/providers/template'
import { commissionOffer, hired } from '@/lib/hiring/messages'
import { buildMonthlyInvoice } from '@/lib/money/invoice'
import { formatEtb, split } from '@/lib/money/commission'
import { generateReference, findReferences } from '@/lib/money/reference'
import { invoiceAm } from '@/lib/messaging/parent'
import { parsePaymentSms } from '@/lib/payments/parse'
import { matchPayment } from '@/lib/payments/match'
import { payoutFor, reconciles, total } from '@/lib/money/payout'
import { smsCost } from '@/lib/messaging/sms'

/**
 * The build plan's final test: "one placement runs end to end with every figure
 * correct". Every step is a pure function, so the whole chain can be asserted
 * to the cent without a database, a bot or a bank.
 *
 * The scenario: a parent pays 4,500 ETB a month. The agency keeps 20%.
 */
describe('one placement, end to end', () => {
  const RATE = 4500
  const COMMISSION = 20

  const job = {
    subject: 'Mathematics', grade: 'Grade 9', area: 'Bole',
    daysPerWeek: 3, hoursPerSession: 2,
    rateAmount: RATE, ratePeriod: 'per_month' as const,
    genderPref: 'any' as const, startsOn: '2026-09-01', notes: null,
    commissionPercent: COMMISSION,
  }

  const expected = split(RATE, COMMISSION)

  it('1. the channel post advertises the tutor\'s take-home, not the parent\'s bill', () => {
    const { body } = writePostTemplate(job)
    expect(body).toContain('3,600 ETB per month')
    expect(body).not.toContain('4,500')
  })

  it('2. the commission offer quotes the same figure', () => {
    const offer = commissionOffer({ ...job, rateAmount: RATE }, COMMISSION)
    expect(offer).toContain('3,600 ETB per month')
    expect(offer).toContain('20%')
  })

  it('3. the hire message quotes it a third time, unchanged', () => {
    expect(hired({ ...job, rateAmount: RATE }, 'Selam', COMMISSION, 'after_first_payment', null))
      .toContain('3,600 ETB per month')
  })

  it('4. the invoice bills the parent the full rate', () => {
    const inv = buildMonthlyInvoice(
      { rateAmountEtb: RATE, ratePeriod: 'per_month', commissionPercent: COMMISSION, schedule: null },
      2026, 9,
    )
    expect(inv.split).toEqual(expected)
    expect(formatEtb(inv.split.grossCents)).toBe('4,500')
  })

  it('5. the parent gets an Amharic message with the code, inside two SMS', () => {
    const reference = generateReference()
    const message = invoiceAm(formatEtb(expected.grossCents), reference, '5 ኦክቶበር')
    expect(message).toContain('4,500')
    expect(message).toContain(reference)
    expect(smsCost(message).segments).toBeLessThanOrEqual(2)
  })

  it('6. the bank SMS is read back correctly', () => {
    const reference = 'MIS-HK7N'
    const sms =
      `Dear ABEBE KEBEDE, You have received ETB 4,500.00 from SELAM TESFAYE on 05/10/2026. ` +
      `Your Account has been Credited. Reason: ${reference}. Ref FT2624ABCDEF.`

    const parsed = parsePaymentSms(sms, 'CBE')
    expect(parsed.amountCents).toBe(expected.grossCents)
    expect(parsed.reference).toBe(reference)
    expect(parsed.isCredit).toBe(true)
    expect(findReferences(sms)).toEqual([reference])
  })

  it('7. it matches the invoice, and only because BOTH code and amount agree', () => {
    const parsed = parsePaymentSms(
      'You have received ETB 4,500.00 from SELAM TESFAYE. Reason: MIS-HK7N. Ref FT1.', 'CBE',
    )
    const candidates = [{
      invoiceId: 1, reference: 'MIS-HK7N',
      grossCents: expected.grossCents, clientName: 'Selam Tesfaye', paid: false,
    }]

    const m = matchPayment(parsed, candidates)
    expect(m).toMatchObject({ invoiceId: 1, confidence: 'high', autoApply: true })

    // One birr short and it must NOT auto-apply.
    const short = matchPayment({ ...parsed, amountCents: expected.grossCents - 100 }, candidates)
    expect(short.autoApply).toBe(false)
  })

  it('8. the payout pays the tutor exactly what they were quoted', () => {
    const payout = payoutFor({
      invoiceId: 1,
      grossCents: expected.grossCents,
      commissionCents: expected.commissionCents,
      netCents: expected.netCents,
    })
    expect(formatEtb(payout.netCents)).toBe('3,600')
    expect(formatEtb(payout.commissionCents)).toBe('900')
  })

  it('9. every figure, in one place, to the cent', () => {
    expect(expected.grossCents).toBe(450000)      // parent pays  4,500.00
    expect(expected.commissionCents).toBe(90000)  // agency keeps   900.00
    expect(expected.netCents).toBe(360000)        // tutor gets   3,600.00
    expect(expected.commissionCents + expected.netCents).toBe(expected.grossCents)
  })

  it('10. and the books balance over a full year of it', () => {
    const year = Array.from({ length: 12 }, (_, i) =>
      payoutFor({
        invoiceId: i + 1,
        grossCents: expected.grossCents,
        commissionCents: expected.commissionCents,
        netCents: expected.netCents,
      }),
    )
    const books = total(year)
    expect(reconciles(books)).toBe(true)
    expect(formatEtb(books.grossCents)).toBe('54,000')
    expect(formatEtb(books.commissionCents)).toBe('10,800')
    expect(formatEtb(books.netCents)).toBe('43,200')
  })
})
