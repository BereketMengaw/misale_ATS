import { supabaseAdmin } from '@/lib/supabase/admin'
import { formatEtb } from '@/lib/money/commission'
import { EmptyState } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/styles'
import { attachToInvoice, attachToPrepayment, dismiss } from './actions'

/**
 * Payments that arrived but could not be attached with certainty.
 *
 * This inbox existing is why a wrong automatic match is never necessary: an
 * unmatched payment is visible and one tap from resolved, whereas a payment
 * attached to the wrong invoice is invisible until the money is short.
 */
export async function Unmatched() {
  const db = supabaseAdmin()

  const [{ data: payments }, { data: open }, { data: owing }] = await Promise.all([
    db
      .from('payments')
      .select('*')
      .is('invoice_id', null)
      .is('prepayment_id', null)
      .neq('matched_by', 'operator')
      .order('received_at', { ascending: false })
      .limit(50),
    db
      .from('invoices')
      .select('id, reference, gross_cents, period, clients(full_name)')
      .neq('status', 'paid')
      .neq('status', 'cancelled')
      .order('due_on', { ascending: true }),
    // Tutors' pre-payments are a second thing a stray transfer can belong to.
    // Without them here, a tutor who paid without their code could only be
    // attached to a family's invoice — which would be the wrong money entirely.
    db
      .from('prepayments')
      .select('id, reference, amount_cents, candidates(full_name)')
      .eq('status', 'due')
      .order('due_on', { ascending: true }),
  ])

  const rows = payments ?? []
  if (rows.length === 0) {
    return <EmptyState>Nothing unmatched. Every payment that arrived found what it was for.</EmptyState>
  }

  const invoices = open ?? []
  const prepayments = owing ?? []

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        Money arrived, but not certainly enough to attach on its own. One tap fixes each.
      </p>

      <ul className="space-y-3">
        {rows.map((p) => (
          <li key={p.id} className="rounded-md border border-red-200 bg-red-50 p-3">
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
              <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline underline-offset-2">
                Open the bank receipt ↗
              </a>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {invoices.length > 0 ? (
                <form action={attachToInvoice} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="paymentId" value={p.id} />
                  <select
                    name="invoiceId"
                    aria-label="Invoice to attach this payment to"
                    className={`${inputClass} w-auto py-1 text-xs`}
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
                  <Button variant="primary" size="sm" pendingLabel="Attaching…">
                    Attach and mark paid
                  </Button>
                </form>
              ) : (
                <span className="text-xs text-neutral-500">No unpaid invoices to attach it to.</span>
              )}

              {prepayments.length > 0 && (
                <form action={attachToPrepayment} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="paymentId" value={p.id} />
                  <select
                    name="prepaymentId"
                    aria-label="Tutor pre-payment to attach this payment to"
                    className={`${inputClass} w-auto py-1 text-xs`}
                    defaultValue={
                      prepayments.find((r) => Number(r.amount_cents) === Number(p.amount_cents))?.id ??
                      prepayments[0].id
                    }
                  >
                    {prepayments.map((r) => {
                      const t = r.candidates as unknown as { full_name: string | null } | null
                      return (
                        <option key={r.id} value={r.id}>
                          {r.reference} · {t?.full_name ?? '—'} · {formatEtb(Number(r.amount_cents))}
                        </option>
                      )
                    })}
                  </select>
                  <Button variant="secondary" size="sm" pendingLabel="Attaching…">
                    It is a tutor&rsquo;s pre-payment
                  </Button>
                </form>
              )}

              <form action={dismiss}>
                <input type="hidden" name="paymentId" value={p.id} />
                <Button variant="secondary" size="sm" pendingLabel="Saving…">
                  Not for us
                </Button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
