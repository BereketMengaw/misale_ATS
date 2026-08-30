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

/**
 * The banks tutors actually use, offered as buttons so most people never type.
 *
 * Not an enum and not exhaustive on purpose: the list changes on somebody
 * else's schedule, and a tutor banking somewhere not on it must not be stuck —
 * "Another one" takes a typed name. Order is roughly by how often they come up.
 */
export const COMMON_BANKS = [
  'Awash Bank',
  'Bank of Abyssinia',
  'Dashen Bank',
  'Cooperative Bank of Oromia',
  'Oromia Bank',
  'Wegagen Bank',
  'Hibret Bank',
  'Zemen Bank',
  'Abay Bank',
  'Amhara Bank',
  'Berhan Bank',
  'Enat Bank',
] as const

export function providerLabel(p: PayoutProvider | null): string {
  return PAYOUT_PROVIDERS.find((x) => x.value === p)?.label ?? '—'
}

/**
 * What to print beside an account number: the bank's own name where there is
 * one. "Another bank 1000123456789" tells the operator nothing he can act on.
 */
export function destinationLabel(p: PayoutProvider | null, bank: string | null): string {
  if (p === 'other') return bank?.trim() || 'Bank not named'
  return providerLabel(p)
}

export type BankCheck = { ok: true; bank: string } | { ok: false; reason: 'empty' | 'too-short' | 'too-long' }

/** A name a person can read, not a value we can verify — there is no registry to check. */
export function checkBankName(input: string): BankCheck {
  const bank = input.trim().replace(/\s+/g, ' ')
  if (bank.length === 0) return { ok: false, reason: 'empty' }
  if (bank.length < 3) return { ok: false, reason: 'too-short' }
  if (bank.length > 60) return { ok: false, reason: 'too-long' }
  return { ok: true, bank }
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

export type PayoutDestination = {
  provider: PayoutProvider | null
  account: string | null
  name: string | null
  bank?: string | null
}

/**
 * A payout cannot be sent without knowing where, what number, and whose name.
 * "Another bank" without the bank's name is not a destination — it is an
 * account number with nowhere to send it.
 */
export function isPayable(d: PayoutDestination): boolean {
  if (!d.provider || !d.account || !d.name) return false
  return d.provider === 'other' ? Boolean(d.bank?.trim()) : true
}
