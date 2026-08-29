'use server'

import { revalidatePath } from 'next/cache'
import { generateMonth, markInvoicePaid, queueInvoiceMessage } from '@/lib/invoices/service'

export type GenerateState = { error?: string; ok?: string }

export async function generateInvoices(_prev: GenerateState, formData: FormData): Promise<GenerateState> {
  const period = String(formData.get('period') ?? '').trim()
  const result = await generateMonth(period)
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/money')
  revalidatePath('/dashboard')

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
  revalidatePath('/dashboard')
}

export async function markPaid(formData: FormData): Promise<void> {
  const invoiceId = Number(formData.get('invoiceId'))
  if (invoiceId) await markInvoicePaid(invoiceId, 'operator')
  revalidatePath('/dashboard/money')
  revalidatePath('/dashboard')
}

/** Attach an unmatched payment to an invoice. One tap. */
export async function attachToInvoice(formData: FormData): Promise<void> {
  const paymentId = Number(formData.get('paymentId'))
  const invoiceId = Number(formData.get('invoiceId'))
  if (!paymentId || !invoiceId) return

  const { attachPayment } = await import('@/lib/payments/service')
  await attachPayment(paymentId, invoiceId)
  revalidatePath('/dashboard/money')
  revalidatePath('/dashboard')
}

/** Not money for us — a refund, or a transfer between the operator's accounts. */
export async function dismiss(formData: FormData): Promise<void> {
  const paymentId = Number(formData.get('paymentId'))
  if (!paymentId) return

  const { dismissPayment } = await import('@/lib/payments/service')
  await dismissPayment(paymentId)
  revalidatePath('/dashboard/money')
  revalidatePath('/dashboard')
}

/** The operator has actually sent the tutor their money. */
export async function payTutor(formData: FormData): Promise<void> {
  const payoutId = Number(formData.get('payoutId'))
  const txnRef = String(formData.get('txnRef') ?? '').trim() || null
  if (!payoutId) return

  const { markPayoutPaid } = await import('@/lib/payouts/service')
  await markPayoutPaid(payoutId, txnRef)
  revalidatePath('/dashboard/money')
  revalidatePath('/dashboard')
}
