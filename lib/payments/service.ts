import { supabaseAdmin } from '@/lib/supabase/admin'
import { looksLikePayment, parsePaymentSms } from './parse'
import { matchPayment, type Candidate } from './match'
import { markInvoicePaid } from '@/lib/invoices/service'
import { paymentReceivedAm } from '@/lib/messaging/parent'
import { formatEtb } from '@/lib/money/commission'

export type IngestResult =
  | { outcome: 'ignored'; why: string }
  | { outcome: 'duplicate' }
  | { outcome: 'matched'; paymentId: number; invoiceId: number }
  | { outcome: 'unmatched'; paymentId: number; suggestion: number | null }

/**
 * One forwarded SMS.
 *
 * Anything that does not parse as money arriving is dropped WITHOUT its text
 * being stored — a personal message that slipped past the phone's sender
 * allowlist never enters the database (docs/04-messaging.md, defence in depth).
 */
export async function ingestSms(body: string, sender: string | null): Promise<IngestResult> {
  if (!looksLikePayment(body, sender)) {
    return { outcome: 'ignored', why: 'not a payment' }
  }

  const db = supabaseAdmin()
  const parsed = parsePaymentSms(body, sender)

  const { data: invoices } = await db
    .from('invoices')
    .select('id, reference, gross_cents, status, clients(full_name)')
    .neq('status', 'cancelled')

  const candidates: Candidate[] = (invoices ?? []).map((i) => ({
    invoiceId: i.id,
    reference: i.reference,
    grossCents: Number(i.gross_cents),
    clientName: (i.clients as unknown as { full_name: string } | null)?.full_name ?? null,
    paid: i.status === 'paid',
  }))

  const match = matchPayment(parsed, candidates)

  const { data: payment, error } = await db
    .from('payments')
    .insert({
      raw_body: body,
      sender,
      provider: parsed.provider,
      amount_cents: parsed.amountCents,
      payer: parsed.payer,
      txn_ref: parsed.txnRef,
      reference: parsed.reference,
      receipt_url: parsed.receiptUrl,
      parsed,
      invoice_id: match.autoApply ? match.invoiceId : null,
      matched_by: match.autoApply ? 'auto' : 'unmatched',
      matched_at: match.autoApply ? new Date().toISOString() : null,
      note: match.reason,
    })
    .select('id')
    .single()

  if (error) {
    // The gateway resends on catch-up; the same transaction is not new money.
    if (error.code === '23505') return { outcome: 'duplicate' }
    console.error('ingestSms insert failed', error)
    return { outcome: 'ignored', why: error.message }
  }

  if (match.autoApply && match.invoiceId) {
    await markInvoicePaid(match.invoiceId, 'sms')
    await queueReceipt(match.invoiceId)
    return { outcome: 'matched', paymentId: payment.id, invoiceId: match.invoiceId }
  }

  return { outcome: 'unmatched', paymentId: payment.id, suggestion: match.invoiceId }
}

/** Tell the parent the money arrived, so nobody has to ask. */
async function queueReceipt(invoiceId: number): Promise<void> {
  const db = supabaseAdmin()
  const { data: inv } = await db
    .from('invoices')
    .select('id, client_id, gross_cents, reference, clients(full_name, phone)')
    .eq('id', invoiceId)
    .maybeSingle()
  if (!inv) return

  const { notifyClient } = await import('@/lib/messaging/notify')
  await notifyClient(
    inv.client_id,
    paymentReceivedAm(formatEtb(Number(inv.gross_cents)), inv.reference),
    'receipt',
    inv.id,
  )
}

/** The operator attaching an unmatched payment by hand. One tap. */
export async function attachPayment(paymentId: number, invoiceId: number): Promise<void> {
  const db = supabaseAdmin()
  await db
    .from('payments')
    .update({ invoice_id: invoiceId, matched_by: 'operator', matched_at: new Date().toISOString() })
    .eq('id', paymentId)

  await markInvoicePaid(invoiceId, 'operator')
  await queueReceipt(invoiceId)
}

/** Not a payment for us after all — a refund, a transfer between own accounts. */
export async function dismissPayment(paymentId: number): Promise<void> {
  await supabaseAdmin()
    .from('payments')
    .update({ note: 'dismissed by operator', matched_by: 'operator', matched_at: new Date().toISOString() })
    .eq('id', paymentId)
}
