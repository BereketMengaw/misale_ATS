/**
 * What the tutor is owed once a parent has paid. PURE — see CLAUDE.md.
 *
 * A payout is derived from an invoice that has been PAID, never from one that
 * has merely been sent. The agency does not front money it has not received.
 */

export type PaidInvoice = {
  invoiceId: number
  grossCents: number
  commissionCents: number
  netCents: number
}

export type Payout = {
  invoiceId: number
  grossCents: number
  commissionCents: number
  netCents: number
}

/**
 * The split is copied from the invoice, not recomputed. The commission
 * percentage may have been changed in settings since; what was agreed and
 * invoiced is what gets paid.
 */
export function payoutFor(invoice: PaidInvoice): Payout {
  const { grossCents, commissionCents, netCents } = invoice
  if (commissionCents + netCents !== grossCents) {
    throw new Error(
      `invoice ${invoice.invoiceId} does not add up: ${commissionCents} + ${netCents} ≠ ${grossCents}`,
    )
  }
  return { invoiceId: invoice.invoiceId, grossCents, commissionCents, netCents }
}

export type Totals = {
  count: number
  grossCents: number
  commissionCents: number
  netCents: number
}

export function total(payouts: Payout[]): Totals {
  return payouts.reduce<Totals>(
    (t, p) => ({
      count: t.count + 1,
      grossCents: t.grossCents + p.grossCents,
      commissionCents: t.commissionCents + p.commissionCents,
      netCents: t.netCents + p.netCents,
    }),
    { count: 0, grossCents: 0, commissionCents: 0, netCents: 0 },
  )
}

/**
 * The books balance. Every birr collected is either the agency's or the
 * tutor's; there is no third place for it to be.
 */
export function reconciles(totals: Totals): boolean {
  return totals.commissionCents + totals.netCents === totals.grossCents
}
