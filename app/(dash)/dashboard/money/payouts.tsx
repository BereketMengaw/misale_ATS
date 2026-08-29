import { formatEtb } from '@/lib/money/commission'
import { reconciles, total, type Payout } from '@/lib/money/payout'
import { Badge, EmptyState, Table, Td, Th, Thead, Tr } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/styles'
import { payTutor } from './actions'

export type PayoutRow = {
  id: number
  invoice_id: number
  gross_cents: number | string
  commission_cents: number | string
  net_cents: number | string
  status: string
  txn_ref: string | null
  candidates: unknown
  invoices: unknown
}

/**
 * Payouts due, and the books.
 *
 * A payout exists only once its invoice is PAID, so nothing here is money the
 * agency has not already received.
 */
export function Payouts({ rows }: { rows: PayoutRow[] }) {
  if (rows.length === 0) {
    return <EmptyState>No payouts yet. One appears the moment an invoice is paid.</EmptyState>
  }

  const asPayouts = (r: PayoutRow[]): Payout[] =>
    r.map((p) => ({
      invoiceId: p.invoice_id,
      grossCents: Number(p.gross_cents),
      commissionCents: Number(p.commission_cents),
      netCents: Number(p.net_cents),
    }))

  const books = total(asPayouts(rows))

  return (
    <div className="space-y-3">
      <Table>
        <Thead>
          <Th>Tutor</Th>
          <Th>Invoice</Th>
          <Th align="right">Collected</Th>
          <Th align="right">Your cut</Th>
          <Th align="right">To pay</Th>
          <Th align="right">Status</Th>
        </Thead>
        <tbody>
          {rows.map((p) => {
            const tutor = p.candidates as { full_name: string | null; phone: string | null } | null
            const inv = p.invoices as { reference: string; period: string } | null
            return (
              <Tr key={p.id}>
                <Td>
                  {tutor?.full_name ?? '—'}
                  {tutor?.phone && <span className="ml-2 text-xs text-neutral-400">{tutor.phone}</span>}
                </Td>
                <Td className="font-mono text-xs text-neutral-500">
                  {inv?.reference} · {inv?.period}
                </Td>
                <Td align="right" className="text-neutral-500">{formatEtb(Number(p.gross_cents))}</Td>
                <Td align="right" className="text-green-800">{formatEtb(Number(p.commission_cents))}</Td>
                <Td align="right" className="font-medium">{formatEtb(Number(p.net_cents))}</Td>
                <Td align="right">
                  {p.status === 'paid' ? (
                    <Badge tone="green">paid{p.txn_ref && ` · ${p.txn_ref}`}</Badge>
                  ) : (
                    <form action={payTutor} className="flex items-center justify-end gap-1.5">
                      <input type="hidden" name="payoutId" value={p.id} />
                      <input
                        name="txnRef"
                        aria-label="Transfer reference"
                        placeholder="txn ref"
                        className={`${inputClass} w-24 px-2 py-1 text-xs`}
                      />
                      <Button variant="primary" size="sm" pendingLabel="Saving…">
                        Mark paid
                      </Button>
                    </form>
                  )}
                </Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>

      {/* The books. Every birr collected is either yours or a tutor's. */}
      <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-neutral-100 pt-3 text-sm">
        <div className="flex gap-2">
          <dt className="text-neutral-500">Collected</dt>
          <dd className="font-medium tabular-nums">{formatEtb(books.grossCents)} ETB</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-neutral-500">Yours</dt>
          <dd className="font-medium tabular-nums text-green-800">{formatEtb(books.commissionCents)} ETB</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-neutral-500">Tutors&rsquo;</dt>
          <dd className="font-medium tabular-nums">{formatEtb(books.netCents)} ETB</dd>
        </div>
        <div className="ml-auto text-xs">
          {reconciles(books) ? (
            <span className="text-green-700">balances ✓</span>
          ) : (
            <span className="font-medium text-red-700">DOES NOT BALANCE — do not pay anyone</span>
          )}
        </div>
      </dl>
    </div>
  )
}
