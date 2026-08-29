/**
 * Bank SMS fixtures.
 *
 * ⚠️  EVERY MESSAGE BELOW IS INVENTED, written from the documented shapes.
 * They are NOT real messages anyone has received, so the parsers built against
 * them are guesses.
 *
 * TO MAKE THE PARSERS REAL:
 *   1. Forward yourself a genuine CBE and Telebirr payment alert.
 *   2. Paste the body and its sender id here, editing only the amount and name.
 *   3. Set `real: true` on it.
 *   4. Run `npm test` and adjust lib/payments/parse.ts until it passes.
 *
 * Nothing else has to change. The `real` flag exists so the suite can report
 * how much of this is still guesswork.
 */

export type Fixture = {
  name: string
  real: boolean
  /** The alphanumeric sender id the message arrived from, e.g. "CBE". */
  sender: string
  body: string
  expect: {
    provider: 'cbe' | 'telebirr' | 'awash' | 'unknown'
    amountCents: number | null
    payer: string | null
    reference: string | null
    isCredit: boolean
  }
}

export const SMS_FIXTURES: Fixture[] = [
  {
    name: 'CBE credit with our reference',
    real: false,
    sender: 'CBE',
    body:
      'Dear ABEBE KEBEDE, You have received ETB 4,500.00 from SELAM TESFAYE on 29/08/2026 ' +
      'at 14:32. Your Account 1000123456789 has been Credited. Reason: MIS-HK7N. ' +
      'Your Current Balance is ETB 12,345.00. Ref FT2624ABCDEF. ' +
      'https://apps.cbe.com.et/?id=FT2624ABCDEF12345678',
    expect: {
      provider: 'cbe', amountCents: 450000, payer: 'SELAM TESFAYE',
      reference: 'MIS-HK7N', isCredit: true,
    },
  },
  {
    name: 'CBE credit with no reference in the reason',
    real: false,
    sender: 'CBE',
    body:
      'Dear ABEBE KEBEDE, You have received ETB 3,000.00 from HANA GIRMA on 01/09/2026 ' +
      'at 09:10. Your Account 1000123456789 has been Credited. Ref FT2624ZZZZZZ.',
    expect: {
      provider: 'cbe', amountCents: 300000, payer: 'HANA GIRMA',
      reference: null, isCredit: true,
    },
  },
  {
    name: 'Telebirr credit',
    real: false,
    sender: 'telebirr',
    body:
      'You have received ETB 4,500.00 from Selam Tesfaye (0911234567). ' +
      'Your transaction number is CH2408291432. Reason MIS HK7N. ' +
      'Your telebirr balance is ETB 8,900.00.',
    expect: {
      provider: 'telebirr', amountCents: 450000, payer: 'Selam Tesfaye',
      reference: 'MIS-HK7N', isCredit: true,
    },
  },
  {
    name: 'a debit, which must never mark anything paid',
    real: false,
    sender: 'CBE',
    body:
      'Dear ABEBE KEBEDE, Your Account 1000123456789 has been Debited with ETB 1,200.00 ' +
      'on 29/08/2026. Your Current Balance is ETB 11,145.00. Ref FT2624DEBIT1.',
    expect: {
      provider: 'cbe', amountCents: 120000, payer: null,
      reference: null, isCredit: false,
    },
  },
  {
    name: 'a personal message that slipped past the sender allowlist',
    real: false,
    sender: '+251911999888',
    body: 'Hey, are we still meeting at 5? Bring the book.',
    expect: {
      provider: 'unknown', amountCents: null, payer: null,
      reference: null, isCredit: false,
    },
  },
  {
    name: 'an airtime top-up, which is money but not a payment to us',
    real: false,
    sender: 'ethiotelecom',
    body: 'You have recharged ETB 100.00. Your balance is ETB 143.50.',
    expect: {
      provider: 'telebirr', amountCents: 10000, payer: null,
      reference: null, isCredit: false,
    },
  },
]

/** How much of the parser is still guesswork. */
export const REAL_FIXTURE_COUNT = SMS_FIXTURES.filter((f) => f.real).length
