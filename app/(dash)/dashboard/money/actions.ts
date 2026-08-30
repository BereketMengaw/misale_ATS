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

// ---------------------------------------------------------------------------
// The tutor's pre-payment
// ---------------------------------------------------------------------------

/**
 * Send the tutor the figure, the account and their code — or chase it.
 *
 * Silently does nothing when no account is configured. The page checks the same
 * condition and hides the button behind a warning, so this is the backstop
 * rather than the message: a request for money that cannot say where it goes
 * must not leave the building.
 */
export async function askPrepayment(formData: FormData): Promise<void> {
  const prepaymentId = Number(formData.get('prepaymentId'))
  const chase = formData.get('chase') === '1'
  if (!prepaymentId) return

  const { notifyPrepayment } = await import('@/lib/prepayments/service')
  await notifyPrepayment(prepaymentId, chase)
  revalidatePath('/dashboard/money')
  revalidatePath('/dashboard')
}

export async function markPrepaymentSettled(formData: FormData): Promise<void> {
  const prepaymentId = Number(formData.get('prepaymentId'))
  if (!prepaymentId) return

  const { markPrepaymentPaid } = await import('@/lib/prepayments/service')
  await markPrepaymentPaid(prepaymentId, 'operator')
  revalidatePath('/dashboard/money')
  revalidatePath('/dashboard')
}

/** Not owed after all. Recorded, not deleted — the books still explain themselves. */
export async function waiveCharge(formData: FormData): Promise<void> {
  const prepaymentId = Number(formData.get('prepaymentId'))
  if (!prepaymentId) return

  const { waivePrepayment } = await import('@/lib/prepayments/service')
  await waivePrepayment(prepaymentId, 'waived by the operator')
  revalidatePath('/dashboard/money')
  revalidatePath('/dashboard')
}

/** Attach an unmatched payment to a tutor's pre-payment instead of an invoice. */
export async function attachToPrepayment(formData: FormData): Promise<void> {
  const paymentId = Number(formData.get('paymentId'))
  const prepaymentId = Number(formData.get('prepaymentId'))
  if (!paymentId || !prepaymentId) return

  const { attachPaymentToPrepayment } = await import('@/lib/prepayments/service')
  await attachPaymentToPrepayment(paymentId, prepaymentId)
  revalidatePath('/dashboard/money')
  revalidatePath('/dashboard')
}

export type RaiseState = { error?: string; ok?: string }

/**
 * Raise the pre-payment on any placement that has not got one.
 *
 * Needed because the charge is raised at the hire, so every placement made
 * before that existed has none — and a hire whose pre-payment step failed
 * would otherwise never be noticed. Safe to press twice.
 */
export async function raisePrepayments(_prev: RaiseState, _formData: FormData): Promise<RaiseState> {
  const { raiseMissingPrepayments } = await import('@/lib/prepayments/service')
  const result = await raiseMissingPrepayments()

  revalidatePath('/dashboard/money')
  revalidatePath('/dashboard')

  if (result.created === 0 && result.skipped.length === 0) {
    return { ok: 'Every placement already has one.' }
  }

  // Named, not counted: "1 skipped" tells him nothing he can act on.
  const problems = result.skipped.map((s) => `${s.tutor} — ${s.reason}`).join('; ')
  return {
    ok:
      `${result.created} raised` +
      (problems ? ` · not raised for ${problems}` : ''),
  }
}
