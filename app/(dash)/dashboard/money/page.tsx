import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { formatEtb } from '@/lib/money/commission'
import { isOverdue, periodKey } from '@/lib/money/invoice'
import { total, type Payout } from '@/lib/money/payout'
import { invoiceLabel } from '@/lib/ui/labels'
import { Badge, Card, EmptyState, PageHeader, PageShell, Stat, Table, Td, Th, Thead, Tr } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { GenerateForm } from './generate-form'
import { markPaid, queueMessage } from './actions'
import { Unmatched } from './unmatched'
import { Payouts } from './payouts'
import { Prepayments } from './prepayments'
import { hasSomewhereToPay, paymentDetails } from '@/lib/settings/payment-details'
import { prepaymentTotals, type CountablePrepayment } from '@/lib/money/prepayment'

export const dynamic = 'force-dynamic'

/**
 * Invoices and payouts. The send queue used to live here, below the stats and
 * above the invoice table — the most time-critical thing in the app, on a page
 * called Money. It is on Today now.
 */
export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'invoices' } = await searchParams
  const db = supabaseAdmin()
  const now = new Date()

  const [{ data: invoices }, { data: payoutRows }, { data: prepaymentRows }, { count: unmatched }, details] =
    await Promise.all([
      db
        .from('invoices')
        .select('*, clients(full_name, phone), placements(candidates(full_name))')
        .order('issued_on', { ascending: false })
        .limit(100),
      db
        .from('payouts')
        .select('*, candidates(full_name, phone, payout_provider, payout_account, payout_name, payout_bank), invoices(reference, period)')
        .order('status')
        .order('due_on'),
      db
        .from('prepayments')
        .select('*, candidates(full_name, phone, payout_provider, payout_account, payout_bank), placements(job_posts(subject))')
        .order('status')
        .order('due_on'),
      db
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .is('invoice_id', null)
        .is('prepayment_id', null)
        .neq('matched_by', 'operator'),
      paymentDetails(),
    ])

  const rows = invoices ?? []
  const payouts = payoutRows ?? []
  const prepayments = prepaymentRows ?? []

  const unpaid = rows.filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
  const owed = unpaid.reduce((t, i) => t + Number(i.gross_cents), 0)
  const late = unpaid.filter((i) => isOverdue(new Date(`${i.due_on}T00:00:00Z`), null, now)).length
  const yours = rows
    .filter((i) => i.status === 'paid')
    .reduce((t, i) => t + Number(i.commission_cents), 0)

  const due = payouts.filter((p) => p.status === 'due')
  const owedToTutors = total(
    due.map(
      (p): Payout => ({
        invoiceId: p.invoice_id,
        grossCents: Number(p.gross_cents),
        commissionCents: Number(p.commission_cents),
        netCents: Number(p.net_cents),
      }),
    ),
  ).netCents

  // The tutors' side of the ledger, which used to be tracked nowhere at all.
  const owedByTutors = prepaymentTotals(
    prepayments.map(
      (p): CountablePrepayment => ({
        amountCents: Number(p.amount_cents),
        status: p.status,
        dueOn: new Date(`${p.due_on}T00:00:00Z`),
        paidAt: p.paid_at ? new Date(p.paid_at) : null,
        notified: Boolean(p.notified_at),
      }),
    ),
    now,
  )

  const canAsk = hasSomewhereToPay(details)

  return (
    <PageShell>
      <PageHeader
        title="Money"
        subtitle="Invoices and payouts. Messages to send live on Today."
        action={<GenerateForm defaultPeriod={periodKey(now.getUTCFullYear(), now.getUTCMonth() + 1)} />}
      />

      {!canAsk && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">
          No payment account is set, so every invoice goes out without one — the family is told what
          they owe and not where to send it.{' '}
          <Link href="/dashboard/settings" className="font-medium underline">
            Add it under Settings
          </Link>
          .
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat
          label="Owed to you"
          value={`${formatEtb(owed)} ETB`}
          sub={`${unpaid.length} unpaid${late ? ` · ${late} late` : ''}`}
        />
        <Stat label="Your commission, paid" value={`${formatEtb(yours)} ETB`} tone="good" />
        <Stat
          label="Pre-payments owed"
          value={`${formatEtb(owedByTutors.outstandingCents)} ETB`}
          sub={
            owedByTutors.overdue
              ? `${owedByTutors.overdue} late`
              : owedByTutors.awaitingDetails
                ? `${owedByTutors.awaitingDetails} not asked`
                : `${owedByTutors.due} asked`
          }
          tone={owedByTutors.overdue ? 'warn' : undefined}
        />
        <Stat
          label="Owed to tutors"
          value={`${formatEtb(owedToTutors)} ETB`}
          sub={`${due.length} payout${due.length === 1 ? '' : 's'} due`}
          tone={due.length ? 'warn' : undefined}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 px-4 pt-2">
          <Tab href="/dashboard/money" active={tab === 'invoices'}>
            Invoices <Count>{rows.length}</Count>
          </Tab>
          <Tab href="/dashboard/money?tab=payouts" active={tab === 'payouts'}>
            Payouts <Count>{payouts.length}</Count>
          </Tab>
          <Tab href="/dashboard/money?tab=prepayments" active={tab === 'prepayments'}>
            Pre-payments <Count>{prepayments.length}</Count>
          </Tab>
          <Tab href="/dashboard/money?tab=unmatched" active={tab === 'unmatched'}>
            Unmatched payments{' '}
            {unmatched ? (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-800">
                {unmatched}
              </span>
            ) : (
              <Count>0</Count>
            )}
          </Tab>
        </div>

        <div className="p-4">
          {tab === 'payouts' && <Payouts rows={payouts} />}
          {tab === 'prepayments' && <Prepayments rows={prepayments} now={now} canAsk={canAsk} />}
          {tab === 'unmatched' && <Unmatched />}
          {tab === 'invoices' &&
            (rows.length === 0 ? (
              <EmptyState>
                No invoices yet. They are generated once a month, one per active placement.
              </EmptyState>
            ) : (
              <Table>
                <Thead>
                  <Th>Reference</Th>
                  <Th>Parent</Th>
                  <Th>Tutor</Th>
                  <Th>Month</Th>
                  <Th align="right">Amount</Th>
                  <Th>Due</Th>
                  <Th>Status</Th>
                  <Th align="right">Do</Th>
                </Thead>
                <tbody>
                  {rows.map((i) => {
                    const client = i.clients as unknown as { full_name: string } | null
                    const placement = i.placements as unknown as { candidates: { full_name: string | null } | null } | null
                    const overdue = isOverdue(
                      new Date(`${i.due_on}T00:00:00Z`),
                      i.paid_at ? new Date(i.paid_at) : null,
                      now,
                    )
                    const status = invoiceLabel(i.status, overdue)
                    return (
                      <Tr key={i.id}>
                        <Td className="font-mono text-xs">{i.reference}</Td>
                        <Td>{client?.full_name ?? '—'}</Td>
                        <Td className="text-neutral-500">{placement?.candidates?.full_name ?? '—'}</Td>
                        <Td className="text-neutral-500">{i.period}</Td>
                        <Td align="right">{formatEtb(Number(i.gross_cents))}</Td>
                        <Td className={`text-xs ${overdue ? 'text-red-700' : 'text-neutral-500'}`}>
                          {i.due_on}
                          {overdue && ' · late'}
                        </Td>
                        <Td>
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </Td>
                        <Td align="right">
                          {i.status === 'paid' || i.status === 'cancelled' ? (
                            <span className="text-xs text-neutral-400">—</span>
                          ) : (
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              <form action={queueMessage}>
                                <input type="hidden" name="invoiceId" value={i.id} />
                                <input type="hidden" name="chase" value={overdue ? '1' : '0'} />
                                <Button variant="secondary" size="sm" pendingLabel="Queueing…">
                                  {overdue ? 'Queue chase' : i.status === 'draft' ? 'Queue invoice' : 'Queue again'}
                                </Button>
                              </form>
                              <form action={markPaid}>
                                <input type="hidden" name="invoiceId" value={i.id} />
                                <Button variant="secondary" size="sm" pendingLabel="Saving…">
                                  Mark paid
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
            ))}
        </div>
      </Card>
    </PageShell>
  )
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
        active
          ? 'border-neutral-900 font-medium text-neutral-900'
          : 'border-transparent text-neutral-500 hover:text-neutral-900'
      }`}
    >
      {children}
    </Link>
  )
}

function Count({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-normal text-neutral-400">{children}</span>
}
