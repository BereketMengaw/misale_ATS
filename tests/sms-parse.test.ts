import { describe, expect, it } from 'vitest'
import { looksLikePayment, parseAmountCents, parsePaymentSms, tidyName } from '@/lib/payments/parse'
import { REAL_FIXTURE_COUNT, SMS_FIXTURES } from './fixtures/sms'

describe('amounts', () => {
  it('reads every shape a bank writes a number in', () => {
    expect(parseAmountCents('4,500.00')).toBe(450000)
    expect(parseAmountCents('4500')).toBe(450000)
    expect(parseAmountCents('4500.5')).toBe(450050)
    expect(parseAmountCents('0.99')).toBe(99)
    expect(parseAmountCents(' 1,234,567.89 ')).toBe(123456789)
  })

  it('returns null rather than guessing at nonsense', () => {
    for (const junk of ['', '  ', 'abc', '4.5.6', '4,50 0', '-100', '4500.999', null, undefined]) {
      expect(parseAmountCents(junk as string), String(junk)).toBeNull()
    }
  })

  it('never lets a float touch money', () => {
    expect(Number.isInteger(parseAmountCents('8.245')! ?? 0)).toBe(true)
    expect(parseAmountCents('0.10')).toBe(10)
    expect(parseAmountCents('0.30')).toBe(30)
  })
})

describe('names', () => {
  it('tidies without mangling', () => {
    expect(tidyName('  SELAM   TESFAYE  ')).toBe('SELAM TESFAYE')
    expect(tidyName('Hana Girma.')).toBe('Hana Girma')
    expect(tidyName('A')).toBeNull()
    expect(tidyName('x'.repeat(80))).toBeNull()
  })
})

describe('parsing bank messages', () => {
  for (const f of SMS_FIXTURES) {
    it(f.name, () => {
      const p = parsePaymentSms(f.body, f.sender)
      expect(p.provider).toBe(f.expect.provider)
      expect(p.amountCents).toBe(f.expect.amountCents)
      expect(p.payer).toBe(f.expect.payer)
      expect(p.reference).toBe(f.expect.reference)
      expect(p.isCredit).toBe(f.expect.isCredit)
    })
  }

  it('reads the CBE receipt link, for the fallback to open', () => {
    const p = parsePaymentSms(SMS_FIXTURES[0].body, SMS_FIXTURES[0].sender)
    expect(p.receiptUrl).toBe('https://apps.cbe.com.et/?id=FT2624ABCDEF12345678')
    expect(p.txnRef).toBe('FT2624ABCDEF')
  })

  // The one that would cost real money to get wrong.
  it('never treats a debit as a payment received', () => {
    const debit = SMS_FIXTURES.find((f) => f.name.includes('debit'))!
    expect(parsePaymentSms(debit.body, debit.sender).isCredit).toBe(false)
    expect(looksLikePayment(debit.body, debit.sender)).toBe(false)
  })

  it('drops a personal message without keeping its text', () => {
    expect(looksLikePayment('Hey, are we still meeting at 5?')).toBe(false)
  })

  it('survives an empty or nonsense body without throwing', () => {
    for (const junk of ['', '   ', '???', '\n\n']) {
      expect(() => parsePaymentSms(junk)).not.toThrow()
      expect(looksLikePayment(junk)).toBe(false)
    }
  })
})

describe('provider detection', () => {
  it('trusts the sender id over the body', () => {
    // A CBE alert that never says "CBE" anywhere in its text.
    expect(parsePaymentSms('Your Account has been Credited with ETB 100.00', 'CBE').provider).toBe('cbe')
  })

  it('falls back to the body when there is no sender', () => {
    expect(parsePaymentSms('paid via telebirr, ETB 50.00 received').provider).toBe('telebirr')
  })

  it('says unknown rather than guessing a bank', () => {
    expect(parsePaymentSms('ETB 50.00 received', '+251911000000').provider).toBe('unknown')
  })
})

describe('how real is this parser', () => {
  it('reports honestly that it is still built on invented messages', () => {
    // Flip to a real assertion once genuine SMS bodies are in the fixtures.
    if (REAL_FIXTURE_COUNT === 0) {
      expect(REAL_FIXTURE_COUNT).toBe(0)
    } else {
      expect(REAL_FIXTURE_COUNT).toBeGreaterThanOrEqual(2)
    }
  })
})
