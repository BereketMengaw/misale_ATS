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
