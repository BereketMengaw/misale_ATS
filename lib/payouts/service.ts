import { GrammyError } from 'grammy'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getBot } from '@/lib/bot/bot'
import { logMessage } from '@/lib/bot/log'
import { payoutFor } from '@/lib/money/payout'
import { formatEtb } from '@/lib/money/commission'
import { introductionAm } from '@/lib/messaging/parent'

async function tell(chatId: number | null, text: string): Promise<boolean> {
  if (!chatId) return false
  try {
    const bot = await getBot()
    await bot.api.sendMessage(chatId, text)
    await logMessage({ direction: 'out', chatId, kind: 'payout', payload: { text } })
    return true
  } catch (err) {
    console.error('payout message failed', err instanceof GrammyError ? err.description : err)
    return false
  }
}

/**
 * A paid invoice produces a payout. Called wherever an invoice becomes paid —
 * an auto-matched SMS, or the operator marking it by hand.
 *
 * Idempotent: invoice_id is unique on payouts, so a second call adds nothing.
 */
export async function createPayoutForInvoice(invoiceId: number): Promise<number | null> {
  const db = supabaseAdmin()

  const { data: inv } = await db
    .from('invoices')
    .select('id, placement_id, gross_cents, commission_cents, net_cents, status, placements(candidate_id)')
    .eq('id', invoiceId)
    .maybeSingle()

  if (!inv || inv.status !== 'paid') return null

  const candidateId = (inv.placements as unknown as { candidate_id: number } | null)?.candidate_id
  if (!candidateId) return null

  // Throws rather than paying a figure that does not add up.
  const payout = payoutFor({
    invoiceId: inv.id,
    grossCents: Number(inv.gross_cents),
    commissionCents: Number(inv.commission_cents),
    netCents: Number(inv.net_cents),
  })

  const { data, error } = await db
    .from('payouts')
    .upsert(
      {
        invoice_id: payout.invoiceId,
        placement_id: inv.placement_id,
        candidate_id: candidateId,
        gross_cents: payout.grossCents,
        commission_cents: payout.commissionCents,
        net_cents: payout.netCents,
      },
      { onConflict: 'invoice_id', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('createPayoutForInvoice failed', error)
    return null
  }

  await releaseContactsIfDue(inv.placement_id)
  return data?.id ?? null
}

/**
 * `contact_release: after_first_payment` — the default, and the whole point of
 * it. The month of highest exposure has now been paid, so both sides get the
 * other's number.
 */
export async function releaseContactsIfDue(placementId: number): Promise<boolean> {
  const db = supabaseAdmin()

  const { data: setting } = await db
    .from('settings').select('value').eq('key', 'contact_release').maybeSingle()
  const rule = (setting?.value as { rule?: string } | null)?.rule ?? 'after_first_payment'
  if (rule !== 'after_first_payment') return false

  const { data: p } = await db
    .from('placements')
    .select('id, contacts_released_at, first_paid_at, candidates(chat_id, full_name, phone), clients(id, full_name, phone), job_posts(subject, grade, area, days_per_week)')
    .eq('id', placementId)
    .maybeSingle()
  if (!p || p.contacts_released_at) return false

  const tutor = p.candidates as unknown as { chat_id: number | null; full_name: string | null; phone: string | null } | null
  const client = p.clients as unknown as { id: number; full_name: string; phone: string | null } | null
  const job = p.job_posts as unknown as { subject: string; grade: string; area: string; days_per_week: number } | null

  const now = new Date().toISOString()
  await db.from('placements').update({ first_paid_at: p.first_paid_at ?? now, contacts_released_at: now }).eq('id', placementId)

  // The tutor gets the parent's number over Telegram, where length is free.
  if (client?.phone) {
    await tell(
      tutor?.chat_id ?? null,
      [
        'The first month has been paid, so here are the family\'s details.',
        '',
        `${client.full_name} — ${client.phone}`,
        '',
        'You can arrange lessons with them directly from now on.',
      ].join('\n'),
    )
  }

  // The parent gets the tutor's number by SMS, in Amharic, for the operator to send.
  if (job && tutor && client) {
    const { notifyClient } = await import('@/lib/messaging/notify')
    await notifyClient(
      client.id,
      introductionAm(
        tutor.full_name ?? 'አስተማሪዎ',
        tutor.phone,
        { subject: job.subject, grade: job.grade, area: job.area, daysPerWeek: job.days_per_week },
        true,
      ),
      'introduction',
    )
  }

  return true
}

/** The operator has actually sent the money. */
export async function markPayoutPaid(payoutId: number, txnRef: string | null): Promise<void> {
  const db = supabaseAdmin()

  const { data: payout } = await db
    .from('payouts')
    .select('id, net_cents, status, candidates(chat_id)')
    .eq('id', payoutId)
    .maybeSingle()
  if (!payout || payout.status === 'paid') return

  await db
    .from('payouts')
    .update({ status: 'paid', paid_at: new Date().toISOString(), txn_ref: txnRef })
    .eq('id', payoutId)

  const chatId = (payout.candidates as unknown as { chat_id: number | null } | null)?.chat_id ?? null
  await tell(
    chatId,
    [
      `${formatEtb(Number(payout.net_cents))} ETB has been sent to you.`,
      txnRef ? `Reference: ${txnRef}` : '',
      '',
      'Nothing to reply to.',
    ].filter(Boolean).join('\n'),
  )
}
