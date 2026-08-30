import { supabaseAdmin } from '@/lib/supabase/admin'
import { looksLikePayment, parsePaymentSms } from './parse'
import { matchPayment, type Candidate } from './match'
import { matchPrepayment, type PrepaymentCandidate } from './match-prepayment'
import { markInvoicePaid } from '@/lib/invoices/service'
import { paymentReceivedAm } from '@/lib/messaging/parent'
import { formatEtb } from '@/lib/money/commission'
import { ledgerOf } from '@/lib/money/reference'

export type IngestResult =
  | { outcome: 'ignored'; why: string }
  | { outcome: 'duplicate' }
  | { outcome: 'matched'; paymentId: number; invoiceId: number }
  | { outcome: 'matched-prepayment'; paymentId: number; prepaymentId: number }
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

  const parsed = parsePaymentSms(body, sender)

  // Two ledgers arrive down the same wire: families paying invoices, tutors
  // paying their one-off charge. The reference prefix decides which, before any
  // matching happens, so a tutor's transfer is never even considered against a
  // family's invoice — see lib/money/reference.ts.
  return ledgerOf(parsed.reference ?? '') === 'prepayment'
    ? ingestTutorPayment(body, sender, parsed)
    : ingestParentPayment(body, sender, parsed)
}

type Parsed = ReturnType<typeof parsePaymentSms>

/** The row every ingest writes, whichever ledger it settled. */
async function record(
  body: string,
  sender: string | null,
  parsed: Parsed,
  attach: { invoiceId?: number | null; prepaymentId?: number | null; auto: boolean; note: string },
): Promise<{ id: number } | 'duplicate' | null> {
  const { data, error } = await supabaseAdmin()
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
      invoice_id: attach.auto ? attach.invoiceId ?? null : null,
      prepayment_id: attach.auto ? attach.prepaymentId ?? null : null,
      matched_by: attach.auto ? 'auto' : 'unmatched',
      matched_at: attach.auto ? new Date().toISOString() : null,
      note: attach.note,
    })
    .select('id')
    .single()

  if (error) {
    // The gateway resends on catch-up; the same transaction is not new money.
    if (error.code === '23505') return 'duplicate'
    console.error('ingestSms insert failed', error)
    return null
  }
  return data
}

async function ingestParentPayment(
  body: string,
  sender: string | null,
  parsed: Parsed,
): Promise<IngestResult> {
  const { data: invoices } = await supabaseAdmin()
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
  const payment = await record(body, sender, parsed, {
    invoiceId: match.invoiceId,
    auto: match.autoApply,
    note: match.reason,
  })

  if (payment === 'duplicate') return { outcome: 'duplicate' }
  if (!payment) return { outcome: 'ignored', why: 'could not be stored' }

  if (match.autoApply && match.invoiceId) {
    await markInvoicePaid(match.invoiceId, 'sms')
    await queueReceipt(match.invoiceId)
    return { outcome: 'matched', paymentId: payment.id, invoiceId: match.invoiceId }
  }

  return { outcome: 'unmatched', paymentId: payment.id, suggestion: match.invoiceId }
}

/**
 * A tutor paying their pre-payment. The confirmation goes back over Telegram in
 * English rather than out as an Amharic SMS — a tutor is not a parent.
 */
async function ingestTutorPayment(
  body: string,
  sender: string | null,
  parsed: Parsed,
): Promise<IngestResult> {
  const { data: rows } = await supabaseAdmin()
    .from('prepayments')
    .select('id, reference, amount_cents, status, candidates(full_name)')

  const candidates: PrepaymentCandidate[] = (rows ?? []).map((p) => ({
    prepaymentId: p.id,
    reference: p.reference,
    amountCents: Number(p.amount_cents),
    tutorName: (p.candidates as unknown as { full_name: string | null } | null)?.full_name ?? null,
    settled: p.status !== 'due',
  }))

  const match = matchPrepayment(parsed, candidates)
  const payment = await record(body, sender, parsed, {
    prepaymentId: match.prepaymentId,
    auto: match.autoApply,
    note: `tutor pre-payment — ${match.reason}`,
  })

  if (payment === 'duplicate') return { outcome: 'duplicate' }
  if (!payment) return { outcome: 'ignored', why: 'could not be stored' }

  if (match.autoApply && match.prepaymentId) {
    const { markPrepaymentPaid } = await import('@/lib/prepayments/service')
    await markPrepaymentPaid(match.prepaymentId, 'sms')
    return { outcome: 'matched-prepayment', paymentId: payment.id, prepaymentId: match.prepaymentId }
  }

  return { outcome: 'unmatched', paymentId: payment.id, suggestion: null }
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
