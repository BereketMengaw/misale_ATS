import { formatEtb } from '@/lib/money/commission'
import { payIntoLines, type PaymentDetails } from '@/lib/settings/payment-details'

/**
 * What the tutor is actually told. English only — see CLAUDE.md.
 *
 * The message this replaces was sent by hand to 268 people and ended "you can
 * call us for detail" (docs/09-what-to-send-by-hand.md). The detail it withheld
 * was the account number, so the only way to pay was to ring a human. Putting
 * the account in the message is what makes the phone call unnecessary — the
 * design rule is satisfied by answering the question, not by refusing it.
 *
 * Nothing here invites a reply, and no line suggests a person is reading.
 */

export type PrepaymentNotice = {
  amountCents: number
  reference: string
  dueLabel: string
  details: PaymentDetails
}

export function prepaymentDue(n: PrepaymentNotice): string {
  return [
    `Your one-off pre-payment of ${formatEtb(n.amountCents)} ETB is now due.`,
    '',
    'Send it to:',
    ...payIntoLines(n.details).map((l) => `  ${l}`),
    '',
    `Put this code in the payment reason: ${n.reference}`,
    'That code is how the payment finds you. Without it, it has to be matched by hand.',
    '',
    `Due by ${n.dueLabel}.`,
    '',
    'Once it arrives you will get a confirmation here. Nothing to reply to.',
  ].join('\n')
}

/** The chase. Firm, and still not a conversation. */
export function prepaymentOverdue(n: PrepaymentNotice): string {
  return [
    `Your pre-payment of ${formatEtb(n.amountCents)} ETB has not reached us.`,
    `It was due by ${n.dueLabel}.`,
    '',
    'Send it to:',
    ...payIntoLines(n.details).map((l) => `  ${l}`),
    '',
    `Payment reason: ${n.reference}`,
    '',
    'If you have already sent it, ignore this — it can take a day to match.',
  ].join('\n')
}

export function prepaymentReceived(amountCents: number, reference: string): string {
  return [
    `Received — your pre-payment of ${formatEtb(amountCents)} ETB is settled.`,
    `Reference: ${reference}`,
    '',
    'Nothing further is owed up front. Our fee still comes out of each payment, as in your offer.',
  ].join('\n')
}

export function prepaymentWaived(amountCents: number): string {
  return [
    `Your pre-payment of ${formatEtb(amountCents)} ETB has been cancelled. You do not owe it.`,
    '',
    'Our fee still comes out of each payment, as in your offer.',
  ].join('\n')
}

/**
 * Asking a hired tutor where they want to be paid. Buttons pick the provider;
 * the account number itself is typed, which is not a conversation — it is
 * machine-validated by `checkAccount` and nobody reads it to interpret it, the
 * same reasoning that already lets a tutor type their phone number.
 */
export const askPayoutProvider = [
  'Before your first payment, I need to know where to send it.',
  '',
  'Which do you want to be paid into?',
].join('\n')

export const askPayoutBank = [
  'Which bank?',
  '',
  'Tap yours, or tap "Another one" and type its name.',
].join('\n')

export const askPayoutBankTyped = 'Type the name of your bank.'

export const payoutBankProblem: Record<'empty' | 'too-short' | 'too-long', string> = {
  empty: 'That was blank. Type the name of your bank.',
  'too-short': 'That is too short to be a bank name. Type it again.',
  'too-long': 'That is too long for a bank name. Just the name will do.',
}

export const askPayoutAccount = (label: string) =>
  [`Send me your ${label} account number.`, 'Digits only — no spaces or letters.'].join('\n')

export const askPayoutName = 'And the name on that account, exactly as the bank has it.'

export function payoutSaved(label: string, account: string, name: string): string {
  return [
    'Saved. You will be paid into:',
    '',
    `  ${label} ${account}`,
    `  ${name}`,
    '',
    'If that is wrong, use Payment details in the menu to change it.',
  ].join('\n')
}

export const payoutAccountProblem: Record<'empty' | 'not-digits' | 'too-short' | 'too-long', string> = {
  empty: 'That was blank. Send the account number.',
  'not-digits': 'That has letters in it. Send the account number, digits only.',
  'too-short': 'That is too short for an account number. Check it and send it again.',
  'too-long': 'That is too long for an account number. Check it and send it again.',
}
