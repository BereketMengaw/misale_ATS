/**
 * The payment reference code. PURE.
 *
 * This is the single string that makes a payment match itself: the payer types
 * it into the payment reason, and step 11 reads it back out of a bank SMS. It
 * is therefore designed to survive being written by hand, read off a screen and
 * retyped on a phone keypad.
 *
 * The alphabet excludes 0/O, 1/I/L and the vowels, which removes both the
 * lookalike pairs and any chance of spelling a word by accident.
 *
 * There are TWO ledgers, and the prefix is what keeps them apart:
 *
 *   MIS-XXXX  a family paying their monthly invoice
 *   TUT-XXXX  a tutor paying their one-off pre-payment
 *
 * Money flows in opposite directions for opposite reasons, and both arrive as
 * the same shape of bank SMS. Sharing one code space would let a tutor's
 * transfer mark a family's invoice paid — the exact failure `match.ts` is
 * written to prevent. The prefix makes that impossible rather than unlikely.
 */

export type Ledger = 'invoice' | 'prepayment'

const ALPHABET = '23456789BCDFGHJKMNPQRSTVWXYZ'
const BODY = /^[23456789BCDFGHJKMNPQRSTVWXYZ]{4}$/
const LENGTH = 4

export const PREFIX: Record<Ledger, string> = {
  invoice: 'MIS',
  prepayment: 'TUT',
}

const LEDGERS = Object.keys(PREFIX) as Ledger[]

/**
 * What a person may type instead of each prefix.
 *
 * MIS needs the lookalikes because I is one; the body alphabet does not, since
 * it excludes every confusable character already. TUT needs nothing — U is not
 * in the alphabet, so a stray TUT can never be part of a body.
 */
const PREFIX_TYPED: Record<Ledger, RegExp> = {
  invoice: /^M[I1L]S/,
  prepayment: /^TUT/,
}

/** Which ledger a finished code belongs to, or null if it is not one of ours. */
export function ledgerOf(code: string): Ledger | null {
  const m = /^([A-Z]{3})-(.{4})$/.exec(code.toUpperCase())
  if (!m || !BODY.test(m[2])) return null
  return LEDGERS.find((l) => PREFIX[l] === m[1]) ?? null
}

/** Valid at all, or valid for one named ledger. */
export function isValidReference(code: string, ledger?: Ledger): boolean {
  const found = ledgerOf(code)
  return ledger ? found === ledger : found !== null
}

/**
 * Accepts what a person actually types: lowercase, no dash, extra spaces, the
 * prefix left off entirely, or the prefix's I typed as a 1 or an l.
 *
 * A code typed with no prefix at all is read as `fallback` — whichever ledger
 * the screen doing the asking is about. Somebody attaching a payment to an
 * invoice types four characters and means an invoice.
 */
export function normalizeReference(input: string, fallback: Ledger = 'invoice'): string | null {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, '')

  for (const ledger of LEDGERS) {
    const typed = PREFIX_TYPED[ledger]
    if (!typed.test(cleaned)) continue
    const body = cleaned.replace(typed, '')
    if (BODY.test(body)) return `${PREFIX[ledger]}-${body}`
  }

  return BODY.test(cleaned) ? `${PREFIX[fallback]}-${cleaned}` : null
}

/** Every reference-shaped string in a block of text, e.g. a bank SMS. */
export function findReferences(text: string): string[] {
  const found = new Set<string>()
  const upper = text.toUpperCase()

  for (const ledger of LEDGERS) {
    const re = new RegExp(`${PREFIX[ledger]}[\\s-]?([23456789BCDFGHJKMNPQRSTVWXYZ]{4})`, 'g')
    for (const m of upper.matchAll(re)) found.add(`${PREFIX[ledger]}-${m[1]}`)
  }

  return [...found]
}

/** A fresh code. Uniqueness is the database's job; collisions are retried. */
export function generateReference(
  ledger: Ledger = 'invoice',
  random: () => number = Math.random,
): string {
  let body = ''
  for (let i = 0; i < LENGTH; i++) {
    body += ALPHABET[Math.floor(random() * ALPHABET.length)]
  }
  return `${PREFIX[ledger]}-${body}`
}

/** How many distinct codes exist per ledger — worth knowing before trusting 4 characters. */
export const REFERENCE_SPACE = ALPHABET.length ** LENGTH
