import { describe, expect, it } from 'vitest'
import { matchPayment, namesLookAlike, type Candidate } from '@/lib/payments/match'
import { parsePaymentSms } from '@/lib/payments/parse'
import { SMS_FIXTURES } from './fixtures/sms'

const selam: Candidate = { invoiceId: 1, reference: 'MIS-HK7N', grossCents: 450000, clientName: 'Selam Tesfaye', paid: false }
const hana: Candidate = { invoiceId: 2, reference: 'MIS-QW3D', grossCents: 300000, clientName: 'Hana Girma', paid: false }
const other: Candidate = { invoiceId: 3, reference: 'MIS-BB22', grossCents: 450000, clientName: 'Meron Alemu', paid: false }

const parse = (name: string) => {
  const f = SMS_FIXTURES.find((x) => x.name.includes(name))!
  return parsePaymentSms(f.body, f.sender)
}

describe('names', () => {
  it('sees through shouting and punctuation', () => {
    expect(namesLookAlike('Selam Tesfaye', 'SELAM TESFAYE')).toBe(true)
    expect(namesLookAlike('Selam Tesfaye', 'TESFAYE SELAM')).toBe(true)
  })

  it('will not match on one common word alone', () => {
    expect(namesLookAlike('Selam Tesfaye', 'Selam Bekele')).toBe(false)
    expect(namesLookAlike('Abebe Kebede', 'Hana Girma')).toBe(false)
  })

  it('is safe with missing names', () => {
    expect(namesLookAlike(null, 'Selam')).toBe(false)
    expect(namesLookAlike('Selam', null)).toBe(false)
    expect(namesLookAlike('', '')).toBe(false)
  })
})

describe('matching a payment to an invoice', () => {
  it('auto-applies only on reference AND exact amount', () => {
    const m = matchPayment(parse('CBE credit with our reference'), [selam, hana])
    expect(m).toMatchObject({ invoiceId: 1, confidence: 'high', autoApply: true })
  })

  it('refuses to auto-apply when the amount is wrong, even with the reference', () => {
    const short = { ...parse('CBE credit with our reference'), amountCents: 400000 }
    const m = matchPayment(short, [selam])
    expect(m.invoiceId).toBe(1)
    expect(m.autoApply).toBe(false)
    expect(m.reason).toBe('reference, amount differs')
  })

  it('suggests but never auto-applies without a reference', () => {
    const m = matchPayment(parse('no reference'), [hana])
    expect(m.invoiceId).toBe(2)
    expect(m.autoApply).toBe(false)
  })

  // The expensive mistake this whole design exists to prevent.
  it('gives up rather than guess between two invoices for the same amount', () => {
    const noRef = { ...parse('CBE credit with our reference'), reference: null, payer: 'UNKNOWN PERSON' }
    const m = matchPayment(noRef, [selam, other])
    expect(m.invoiceId).toBeNull()
    expect(m.confidence).toBe('none')
  })

  it('uses the payer name to separate two invoices of the same amount', () => {
    const noRef = { ...parse('CBE credit with our reference'), reference: null, payer: 'SELAM TESFAYE' }
    const m = matchPayment(noRef, [selam, other])
    expect(m.invoiceId).toBe(1)
    expect(m.autoApply).toBe(false)
  })

  it('never matches an already-paid invoice', () => {
    const m = matchPayment(parse('CBE credit with our reference'), [{ ...selam, paid: true }])
    expect(m.invoiceId).toBeNull()
  })

  it('never matches a debit to anything', () => {
    const m = matchPayment(parse('debit'), [selam, hana, other])
    expect(m.invoiceId).toBeNull()
    expect(m.autoApply).toBe(false)
  })

  it('never matches a message with no amount', () => {
    const m = matchPayment(parse('personal message'), [selam])
    expect(m.invoiceId).toBeNull()
  })

  it('matches nothing when there are no open invoices', () => {
    expect(matchPayment(parse('CBE credit with our reference'), []).invoiceId).toBeNull()
  })
})
