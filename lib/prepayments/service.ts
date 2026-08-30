import { GrammyError } from 'grammy'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getBot } from '@/lib/bot/bot'
import { logMessage } from '@/lib/bot/log'
import { buildMonthlyInvoice, type BillablePlacement } from '@/lib/money/invoice'
import { prepaymentTerms, PREPAYMENT_WINDOW_DAYS } from '@/lib/money/prepayment'
import { generateReference } from '@/lib/money/reference'
import { formatEtb } from '@/lib/money/commission'
import { formatDateEn } from '@/lib/messaging/dates'
import { paymentDetails, hasSomewhereToPay } from '@/lib/settings/payment-details'
import {
  prepaymentDue, prepaymentOverdue, prepaymentReceived, prepaymentWaived,
} from './messages'
import type { Schedule } from '@/lib/placements/schedule'

async function tell(chatId: number | null, text: string): Promise<boolean> {
  if (!chatId) return false
  try {
    const bot = await getBot()
    await bot.api.sendMessage(chatId, text)
    await logMessage({ direction: 'out', chatId, kind: 'prepayment', payload: { text } })
    return true
  } catch (err) {
    // A tutor who blocked the bot must not break a hire or a payment.
    console.error('prepayment message failed', err instanceof GrammyError ? err.description : err)
    return false
  }
}

async function freshReference(): Promise<string | null> {
  const db = supabaseAdmin()
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateReference('prepayment')
    const { data } = await db.from('prepayments').select('id').eq('reference', code).maybeSingle()
    if (!data) return code
  }
  return null
}

export type CreateResult =
  | { ok: true; prepaymentId: number; created: boolean }
  | { ok: false; reason: string }

/**
 * The charge, raised at hire.
 *
 * Idempotent — placement_id is unique — because this is called from the hire
 * path AND from the dashboard, and a hire that half-succeeded must be safe to
 * repeat. The amount is one billing period's fee, computed through the same
 * tested code that bills the family, so the two can never drift apart.
 */
export async function createPrepaymentForPlacement(placementId: number): Promise<CreateResult> {
  const db = supabaseAdmin()

  const { data: p } = await db
    .from('placements')
    .select('id, candidate_id, rate_amount, rate_period, commission_percent, schedule, starts_on, created_at')
    .eq('id', placementId)
    .maybeSingle()
  if (!p) return { ok: false, reason: 'no such placement' }

  const { data: existing } = await db
    .from('prepayments').select('id').eq('placement_id', placementId).maybeSingle()
  if (existing) return { ok: true, prepaymentId: existing.id, created: false }

  // The obligation starts when they meet the family. A placement with no agreed
  // start date has not been met yet, so the clock runs from the hire instead —
  // never from today, which would move every time this was re-run.
  const metFamilyOn = p.starts_on
    ? new Date(`${p.starts_on}T00:00:00Z`)
    : new Date(p.created_at)

  const billable: BillablePlacement = {
    rateAmountEtb: Number(p.rate_amount),
    ratePeriod: p.rate_period,
    commissionPercent: Number(p.commission_percent),
    schedule: p.schedule as Schedule | null,
  }

  // One billing period, priced exactly as the family will be billed for it.
  const period = buildMonthlyInvoice(
    billable,
    metFamilyOn.getUTCFullYear(),
    metFamilyOn.getUTCMonth() + 1,
  )

  const terms = prepaymentTerms(
    period.split.grossCents,
    billable.commissionPercent,
    metFamilyOn,
    PREPAYMENT_WINDOW_DAYS,
  )

  // An hourly placement with no schedule yet prices at nothing. Raising a
  // zero-birr debt would be worse than raising none: it would show as settled.
  if (terms.amountCents <= 0) {
    return { ok: false, reason: 'nothing to charge yet — set the schedule first' }
  }

  const reference = await freshReference()
  if (!reference) return { ok: false, reason: 'could not allocate a reference' }

  const { data, error } = await db
    .from('prepayments')
    .insert({
      candidate_id: p.candidate_id,
      placement_id: p.id,
      amount_cents: terms.amountCents,
      commission_percent: billable.commissionPercent,
      reference,
      due_on: terms.dueOn.toISOString().slice(0, 10),
    })
    .select('id')
    .single()

  if (error) {
    // 23505 is the placement unique — someone else raised it first, not a fault.
    if (error.code === '23505') {
      const { data: raced } = await db
        .from('prepayments').select('id').eq('placement_id', placementId).maybeSingle()
      if (raced) return { ok: true, prepaymentId: raced.id, created: false }
    }
    return { ok: false, reason: error.message }
  }

  return { ok: true, prepaymentId: data.id, created: true }
}

export type NotifyResult = { ok: boolean; reason?: string }

/**
 * Tell the tutor the figure, the account and the code.
 *
 * Refuses to send if the agency has not configured an account. A message that
 * asks for money and does not say where to send it is what forced the old
 * "call us for detail", and that is the line the whole design exists to remove.
 */
export async function notifyPrepayment(prepaymentId: number, chase = false): Promise<NotifyResult> {
  const db = supabaseAdmin()

  const { data: pre } = await db
    .from('prepayments')
    .select('id, amount_cents, reference, due_on, status, candidates(chat_id)')
    .eq('id', prepaymentId)
    .maybeSingle()
  if (!pre) return { ok: false, reason: 'no such pre-payment' }
  if (pre.status !== 'due') return { ok: false, reason: 'nothing owing' }

  const details = await paymentDetails()
  if (!hasSomewhereToPay(details)) {
    return { ok: false, reason: 'no account configured — add one in Settings first' }
  }

  const chatId = (pre.candidates as unknown as { chat_id: number | null } | null)?.chat_id ?? null
  const notice = {
    amountCents: Number(pre.amount_cents),
    reference: pre.reference,
    dueLabel: formatDateEn(new Date(`${pre.due_on}T00:00:00Z`)),
    details,
  }

  const sent = await tell(chatId, chase ? prepaymentOverdue(notice) : prepaymentDue(notice))
  if (!sent) return { ok: false, reason: 'could not reach this tutor on Telegram' }

  // Only a first successful send starts the clock the UI calls "late".
  await db
    .from('prepayments')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', prepaymentId)
    .is('notified_at', null)

  return { ok: true }
}

/** Settled — by a matched SMS, or by the operator's own eyes. */
export async function markPrepaymentPaid(
  prepaymentId: number,
  by: 'sms' | 'operator',
): Promise<boolean> {
  const db = supabaseAdmin()

  const { data: pre } = await db
    .from('prepayments')
    .select('id, amount_cents, reference, status, note, candidates(chat_id)')
    .eq('id', prepaymentId)
    .maybeSingle()
  if (!pre || pre.status !== 'due') return false

  await db
    .from('prepayments')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      note: by === 'sms' ? 'matched from a bank SMS' : 'marked by the operator',
    })
    .eq('id', prepaymentId)

  const chatId = (pre.candidates as unknown as { chat_id: number | null } | null)?.chat_id ?? null
  await tell(chatId, prepaymentReceived(Number(pre.amount_cents), pre.reference))
  return true
}

/** Not owed after all. Recorded rather than deleted, so the books still explain themselves. */
export async function waivePrepayment(prepaymentId: number, note: string | null): Promise<boolean> {
  const db = supabaseAdmin()

  const { data: pre } = await db
    .from('prepayments')
    .select('id, amount_cents, status, candidates(chat_id)')
    .eq('id', prepaymentId)
    .maybeSingle()
  if (!pre || pre.status !== 'due') return false

  await db
    .from('prepayments')
    .update({ status: 'waived', waived_at: new Date().toISOString(), note })
    .eq('id', prepaymentId)

  const chatId = (pre.candidates as unknown as { chat_id: number | null } | null)?.chat_id ?? null
  await tell(chatId, prepaymentWaived(Number(pre.amount_cents)))
  return true
}

/** The operator attaching an unmatched payment to a tutor's charge. One tap. */
export async function attachPaymentToPrepayment(
  paymentId: number,
  prepaymentId: number,
): Promise<void> {
  const db = supabaseAdmin()
  await db
    .from('payments')
    .update({
      prepayment_id: prepaymentId,
      invoice_id: null,
      matched_by: 'operator',
      matched_at: new Date().toISOString(),
    })
    .eq('id', paymentId)

  await markPrepaymentPaid(prepaymentId, 'operator')
}

/** For the dashboard's "what is this worth" line, without recomputing it in JSX. */
export function prepaymentAmountLabel(cents: number): string {
  return `${formatEtb(cents)} ETB`
}
