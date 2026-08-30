import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * The agency's own account — where BOTH sides send money.
 *
 * docs/07-setup-checklist.md has carried an unchecked box since before step 10
 * ("Payment details the parent needs: account number and name to pay into")
 * that was never wired to anything, so `invoiceAm` has been sending families a
 * bill with an amount, a reference and no payee. The pre-payment could not be
 * asked for at all. One setting, read by the parent's SMS and the tutor's
 * Telegram message alike, so a changed account changes in one place.
 */

export type PaymentDetails = {
  accountName: string
  cbeAccount: string
  telebirr: string
}

export const EMPTY_DETAILS: PaymentDetails = { accountName: '', cbeAccount: '', telebirr: '' }

export async function paymentDetails(): Promise<PaymentDetails> {
  const { data } = await supabaseAdmin()
    .from('settings').select('value').eq('key', 'payment_details').maybeSingle()

  const v = (data?.value ?? {}) as Record<string, unknown>
  return {
    accountName: String(v.account_name ?? '').trim(),
    cbeAccount: String(v.cbe_account ?? '').trim(),
    telebirr: String(v.telebirr ?? '').trim(),
  }
}

export async function savePaymentDetails(d: PaymentDetails): Promise<void> {
  await supabaseAdmin()
    .from('settings')
    .upsert(
      {
        key: 'payment_details',
        value: { account_name: d.accountName, cbe_account: d.cbeAccount, telebirr: d.telebirr },
      },
      { onConflict: 'key' },
    )
}

/** Nothing may ask for money without saying where it goes. */
export function hasSomewhereToPay(d: PaymentDetails): boolean {
  return Boolean(d.accountName && (d.cbeAccount || d.telebirr))
}

/**
 * The lines a payer needs, in English, for the bot. Only the accounts actually
 * filled in appear — a half-configured agency should show one real account
 * rather than a label with nothing after it.
 */
export function payIntoLines(d: PaymentDetails): string[] {
  const lines: string[] = []
  if (d.cbeAccount) lines.push(`CBE ${d.cbeAccount}`)
  if (d.telebirr) lines.push(`Telebirr ${d.telebirr}`)
  if (d.accountName) lines.push(`Name: ${d.accountName}`)
  return lines
}

/**
 * ONE account, for an Amharic SMS.
 *
 * `payIntoLines` can list every account because Telegram is free. An SMS is
 * not: Amharic bills 70 characters a segment, the invoice already runs to two,
 * and a second account line would push it to three — a 50% increase on every
 * bill the agency ever sends, to offer a choice nobody asked for. CBE first
 * because it is the account most families are told to use.
 */
export function payIntoSms(d: PaymentDetails): string | null {
  if (d.cbeAccount) return `CBE ${d.cbeAccount}`
  if (d.telebirr) return `Telebirr ${d.telebirr}`
  return null
}
