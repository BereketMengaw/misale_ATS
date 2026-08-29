import { supabaseAdmin } from '@/lib/supabase/admin'
import { formatEtb } from '@/lib/money/commission'
import { reconciles, total, type Payout } from '@/lib/money/payout'
import { payTutor } from './actions'

/**
 * Payouts due, and the books.
 *
 * A payout exists only once its invoice is PAID, so nothing here is money the
 * agency has not already received.
 */
export async function Payouts() {
  const { data } = await supabaseAdmin()
    .from('payouts')
    .select('*, candidates(full_name, phone), invoices(reference, period)')
    .order('status', { ascending: true })
    .order('due_on', { ascending: true })
    .limit(100)

  const rows = data ?? []
  const asPayouts = (r: typeof rows): Payout[] =>
    r.map((p) => ({
      invoiceId: p.invoice_id,
      grossCents: Number(p.gross_cents),
      commissionCents: Number(p.commission_cents),
      netCents: Number(p.net_cents),
    }))

  const due = rows.filter((p) => p.status === 'due')
  const books = total(asPayouts(rows))
  const owedToTutors = total(asPayouts(due)).netCents

  return (
    <section className="space-y-3 rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Payouts</h2>
        {due.length > 0 && (
          <span className="text-xs text-amber-700">
            {formatEtb(owedToTutors)} ETB owed to {due.length} tutor{due.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">
          None yet. A payout appears the moment an invoice is paid.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-400">
                  <th className="py-2 pr-3 font-medium">Tutor</th>
                  <th className="py-2 pr-3 font-medium">Invoice</th>
                  <th className="py-2 pr-3 text-right font-medium">Collected</th>
                  <th className="py-2 pr-3 text-right font-medium">Your cut</th>
                  <th className="py-2 pr-3 text-right font-medium">To pay</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const tutor = p.candidates as unknown as { full_name: string | null; phone: string | null } | null
                  const inv = p.invoices as unknown as { reference: string; period: string } | null
                  return (
                    <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                      <td className="py-2 pr-3">
                        {tutor?.full_name ?? '—'}
                        {tutor?.phone && <span className="ml-2 text-xs text-neutral-400">{tutor.phone}</span>}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-neutral-500">
                        {inv?.reference} · {inv?.period}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-neutral-500">
                        {formatEtb(Number(p.gross_cents))}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-green-800">
                        {formatEtb(Number(p.commission_cents))}
                      </td>
                      <td className="py-2 pr-3 text-right font-medium tabular-nums">
                        {formatEtb(Number(p.net_cents))}
                      </td>
                      <td className="py-2">
                        {p.status === 'paid' ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                            paid{p.txn_ref && ` · ${p.txn_ref}`}
                          </span>
                        ) : (
                          <form action={payTutor} className="flex items-center gap-1">
                            <input type="hidden" name="payoutId" value={p.id} />
                            <input
                              name="txnRef"
                              placeholder="txn ref"
                              className="w-24 rounded border border-neutral-300 px-1.5 py-0.5 text-xs"
                            />
                            <button className="rounded bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white">
                              Mark paid
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

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
        </>
      )}
    </section>
  )
}
