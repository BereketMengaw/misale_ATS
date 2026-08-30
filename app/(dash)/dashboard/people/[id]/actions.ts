'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkAccount, checkBankName, PAYOUT_PROVIDERS } from '@/lib/candidates/payout-details'

export type DestinationState = { error?: string; ok?: string }

/**
 * The operator entering a tutor's account by hand.
 *
 * The bot asks at the hire and that is the normal route, but it can fail in
 * ordinary ways — the tutor blocked the bot, never finished the three steps, or
 * gave the number over the phone before any of this existed. Without this form
 * the only fix would be asking them again and hoping, and a payout with no
 * destination is money that cannot move.
 */
export async function saveDestination(
  _prev: DestinationState,
  formData: FormData,
): Promise<DestinationState> {
  const candidateId = Number(formData.get('candidateId'))
  const provider = String(formData.get('provider') ?? '')
  const name = String(formData.get('payoutName') ?? '').trim()
  if (!candidateId) return { error: 'No tutor.' }

  if (!PAYOUT_PROVIDERS.some((p) => p.value === provider)) {
    return { error: 'Pick where they are paid.' }
  }

  const checked = checkAccount(String(formData.get('account') ?? ''))
  if (!checked.ok) {
    return {
      error:
        checked.reason === 'not-digits'
          ? 'The account number has letters in it. Digits only.'
          : checked.reason === 'empty'
            ? 'Give the account number.'
            : `That account number is too ${checked.reason === 'too-short' ? 'short' : 'long'}.`,
    }
  }

  // The name on the account is not always the name on the profile, and a
  // transfer to the wrong name bounces. It is not optional.
  if (name.length < 3) return { error: 'Give the name as the bank has it.' }

  // "Another bank" with no bank named is an account number with nowhere to go.
  let bank: string | null = null
  if (provider === 'other') {
    const checkedBank = checkBankName(String(formData.get('bank') ?? ''))
    if (!checkedBank.ok) return { error: 'Name the bank — "Another bank" on its own is not somewhere to send money.' }
    bank = checkedBank.bank
  }

  await supabaseAdmin()
    .from('candidates')
    .update({
      payout_provider: provider,
      payout_account: checked.account,
      payout_name: name,
      payout_bank: bank,
      payout_set_at: new Date().toISOString(),
    })
    .eq('id', candidateId)

  revalidatePath(`/dashboard/people/${candidateId}`)
  revalidatePath('/dashboard/money')
  return { ok: 'Saved. Payouts to this tutor can go out now.' }
}
