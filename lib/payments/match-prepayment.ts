import type { ParsedPayment } from './parse'
import { ledgerOf } from '@/lib/money/reference'

/**
 * Deciding which pre-payment a tutor's transfer belongs to. PURE.
 *
 * Deliberately stricter than `match.ts`. That file can fall back to amount plus
 * a recognisable payer name because a family's invoice carries the family's
 * name and an unusual monthly figure. Neither holds here: every tutor on the
 * same rate owes the same pre-payment to the cent, so amount is almost no
 * evidence at all, and two tutors owing 4,800 ETB in the same week is ordinary
 * rather than a coincidence.
 *
 * So there is exactly one automatic route — the reference code and the exact
 * amount — and everything else is a human tap. Marking a tutor paid who has not
 * paid loses the money quietly; leaving it in the Unmatched inbox loses nothing.
 */

export type PrepaymentCandidate = {
  prepaymentId: number
  reference: string
  amountCents: number
  tutorName: string | null
  /** Already paid or waived — not a candidate for anything. */
  settled: boolean
}

export type PrepaymentMatchReason =
  | 'reference and amount'
  | 'reference, amount differs'
  | 'no tutor reference'
  | 'reference not known'

export type PrepaymentMatch = {
  prepaymentId: number | null
  confidence: 'high' | 'low' | 'none'
  reason: PrepaymentMatchReason
  autoApply: boolean
}

const nothing = (reason: PrepaymentMatchReason): PrepaymentMatch => ({
  prepaymentId: null,
  confidence: 'none',
  reason,
  autoApply: false,
})

export function matchPrepayment(
  payment: ParsedPayment,
  candidates: PrepaymentCandidate[],
): PrepaymentMatch {
  if (!payment.isCredit || payment.amountCents === null) return nothing('no tutor reference')

  // Only a TUT- code belongs to this ledger. An invoice code arriving here is
  // not a weak match to be reported — it is somebody else's money entirely.
  if (!payment.reference || ledgerOf(payment.reference) !== 'prepayment') {
    return nothing('no tutor reference')
  }

  const found = candidates.find((c) => c.reference === payment.reference)
  if (!found) return nothing('reference not known')

  // A settled pre-payment keeps its code. A second transfer quoting it is a
  // duplicate or a mistake, and either way a person should look at it.
  if (found.settled) {
    return { prepaymentId: found.prepaymentId, confidence: 'low', reason: 'reference, amount differs', autoApply: false }
  }

  if (found.amountCents === payment.amountCents) {
    return { prepaymentId: found.prepaymentId, confidence: 'high', reason: 'reference and amount', autoApply: true }
  }

  // Right tutor, wrong money — a part payment or a typo. A human decides.
  return { prepaymentId: found.prepaymentId, confidence: 'low', reason: 'reference, amount differs', autoApply: false }
}
