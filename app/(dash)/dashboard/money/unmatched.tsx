import { supabaseAdmin } from '@/lib/supabase/admin'
import { formatEtb } from '@/lib/money/commission'
import { attachToInvoice, dismiss } from './actions'

/**
 * Payments that arrived but could not be attached with certainty.
 *
 * This inbox existing is why a wrong automatic match is never necessary: an
 * unmatched payment is visible and one tap from resolved, whereas a payment
 * attached to the wrong invoice is invisible until the money is short.
 */
export async function Unmatched() {
  const db = supabaseAdmin()

  const [{ data: payments }, { data: open }] = await Promise.all([
    db
      .from('payments')
      .select('*')
      .is('invoice_id', null)
      .neq('matched_by', 'operator')
      .order('received_at', { ascending: false })
      .limit(50),
    db
      .from('invoices')
      .select('id, reference, gross_cents, period, clients(full_name)')
      .neq('status', 'paid')
      .neq('status', 'cancelled')
      .order('due_on', { ascending: true }),
  ])

  const rows = payments ?? []
  if (rows.length === 0) return null

  const invoices = open ?? []

  return (
    <section className="space-y-3 rounded-md border border-red-300 bg-red-50 p-4">
      <h2 className="text-sm font-medium text-red-900">Unmatched payments ({rows.length})</h2>
      <p className="text-xs text-red-800">
        Money arrived, but not certainly enough to attach on its own. One tap fixes each.
      </p>

      <ul className="space-y-3">
        {rows.map((p) => (
          <li key={p.id} className="rounded-md border border-red-200 bg-white p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium tabular-nums">
                {p.amount_cents ? `${formatEtb(Number(p.amount_cents))} ETB` : 'amount unknown'}
                {p.payer && <span className="ml-2 font-normal text-neutral-600">from {p.payer}</span>}
              </p>
              <span className="text-xs text-neutral-500">
                {p.provider ?? 'unknown'} · {p.note ?? ''}
              </span>
            </div>

            <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{p.raw_body}</p>
            {p.receipt_url && (
              <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline">
                Open the bank receipt ↗
              </a>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {invoices.length > 0 ? (
                <form action={attachToInvoice} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="paymentId" value={p.id} />
                  <select
                    name="invoiceId"
                    className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
                    defaultValue={
                      invoices.find((i) => Number(i.gross_cents) === Number(p.amount_cents))?.id ?? invoices[0].id
                    }
                  >
                    {invoices.map((i) => {
                      const c = i.clients as unknown as { full_name: string } | null
                      return (
                        <option key={i.id} value={i.id}>
                          {i.reference} · {c?.full_name ?? '—'} · {formatEtb(Number(i.gross_cents))} · {i.period}
                        </option>
                      )
                    })}
                  </select>
                  <button className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white">
                    Attach and mark paid
                  </button>
                </form>
              ) : (
                <span className="text-xs text-neutral-500">No unpaid invoices to attach it to.</span>
              )}

              <form action={dismiss}>
                <input type="hidden" name="paymentId" value={p.id} />
                <button className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-600">
                  Not for us
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
