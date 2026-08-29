import { supabaseAdmin } from '@/lib/supabase/admin'
import { formatEtb } from '@/lib/money/commission'
import { isOverdue, periodKey } from '@/lib/money/invoice'
import { describeCost } from '@/lib/messaging/sms'
import { GenerateForm } from './generate-form'
import { markPaid, markSent, queueMessage } from './actions'
import { CopyBox } from '../jobs/[id]/copy-box'
import { Unmatched } from './unmatched'

export const dynamic = 'force-dynamic'

export default async function MoneyPage() {
  const db = supabaseAdmin()
  const now = new Date()

  const [{ data: invoices }, { data: queue }] = await Promise.all([
    db
      .from('invoices')
      .select('*, clients(full_name, phone), placements(candidates(full_name))')
      .order('issued_on', { ascending: false })
      .limit(100),
    db.from('outbox').select('*').eq('status', 'pending').order('created_at', { ascending: true }),
  ])

  const rows = invoices ?? []
  const pending = queue ?? []

  const unpaid = rows.filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
  const owed = unpaid.reduce((t, i) => t + Number(i.gross_cents), 0)
  const yours = rows
    .filter((i) => i.status === 'paid')
    .reduce((t, i) => t + Number(i.commission_cents), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Money</h1>
        <p className="text-sm text-neutral-500">Invoices, and the messages waiting for you to send.</p>
      </div>

      <div className="grid gap-1px grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Owed" value={`${formatEtb(owed)} ETB`} sub={`${unpaid.length} unpaid`} />
        <Stat label="Your commission, paid" value={`${formatEtb(yours)} ETB`} tone="text-green-800" />
        <Stat label="Waiting to send" value={String(pending.length)} tone={pending.length ? 'text-amber-700' : undefined} />
      </div>

      <Unmatched />

      {/* The send queue: written by the system, sent by you. */}
      {pending.length > 0 && (
        <section className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-medium text-amber-900">To send ({pending.length})</h2>
          <ul className="space-y-3">
            {pending.map((m) => (
              <li key={m.id} className="rounded-md border border-amber-200 bg-white p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    {m.recipient}
                    {m.phone && <span className="ml-2 font-normal text-neutral-500">{m.phone}</span>}
                  </p>
                  <span className="text-xs text-neutral-500">{m.purpose} · {describeCost(m.body)}</span>
                </div>
                <CopyBox text={m.body} />
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.phone && (
                    <a
                      href={`sms:${m.phone}?body=${encodeURIComponent(m.body)}`}
                      className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Send by SMS
                    </a>
                  )}
                  <form action={markSent}>
                    <input type="hidden" name="outboxId" value={m.id} />
                    <button className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700">
                      Mark sent
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3 rounded-md border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-medium">New month</h2>
        <GenerateForm defaultPeriod={periodKey(now.getUTCFullYear(), now.getUTCMonth() + 1)} />
        <p className="text-xs text-neutral-400">
          One invoice per active placement. Running it twice changes nothing.
        </p>
      </section>

      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium">Invoices</h2>

        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">None yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-400">
                  <th className="py-2 pr-3 font-medium">Reference</th>
                  <th className="py-2 pr-3 font-medium">Parent</th>
                  <th className="py-2 pr-3 font-medium">Month</th>
                  <th className="py-2 pr-3 text-right font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Due</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => {
                  const client = i.clients as unknown as { full_name: string } | null
                  const late = isOverdue(new Date(`${i.due_on}T00:00:00Z`), i.paid_at ? new Date(i.paid_at) : null, now)
                  return (
                    <tr key={i.id} className="border-b border-neutral-100 last:border-0">
                      <td className="py-2 pr-3 font-mono text-xs">{i.reference}</td>
                      <td className="py-2 pr-3">{client?.full_name ?? '—'}</td>
                      <td className="py-2 pr-3 text-neutral-500">{i.period}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatEtb(Number(i.gross_cents))}</td>
                      <td className={`py-2 pr-3 text-xs ${late ? 'text-red-700' : 'text-neutral-500'}`}>
                        {i.due_on}{late && ' · late'}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              i.status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : late
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            {i.status}
                          </span>
                          {i.status !== 'paid' && (
                            <>
                              <form action={queueMessage}>
                                <input type="hidden" name="invoiceId" value={i.id} />
                                <input type="hidden" name="chase" value={late ? '1' : '0'} />
                                <button className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600">
                                  {late ? 'Queue chase' : i.status === 'draft' ? 'Queue invoice' : 'Queue again'}
                                </button>
                              </form>
                              <form action={markPaid}>
                                <input type="hidden" name="invoiceId" value={i.id} />
                                <button className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600">
                                  Mark paid
                                </button>
                              </form>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone ?? ''}`}>{value}</p>
      {sub && <p className="text-xs text-neutral-400">{sub}</p>}
    </div>
  )
}
