/**
 * Ethiopian mobile numbers. Pure.
 *
 * Share-contact is still the primary way we get a number — Telegram verifies it
 * and there is nothing to mistype. But a reply keyboard is easy to miss on
 * Telegram Desktop, and someone who cannot find the button must not be trapped,
 * so a typed number is accepted when it is unambiguously a real one.
 *
 * Mobile prefixes in use: 09x (Ethio Telecom) and 07x (Safaricom Ethiopia).
 */

export type PhoneResult =
  | { ok: true; e164: string; national: string }
  | { ok: false; reason: 'too_short' | 'too_long' | 'not_mobile' | 'not_ethiopian' }

export function normalizePhone(input: string): PhoneResult {
  // Keep a leading +, drop spaces, dashes, brackets and any other decoration.
  const cleaned = input.trim().replace(/[^\d+]/g, '')
  let digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned

  if (digits.startsWith('00')) digits = digits.slice(2)

  // 251XXXXXXXXX → drop the country code and work in national form.
  if (digits.startsWith('251')) digits = digits.slice(3)
  else if (digits.startsWith('0')) digits = digits.slice(1)
  else if (/^[97]\d{8}$/.test(digits)) {
    // already national without the trunk 0
  } else if (digits.length > 9) {
    return { ok: false, reason: 'not_ethiopian' }
  }

  if (digits.length < 9) return { ok: false, reason: 'too_short' }
  if (digits.length > 9) return { ok: false, reason: 'too_long' }
  if (!/^[97]/.test(digits)) return { ok: false, reason: 'not_mobile' }

  return { ok: true, e164: `+251${digits}`, national: `0${digits}` }
}

export function isValidPhone(input: string): boolean {
  return normalizePhone(input).ok
}

/** What to tell someone whose number we could not read. */
export function phoneProblem(reason: string): string {
  switch (reason) {
    case 'too_short': return 'That number is too short. An Ethiopian mobile has 10 digits, like 0911234567.'
    case 'too_long': return 'That number is too long. An Ethiopian mobile has 10 digits, like 0911234567.'
    case 'not_mobile': return 'That does not look like a mobile number. It should start 09 or 07.'
    default: return 'That does not look like an Ethiopian mobile number. Try 0911234567.'
  }
}
