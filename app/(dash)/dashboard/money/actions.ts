'use server'

import { revalidatePath } from 'next/cache'
import { generateMonth, markInvoicePaid, markOutboxSent, queueInvoiceMessage } from '@/lib/invoices/service'

export type GenerateState = { error?: string; ok?: string }

export async function generateInvoices(_prev: GenerateState, formData: FormData): Promise<GenerateState> {
  const period = String(formData.get('period') ?? '').trim()
  const result = await generateMonth(period)
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/money')

  const skipped = result.skipped.length
  return {
    ok:
      `${result.created} invoice${result.created === 1 ? '' : 's'} created` +
      (skipped ? ` · ${skipped} skipped` : ''),
  }
}

export async function queueMessage(formData: FormData): Promise<void> {
  const invoiceId = Number(formData.get('invoiceId'))
  const chase = formData.get('chase') === '1'
  if (invoiceId) await queueInvoiceMessage(invoiceId, chase)
  revalidatePath('/dashboard/money')
}

export async function markPaid(formData: FormData): Promise<void> {
  const invoiceId = Number(formData.get('invoiceId'))
  if (invoiceId) await markInvoicePaid(invoiceId, 'operator')
  revalidatePath('/dashboard/money')
}

export async function markSent(formData: FormData): Promise<void> {
  const outboxId = Number(formData.get('outboxId'))
  if (outboxId) await markOutboxSent(outboxId)
  revalidatePath('/dashboard/money')
}
