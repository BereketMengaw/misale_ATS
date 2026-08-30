import { formatEtb } from '@/lib/money/commission'
import {
  daysUntilDue, prepaymentStage, prepaymentTotals, type CountablePrepayment,
} from '@/lib/money/prepayment'
import { providerLabel, type PayoutProvider } from '@/lib/candidates/payout-details'
import { prepaymentLabel } from '@/lib/ui/labels'
import { Badge, EmptyState, Table, Td, Th, Thead, Tr } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { askPrepayment, markPrepaymentSettled, waiveCharge } from './actions'

export type PrepaymentRow = {
  id: number
  amount_cents: number | string
  reference: string
  status: string
  due_on: string
  notified_at: string | null
  paid_at: string | null
  note: string | null
  candidates: unknown
  placements: unknown
}

/**
 * The tutor's one-off charge, tracked.
 *
 * Until this existed the pre-payment was words in a chat: `commissionOffer`
 * quoted the figure, the knowledge base explained it, and nothing recorded that
 * anybody owed it or ever paid. The operator's only way to know was to
 * remember — for every tutor, from a message sent weeks earlier.
 *
 * Read left to right, each row is the whole story: who, how much, whether they
 * have been told where to send it, whether it arrived, and where their own
 * payouts will go.
 */
export function Prepayments({
  rows,
  now,
  canAsk,
}: {
  rows: PrepaymentRow[]
  now: Date
  canAsk: boolean
}) {
  if (rows.length === 0) {
    return (
      <EmptyState>
        No pre-payments yet. One is raised automatically at each hire, for the placement that was
        agreed.
      </EmptyState>
    )
  }

  const countable: CountablePrepayment[] = rows.map((r) => ({
    amountCents: Number(r.amount_cents),
    status: r.status as CountablePrepayment['status'],
    dueOn: new Date(`${r.due_on}T00:00:00Z`),
    paidAt: r.paid_at ? new Date(r.paid_at) : null,
    notified: Boolean(r.notified_at),
  }))

  const t = prepaymentTotals(countable, now)

  return (
    <div className="space-y-3">
      {!canAsk && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">
          No account is configured, so nobody can be asked for this money — a message that requests
          a payment without saying where to send it is what forced the old &ldquo;call us for
          detail&rdquo;. Add one under{' '}
          <a href="/dashboard/settings" className="font-medium underline">
            Settings → Payment details
          </a>
          .
        </p>
      )}

      {canAsk && t.awaitingDetails > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t.awaitingDetails} {t.awaitingDetails === 1 ? 'tutor has' : 'tutors have'} not been told
          where to send it. They are not late — they have not been asked.
        </p>
      )}

      <Table>
        <Thead>
          <Th>Tutor</Th>
          <Th>Reference</Th>
          <Th align="right">Owed</Th>
          <Th>Due</Th>
          <Th>Status</Th>
          <Th>Paid into</Th>
          <Th align="right">Do</Th>
        </Thead>
        <tbody>
          {rows.map((r, i) => {
            const tutor = r.candidates as {
              full_name: string | null
              phone: string | null
              payout_provider: string | null
              payout_account: string | null
            } | null
            const placement = r.placements as { job_posts: { subject: string } | null } | null
            const stage = prepaymentStage(countable[i], now)
            const status = prepaymentLabel(stage)
            const days = daysUntilDue(countable[i].dueOn, now)
            const open = stage === 'due' || stage === 'overdue' || stage === 'awaiting_details'

            return (
              <Tr key={r.id}>
                <Td>
                  {tutor?.full_name ?? '—'}
                  {placement?.job_posts?.subject && (
                    <span className="ml-2 text-xs text-neutral-400">
                      {placement.job_posts.subject}
                    </span>
                  )}
                </Td>
                <Td className="font-mono text-xs text-neutral-500">{r.reference}</Td>
                <Td align="right" className="font-medium">{formatEtb(Number(r.amount_cents))}</Td>
                <Td className={`text-xs ${stage === 'overdue' ? 'text-red-700' : 'text-neutral-500'}`}>
                  {r.due_on}
                  {open && (
                    <span className="block text-neutral-400">
                      {days < 0
                        ? `${Math.abs(days)}d late`
                        : days === 0
                          ? 'today'
                          : `in ${days}d`}
                    </span>
                  )}
                </Td>
                <Td>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </Td>
                {/* Their payout destination, here rather than only on Payouts:
                    a tutor being chased for money is the same tutor who will be
                    owed some, and a blank here is the thing that blocks it. */}
                <Td className="text-xs">
                  {tutor?.payout_account ? (
                    <span className="text-neutral-500">
                      {providerLabel(tutor.payout_provider as PayoutProvider)}{' '}
                      <span className="select-all font-mono">{tutor.payout_account}</span>
                    </span>
                  ) : (
                    <span className="text-amber-700">not given</span>
                  )}
                </Td>
                <Td align="right">
                  {!open ? (
                    <span className="text-xs text-neutral-400">—</span>
                  ) : (
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {canAsk && (
                        <form action={askPrepayment}>
                          <input type="hidden" name="prepaymentId" value={r.id} />
                          <input type="hidden" name="chase" value={stage === 'overdue' ? '1' : '0'} />
                          <Button variant="secondary" size="sm" pendingLabel="Sending…">
                            {stage === 'awaiting_details'
                              ? 'Ask for it'
                              : stage === 'overdue'
                                ? 'Chase'
                                : 'Send again'}
                          </Button>
                        </form>
                      )}
                      <form action={markPrepaymentSettled}>
                        <input type="hidden" name="prepaymentId" value={r.id} />
                        <Button variant="secondary" size="sm" pendingLabel="Saving…">
                          Mark paid
                        </Button>
                      </form>
                      <form action={waiveCharge}>
                        <input type="hidden" name="prepaymentId" value={r.id} />
                        <Button variant="secondary" size="sm" pendingLabel="Saving…">
                          Waive
                        </Button>
                      </form>
                    </div>
                  )}
                </Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>

      {/* Waived money is in neither column: it is not owed and was not received. */}
      <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-neutral-100 pt-3 text-sm">
        <div className="flex gap-2">
          <dt className="text-neutral-500">Outstanding</dt>
          <dd className="font-medium tabular-nums">{formatEtb(t.outstandingCents)} ETB</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-neutral-500">Collected</dt>
          <dd className="font-medium tabular-nums text-green-800">{formatEtb(t.collectedCents)} ETB</dd>
        </div>
        <div className="ml-auto text-xs text-neutral-400">
          {t.paid} paid · {t.due} asked · {t.overdue} late · {t.awaitingDetails} not asked
          {t.waived > 0 && ` · ${t.waived} waived`}
        </div>
      </dl>
    </div>
  )
}
