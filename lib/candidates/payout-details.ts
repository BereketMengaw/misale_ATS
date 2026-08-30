/**
 * Where a tutor is paid. PURE.
 *
 * `payouts` has always known what a tutor is owed to the cent and had nowhere
 * to send it — the operator was expected to remember. This is the missing half.
 *
 * Validation is deliberately shallow. We cannot verify that an account exists
 * without a bank API the project does not have (docs/07-setup-checklist.md:
 * "No bank API, integration or permission"), so the job here is to catch the
 * typo that would send money nowhere, and then show the number back to the
 * tutor so a human can see it is theirs.
 */

export type PayoutProvider = 'telebirr' | 'cbe' | 'other'

export const PAYOUT_PROVIDERS: { value: PayoutProvider; label: string }[] = [
  { value: 'telebirr', label: 'Telebirr' },
  { value: 'cbe', label: 'CBE' },
  { value: 'other', label: 'Another bank' },
]

export function providerLabel(p: PayoutProvider | null): string {
  return PAYOUT_PROVIDERS.find((x) => x.value === p)?.label ?? '—'
}

export type AccountCheck =
  | { ok: true; account: string }
  | { ok: false; reason: 'empty' | 'not-digits' | 'too-short' | 'too-long' }

/**
 * Ethiopian account numbers are digits: CBE's are 13, Telebirr is the phone
 * number. The range below accepts both and rejects a name typed into the number
 * box, which is the mistake people actually make.
 */
export function checkAccount(input: string): AccountCheck {
  const digits = input.replace(/[\s-]/g, '')
  if (digits.length === 0) return { ok: false, reason: 'empty' }
  if (!/^\d+$/.test(digits)) return { ok: false, reason: 'not-digits' }
  if (digits.length < 9) return { ok: false, reason: 'too-short' }
  if (digits.length > 20) return { ok: false, reason: 'too-long' }
  return { ok: true, account: digits }
}

/** "1000•••••6789" — enough to recognise, not enough to reuse if a screen leaks. */
export function maskAccount(account: string | null): string {
  if (!account) return '—'
  if (account.length <= 8) return account
  return `${account.slice(0, 4)}${'•'.repeat(Math.min(5, account.length - 8))}${account.slice(-4)}`
}

export type PayoutDestination = {
  provider: PayoutProvider | null
  account: string | null
  name: string | null
}

/** A payout cannot be sent without all three. The UI blocks on exactly this. */
export function isPayable(d: PayoutDestination): boolean {
  return Boolean(d.provider && d.account && d.name)
}
