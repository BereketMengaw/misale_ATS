import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildMonthlyInvoice, dueDate, parsePeriod, type BillablePlacement } from '@/lib/money/invoice'
import { generateReference } from '@/lib/money/reference'
import { formatEtb } from '@/lib/money/commission'
import { invoiceAm, overdueAm } from '@/lib/messaging/parent'
import { formatDateAm } from '@/lib/messaging/dates'
import type { Schedule } from '@/lib/placements/schedule'

async function billingSettings(): Promise<{ dueInDays: number }> {
  const { data } = await supabaseAdmin()
    .from('settings').select('value').eq('key', 'billing').maybeSingle()
  const v = (data?.value ?? {}) as { due_in_days?: number }
  return { dueInDays: v.due_in_days ?? 7 }
}

/** Unique across the whole table, so a few collisions are simply retried. */
async function freshReference(): Promise<string | null> {
  const db = supabaseAdmin()
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateReference()
    const { data } = await db.from('invoices').select('id').eq('reference', code).maybeSingle()
    if (!data) return code
  }
  return null
}

export type GenerateResult = {
  created: number
  skipped: { placementId: number; reason: string }[]
  error?: string
}

/**
 * One invoice per active placement for the given month.
 *
 * Re-running is safe: (placement, period) is unique, so a second run over the
 * same month adds nothing and changes nothing. That matters because the
 * operator will click this more than once.
 */
export async function generateMonth(period: string): Promise<GenerateResult> {
  const parsed = parsePeriod(period)
  if (!parsed) return { created: 0, skipped: [], error: 'That is not a month.' }

  const db = supabaseAdmin()
  const { dueInDays } = await billingSettings()

  const { data: placements } = await db
    .from('placements')
    .select('id, client_id, rate_amount, rate_period, commission_percent, schedule, status')
    .eq('status', 'active')

  const skipped: GenerateResult['skipped'] = []
  let created = 0

  for (const p of placements ?? []) {
    if (!p.client_id) {
      skipped.push({ placementId: p.id, reason: 'no parent on the placement' })
      continue
    }

    const billable: BillablePlacement = {
      rateAmountEtb: Number(p.rate_amount),
      ratePeriod: p.rate_period,
      commissionPercent: Number(p.commission_percent),
      schedule: p.schedule as Schedule | null,
    }
    const invoice = buildMonthlyInvoice(billable, parsed.year, parsed.month)

    if (invoice.grossCents <= 0) {
      skipped.push({ placementId: p.id, reason: 'nothing to bill this month' })
      continue
    }

    const reference = await freshReference()
    if (!reference) {
      skipped.push({ placementId: p.id, reason: 'could not allocate a reference' })
      continue
    }

    const issuedOn = new Date()
    const { error } = await db.from('invoices').insert({
      client_id: p.client_id,
      placement_id: p.id,
      period,
      gross_cents: invoice.split.grossCents,
      commission_cents: invoice.split.commissionCents,
      net_cents: invoice.split.netCents,
      commission_percent: billable.commissionPercent,
      description: invoice.description,
      reference,
      issued_on: issuedOn.toISOString().slice(0, 10),
      due_on: dueDate(issuedOn, dueInDays).toISOString().slice(0, 10),
    })

    if (error) {
      // 23505 is the (placement, period) unique — already invoiced, not a fault.
      skipped.push({
        placementId: p.id,
        reason: error.code === '23505' ? 'already invoiced for this month' : error.message,
      })
      continue
    }
    created++
  }

  return { created, skipped }
}

/** Put an invoice's Amharic message in the queue for the operator to send. */
export async function queueInvoiceMessage(invoiceId: number, chase = false): Promise<boolean> {
  const db = supabaseAdmin()

  const { data: inv } = await db
    .from('invoices')
    .select('id, client_id, gross_cents, reference, due_on, status, clients(full_name, phone)')
    .eq('id', invoiceId)
    .maybeSingle()
  if (!inv) return false

  const client = inv.clients as unknown as { full_name: string; phone: string | null } | null
  const amount = formatEtb(Number(inv.gross_cents))

  const body = chase
    ? overdueAm(amount, inv.reference)
    : invoiceAm(amount, inv.reference, formatDateAm(new Date(`${inv.due_on}T00:00:00Z`)))

  const { error } = await db.from('outbox').insert({
    purpose: chase ? 'overdue' : 'invoice',
    recipient: client?.full_name ?? 'Parent',
    phone: client?.phone ?? null,
    body,
    invoice_id: inv.id,
    client_id: inv.client_id,
  })
  if (error) return false

  if (!chase && inv.status === 'draft') {
    await db
      .from('invoices')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', inv.id)
  }
  return true
}

export async function markInvoicePaid(invoiceId: number, by: 'operator' | 'sms'): Promise<void> {
  await supabaseAdmin()
    .from('invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString(), paid_by: by })
    .eq('id', invoiceId)

  // A paid invoice always produces a payout, whichever route marked it paid.
  // Imported here rather than at the top to keep the module cycle out of it.
  const { createPayoutForInvoice } = await import('@/lib/payouts/service')
  await createPayoutForInvoice(invoiceId)
}

export async function markOutboxSent(outboxId: number): Promise<void> {
  await supabaseAdmin()
    .from('outbox')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', outboxId)
}
