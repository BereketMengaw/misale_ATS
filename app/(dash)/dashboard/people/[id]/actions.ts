'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkAccount, checkBankName, PAYOUT_PROVIDERS } from '@/lib/candidates/payout-details'
import {
  readCandidateCv, readFailureMessage, verifyCandidateDocuments, verifyFailureMessage,
} from '@/lib/candidates/reading'
import type { ActionState } from '@/components/ui/action-form'

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

/**
 * Read the CV attached to this profile — build plan step 5.
 *
 * Deliberately a button rather than something that happens on upload. Parsing
 * is the only model call in the app that a tutor's own action could otherwise
 * set off, and the cost rule in CLAUDE.md keeps that list at one: the tutor
 * uploads, and nothing is spent until the operator, looking at the profile,
 * decides this CV is worth reading.
 *
 * What it writes is narrow on purpose. Fields the tutor left empty are filled;
 * anything that disagrees with an answer they gave is reported and the profile
 * left alone. There is no "accept the CV's version" button, because that is the
 * operator editing a profile, which he can already do.
 */
export async function readCv(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const candidateId = Number(formData.get('candidateId'))
  if (!candidateId) return { error: 'No tutor.' }

  const outcome = await readCandidateCv(candidateId, {
    force: formData.get('force') === '1',
  })

  if (!outcome.ok) return { error: readFailureMessage(outcome.reason) }

  revalidatePath(`/dashboard/people/${candidateId}`)

  if (outcome.already) return { ok: 'This CV has already been read.' }

  const { reading, filled } = outcome
  const parts: string[] = []
  if (filled > 0) parts.push(`filled ${filled} empty ${filled === 1 ? 'field' : 'fields'}`)
  if (reading.conflicts.length > 0) {
    parts.push(
      `${reading.conflicts.length} ${reading.conflicts.length === 1 ? 'disagreement' : 'disagreements'} to look at`,
    )
  }
  if (reading.additions.length > 0) parts.push('something extra to consider')
  if (parts.length === 0) parts.push('nothing new — it agrees with the profile')

  return { ok: `Read: ${parts.join(', ')}.` }
}

/**
 * Check the educational documents against what the tutor answered.
 *
 * A button, like reading the CV, and for the same reason — this is the same act
 * on the same page, sharing step 5's budget rather than opening a new one.
 *
 * It reports and never corrects. A document that does not back what somebody
 * answered is a thing for the operator to look at with the file open beside it;
 * `candidates.education` stays their own answer either way.
 */
export async function checkDocuments(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const candidateId = Number(formData.get('candidateId'))
  if (!candidateId) return { error: 'No tutor.' }

  const outcome = await verifyCandidateDocuments(candidateId, {
    force: formData.get('force') === '1',
  })

  if (!outcome.ok) return { error: verifyFailureMessage(outcome.reason) }

  revalidatePath(`/dashboard/people/${candidateId}`)

  const { checked, attention, results } = outcome
  const unreadable = results.filter((r) => r.skipped).length

  if (checked === 0) {
    return unreadable > 0
      ? { error: `Nothing could be read — ${unreadable} ${unreadable === 1 ? 'file' : 'files'} in a format no reader takes.` }
      : { ok: 'Every document has already been checked.' }
  }

  const parts = [`Checked ${checked} ${checked === 1 ? 'document' : 'documents'}`]
  parts.push(
    attention > 0
      ? `${attention} ${attention === 1 ? 'needs' : 'need'} a look`
      : 'nothing out of order',
  )
  if (unreadable > 0) parts.push(`${unreadable} could not be read`)

  return { ok: `${parts.join(', ')}.` }
}
