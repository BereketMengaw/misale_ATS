/**
 * One vocabulary for every status in the dashboard. PURE.
 *
 * Before this existed the same value read three ways: the jobs list printed
 * `closed_filled`, the job page printed "Filled", and the candidate page
 * printed a raw application status beside a job page that mapped it. A status
 * the operator cannot name is a status he cannot act on.
 */

import type { Tone } from '@/components/ui/badge'

export type Label = { label: string; tone: Tone }

/** A job's phase, as the operator thinks about it — not as Postgres stores it. */
export function jobLabel(status: string, approvedAt: string | null): Label {
  if (status === 'closed_filled') return { label: 'Filled', tone: 'solid-green' }
  if (status === 'closed_cancelled') return { label: 'Cancelled', tone: 'faded' }
  if (status === 'expired') return { label: 'Expired', tone: 'faded' }
  if (status === 'open') return { label: 'Live', tone: 'blue' }
  return approvedAt ? { label: 'Approved', tone: 'green' } : { label: 'Draft', tone: 'neutral' }
}

/** Where one applicant stands. */
export function applicationLabel(status: string): Label {
  switch (status) {
    case 'applied':
    case 'screened':
    case 'ranked':
      return { label: 'Applied', tone: 'neutral' }
    case 'shortlisted':
    case 'presented':
      return { label: 'Asked to accept', tone: 'blue' }
    case 'commission_agreed':
      return { label: 'Accepted', tone: 'green' }
    case 'hired':
      return { label: 'Hired', tone: 'solid-green' }
    case 'rejected':
      return { label: 'Not chosen', tone: 'faded' }
    case 'pooled':
      return { label: 'Told it was filled', tone: 'faded' }
    default:
      return { label: status, tone: 'neutral' }
  }
}

export function placementLabel(status: string): Label {
  switch (status) {
    case 'scheduled':
      return { label: 'Scheduled', tone: 'blue' }
    case 'active':
      return { label: 'Running', tone: 'green' }
    case 'paused':
      return { label: 'Paused', tone: 'amber' }
    case 'ended':
      return { label: 'Ended', tone: 'faded' }
    default:
      return { label: status, tone: 'neutral' }
  }
}

export function invoiceLabel(status: string, late: boolean): Label {
  if (status === 'paid') return { label: 'Paid', tone: 'green' }
  if (status === 'cancelled') return { label: 'Cancelled', tone: 'faded' }
  if (late) return { label: 'Late', tone: 'red' }
  if (status === 'sent') return { label: 'Sent', tone: 'neutral' }
  return { label: 'Draft', tone: 'neutral' }
}

/** What a queued message is for, in the operator's words. */
export function outboxPurposeLabel(purpose: string): string {
  switch (purpose) {
    case 'introduction':
      return 'Introduction'
    case 'invoice':
      return 'Invoice'
    case 'overdue':
      return 'Chase'
    case 'receipt':
      return 'Receipt'
    default:
      return 'Message'
  }
}

const RATE_SUFFIX: Record<string, string> = {
  per_hour: '/hour',
  per_session: '/session',
  per_month: '/month',
}

export function rateSuffix(period: string): string {
  return RATE_SUFFIX[period] ?? ''
}

// ---------------------------------------------------------------------------
// The terms, in the operator's words
// ---------------------------------------------------------------------------

import { formatEtb, prepaymentCents, split } from '@/lib/money/commission'

const PERIOD_WORD: Record<string, string> = {
  per_hour: 'per hour',
  per_session: 'per session',
  per_month: 'per month',
}

export type Terms = { net: string; upfront: string; period: string; sentence: string }

/**
 * What a tutor is about to be told, spelled out for the operator BEFORE he
 * shortlists anyone. Asking someone to accept is irreversible — the DM cannot
 * be unsent — so he should not have to remember the terms to know what he is
 * sending.
 */
export function offerTerms(rateAmount: number, ratePeriod: string, commissionPercent: number): Terms {
  const s = split(rateAmount, commissionPercent)
  const upfrontCents = prepaymentCents(s.grossCents, commissionPercent)
  const period = PERIOD_WORD[ratePeriod] ?? ''

  const net = `${formatEtb(s.netCents)} ETB ${period}`.trim()
  const upfront = `${formatEtb(upfrontCents)} ETB`

  const sentence =
    upfrontCents > 0
      ? `They keep ${net} after your ${commissionPercent}% fee, and owe a one-off ${upfront} pre-payment before the first lesson — on top of the fee, not instead of it.`
      : `They keep ${net}. You take no fee on this job.`

  return { net, upfront, period, sentence }
}
