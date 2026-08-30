import { prepaymentCents } from './commission'

/**
 * The tutor's one-off pre-payment, as a ledger row rather than a sentence in a
 * chat. PURE — see CLAUDE.md.
 *
 * The amount itself comes from `prepaymentCents`: the agency's share of a
 * single billing period, charged once. This module is about the rest of it —
 * when it falls due, whether it is late, and where a tutor stands — because
 * "due within two weeks of meeting the family" is only enforceable if
 * something knows which day that was.
 *
 * It is NOT a deposit against the monthly fee. The 20% still comes out of every
 * payment, the first month included, and nothing here nets the two off.
 */

/** "Within two weeks of meeting the family" — docs/05-money.md, said in every message. */
export const PREPAYMENT_WINDOW_DAYS = 14

export type PrepaymentStatus = 'due' | 'paid' | 'waived'

export type PrepaymentTerms = {
  amountCents: number
  dueOn: Date
  percent: number
}

/**
 * What a tutor owes on one placement, and by when.
 *
 * `metFamilyOn` is the placement's start — the day the obligation begins. A
 * placement with no agreed start has not been met yet, so the caller passes the
 * hire date and the window runs from there; either way the clock starts on a
 * real event rather than on whenever the operator got round to invoicing.
 */
export function prepaymentTerms(
  grossCents: number,
  percent: number,
  metFamilyOn: Date,
  windowDays: number = PREPAYMENT_WINDOW_DAYS,
): PrepaymentTerms {
  if (!Number.isInteger(grossCents)) throw new Error('grossCents must be an integer')
  if (windowDays < 0) throw new Error('the window cannot run backwards')

  const dueOn = new Date(metFamilyOn)
  dueOn.setUTCDate(dueOn.getUTCDate() + windowDays)

  return { amountCents: prepaymentCents(grossCents, percent), dueOn, percent }
}

/** Late is a fact about time, not a stored status — the same rule invoices use. */
export function isPrepaymentOverdue(dueOn: Date, paidAt: Date | null, now: Date): boolean {
  if (paidAt) return false
  return now.getTime() > dueOn.getTime()
}

/**
 * Where one tutor stands, as a single word the UI can colour.
 *
 * `awaiting_details` comes first on purpose: a tutor who has not been told
 * where to send the money cannot be called late for not sending it. Chasing
 * somebody for a payment the system never gave them an account for is the kind
 * of thing that reads as incompetence to the person receiving it.
 */
export type PrepaymentStage = 'awaiting_details' | 'due' | 'overdue' | 'paid' | 'waived'

export type StageInput = {
  status: PrepaymentStatus
  dueOn: Date
  paidAt: Date | null
  /** Has the tutor actually been sent the account to pay into? */
  notified: boolean
}

export function prepaymentStage(row: StageInput, now: Date): PrepaymentStage {
  if (row.status === 'paid') return 'paid'
  if (row.status === 'waived') return 'waived'
  if (!row.notified) return 'awaiting_details'
  return isPrepaymentOverdue(row.dueOn, row.paidAt, now) ? 'overdue' : 'due'
}

/** Days until it falls due; negative once it is late. Whole days, UTC. */
export function daysUntilDue(dueOn: Date, now: Date): number {
  const day = 24 * 60 * 60 * 1000
  const at = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.round((at(dueOn) - at(now)) / day)
}

export type PrepaymentTotals = {
  /** Charged but not yet collected, in cents. */
  outstandingCents: number
  /** Actually received, in cents. */
  collectedCents: number
  due: number
  overdue: number
  paid: number
  waived: number
  awaitingDetails: number
}

/**
 * The top of the screen. Waived money is counted nowhere: it is neither owed
 * nor received, and adding it to either would overstate the books.
 */
/** A row as the totals need it: where it stands, plus what it is worth. */
export type CountablePrepayment = StageInput & { amountCents: number }

export function prepaymentTotals(rows: CountablePrepayment[], now: Date): PrepaymentTotals {
  const t: PrepaymentTotals = {
    outstandingCents: 0,
    collectedCents: 0,
    due: 0,
    overdue: 0,
    paid: 0,
    waived: 0,
    awaitingDetails: 0,
  }

  for (const row of rows) {
    const stage = prepaymentStage(row, now)
    if (stage === 'paid') {
      t.paid++
      t.collectedCents += row.amountCents
      continue
    }
    if (stage === 'waived') {
      t.waived++
      continue
    }

    t.outstandingCents += row.amountCents
    if (stage === 'overdue') t.overdue++
    else if (stage === 'due') t.due++
    else t.awaitingDetails++
  }

  return t
}
