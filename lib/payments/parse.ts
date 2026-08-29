import { findReferences } from '@/lib/money/reference'

/**
 * Reading a bank SMS. PURE — text in, fields out.
 *
 * ⚠️  THE PATTERNS BELOW ARE PLACEHOLDERS, written from the documented shapes
 * rather than from messages anyone has actually received. They are structured
 * so replacing them is a one-file change: add real bodies to
 * tests/fixtures/sms.ts, run the tests, and adjust the regex until they pass.
 * Until then, expect most real messages to fall through to the Unmatched inbox
 * — which is the designed behaviour, not a failure. docs/05-money.md: "The
 * parser is never a single point of failure."
 */

export type Provider = 'cbe' | 'telebirr' | 'awash' | 'unknown'

export type ParsedPayment = {
  provider: Provider
  /** Integer cents, so no float ever touches money. */
  amountCents: number | null
  payer: string | null
  /** The bank's own transaction id, for the audit trail. */
  txnRef: string | null
  /** OUR reference code — MIS-XXXX — if the parent put it in the reason. */
  reference: string | null
  /** CBE puts a receipt page in the SMS; step 11's fallback can open it. */
  receiptUrl: string | null
  /** False when the message is not about money arriving at all. */
  isCredit: boolean
}

/** "4,500.00" or "4500" → 450000 cents. Returns null rather than guessing. */
export function parseAmountCents(text: string | null | undefined): number | null {
  if (!text) return null
  const cleaned = text.replace(/,/g, '').trim()
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null

  const [whole, frac = ''] = cleaned.split('.')
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}

/** Names arrive shouted and padded; store them comparable. */
export function tidyName(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = raw.replace(/\s+/g, ' ').replace(/[.,]+$/, '').trim()
  return cleaned.length >= 2 && cleaned.length <= 60 ? cleaned : null
}

/**
 * Which bank sent this. The SENDER ID is the reliable signal — Ethiopian banks
 * send from alphanumeric ids like "CBE" and "telebirr", and the body itself
 * often never names them. The body is only a fallback.
 */
export function detectProvider(text: string, sender?: string | null): Provider {
  const from = (sender ?? '').toLowerCase()
  if (/cbe|commercialbank/.test(from)) return 'cbe'
  if (/telebirr|ethiotel/.test(from)) return 'telebirr'
  if (/awash/.test(from)) return 'awash'

  const t = text.toLowerCase()
  if (t.includes('commercial bank of ethiopia') || t.includes('apps.cbe.com.et')) return 'cbe'
  if (t.includes('telebirr')) return 'telebirr'
  if (t.includes('awash')) return 'awash'
  return 'unknown'
}

/** Money leaving is not money arriving; a debit alert must never mark anything paid. */
function looksLikeCredit(text: string): boolean {
  const t = text.toLowerCase()
  if (/\b(debited|withdrawn|sent to|purchase|you have paid|transferred to)\b/.test(t)) return false
  return /\b(credited|received|deposit|has been credited|you have received)\b/.test(t)
}

// --- PLACEHOLDER PATTERNS — replace once real messages are in the fixtures ---

const AMOUNT = /(?:ETB|Birr)\s*([\d,]+(?:\.\d{1,2})?)/i
const CBE_PAYER = /from\s+([A-Z][A-Za-z.\- ]{2,50}?)(?=\s+(?:on|has|,|\.)|$)/
const CBE_TXN = /\bRef(?:erence)?[:\s]+([A-Z0-9]{6,20})/i
const CBE_RECEIPT = /(https?:\/\/apps\.cbe\.com\.et\/\?id=[A-Za-z0-9]+)/i
const TELEBIRR_PAYER = /from\s+([A-Za-z.\- ]{2,50}?)\s*(?:\(|,|\.|$)/i
const TELEBIRR_TXN = /transaction (?:number|id)[:\s]+([A-Z0-9]{6,20})/i

export function parsePaymentSms(body: string, sender?: string | null): ParsedPayment {
  const text = body.replace(/\s+/g, ' ').trim()
  const provider = detectProvider(text, sender)

  const amountCents = parseAmountCents(AMOUNT.exec(text)?.[1] ?? null)
  const reference = findReferences(text)[0] ?? null
  const receiptUrl = CBE_RECEIPT.exec(text)?.[1] ?? null

  let payer: string | null = null
  let txnRef: string | null = null

  if (provider === 'telebirr') {
    payer = tidyName(TELEBIRR_PAYER.exec(text)?.[1] ?? null)
    txnRef = TELEBIRR_TXN.exec(text)?.[1] ?? null
  } else {
    payer = tidyName(CBE_PAYER.exec(text)?.[1] ?? null)
    txnRef = CBE_TXN.exec(text)?.[1] ?? null
  }

  return {
    provider,
    amountCents,
    payer,
    txnRef,
    reference,
    receiptUrl,
    isCredit: looksLikeCredit(text),
  }
}

/**
 * Is this worth storing at all? A personal message that slipped past the
 * phone's sender allowlist is dropped without its text ever being kept —
 * defence in depth, per docs/04-messaging.md.
 */
export function looksLikePayment(body: string, sender?: string | null): boolean {
  const parsed = parsePaymentSms(body, sender)
  return parsed.isCredit && parsed.amountCents !== null
}
