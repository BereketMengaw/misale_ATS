import type { ParsedPayment } from './parse'

/**
 * Deciding which invoice a payment belongs to. PURE.
 *
 * The rule that shapes all of this: a WRONG automatic match is far more
 * expensive than no match. An unmatched payment shows up as an invoice still
 * unpaid, which is visible and gets chased. A payment auto-attached to the
 * wrong invoice marks someone paid who has not paid, and nobody finds out until
 * the money is short. So auto-matching demands the reference code AND the exact
 * amount; everything else goes to the Unmatched inbox for one tap.
 */

export type Candidate = {
  invoiceId: number
  reference: string
  grossCents: number
  clientName: string | null
  /** Already settled invoices are not candidates. */
  paid: boolean
}

export type MatchReason =
  | 'reference and amount'
  | 'reference, amount differs'
  | 'amount and payer name'
  | 'amount only'
  | 'payer name only'
  | 'nothing matched'

export type Match = {
  invoiceId: number | null
  confidence: 'high' | 'low' | 'none'
  reason: MatchReason
  /** Only a high-confidence match may mark an invoice paid without a human. */
  autoApply: boolean
}

/** Loose name comparison: banks shout, shorten and reorder names. */
export function namesLookAlike(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const parts = (s: string) =>
    new Set(
      s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3),
    )

  const left = parts(a)
  const right = parts(b)
  if (left.size === 0 || right.size === 0) return false

  let shared = 0
  for (const word of left) if (right.has(word)) shared++
  return shared >= Math.min(2, Math.min(left.size, right.size))
}

export function matchPayment(payment: ParsedPayment, candidates: Candidate[]): Match {
  const open = candidates.filter((c) => !c.paid)

  if (!payment.isCredit || payment.amountCents === null) {
    return { invoiceId: null, confidence: 'none', reason: 'nothing matched', autoApply: false }
  }

  // 1. The reference code. This is what the whole design leans on.
  if (payment.reference) {
    const byRef = open.find((c) => c.reference === payment.reference)
    if (byRef) {
      if (byRef.grossCents === payment.amountCents) {
        return { invoiceId: byRef.invoiceId, confidence: 'high', reason: 'reference and amount', autoApply: true }
      }
      // Right invoice, wrong money — a part payment or a typo. A human decides.
      return { invoiceId: byRef.invoiceId, confidence: 'low', reason: 'reference, amount differs', autoApply: false }
    }
  }

  // 2. No reference. Amount plus a recognisable name is a strong hint, but only
  //    a hint: two families paying the same monthly rate is entirely normal.
  const sameAmount = open.filter((c) => c.grossCents === payment.amountCents)

  const byName = sameAmount.filter((c) => namesLookAlike(c.clientName, payment.payer))
  if (byName.length === 1) {
    return { invoiceId: byName[0].invoiceId, confidence: 'low', reason: 'amount and payer name', autoApply: false }
  }

  if (sameAmount.length === 1) {
    return { invoiceId: sameAmount[0].invoiceId, confidence: 'low', reason: 'amount only', autoApply: false }
  }

  const nameOnly = open.filter((c) => namesLookAlike(c.clientName, payment.payer))
  if (nameOnly.length === 1) {
    return { invoiceId: nameOnly[0].invoiceId, confidence: 'low', reason: 'payer name only', autoApply: false }
  }

  return { invoiceId: null, confidence: 'none', reason: 'nothing matched', autoApply: false }
}
