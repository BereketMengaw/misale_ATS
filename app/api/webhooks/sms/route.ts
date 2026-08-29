import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { ingestSms } from '@/lib/payments/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Where the Android gateway forwards incoming SMS.
 *
 * Built against the documented contract of `android-sms-gateway` by capcom6
 * (docs.sms-gate.app). The shape it POSTs for a received message:
 *
 *   { deviceId, event: "sms:received", id, webhookId,
 *     payload: { messageId, message, sender, recipient, simNumber, receivedAt } }
 *
 * Two things that contract forces:
 *
 * 1. The app cannot send custom headers, so the shared secret travels in the
 *    query string. That is why ?key= exists rather than being a convenience.
 * 2. It signs instead: X-Signature is HMAC-SHA256 over (raw body + X-Timestamp)
 *    with the signing key from the app's settings. When SMS_SIGNING_KEY is set
 *    that is checked, and it is the stronger of the two.
 *
 * The phone always initiates, and it re-sends anything it missed while asleep,
 * so this must be idempotent — the unique index on (txn_ref, amount, sender)
 * is what makes that true.
 */

type Incoming = {
  event?: string
  payload?: {
    message?: string
    sender?: string
    recipient?: string | null
    receivedAt?: string
  }
  // Tolerated shapes, in case the app's payload differs from its documentation.
  body?: string
  message?: string
  text?: string
  from?: string
  sender?: string
}

const HANDLED_EVENTS = new Set(['sms:received', 'sms:data-received'])

function extract(input: Incoming): { body: string | null; sender: string | null } {
  const body = input.payload?.message ?? input.body ?? input.message ?? input.text ?? null
  const sender = input.payload?.sender ?? input.from ?? input.sender ?? null
  return { body: body?.trim() || null, sender: sender?.trim() || null }
}

/** Constant time, so a wrong signature leaks nothing about the right one. */
function signatureValid(raw: string, timestamp: string, signature: string, key: string): boolean {
  const expected = createHmac('sha256', key).update(raw + timestamp).digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature.trim().toLowerCase(), 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  const secret = process.env.SMS_WEBHOOK_SECRET
  const signingKey = process.env.SMS_SIGNING_KEY

  if (!secret && !signingKey) {
    return NextResponse.json({ ok: false, error: 'not configured' }, { status: 503 })
  }

  // The signature is over the RAW body, so read text before parsing.
  const raw = await req.text()

  const signature = req.headers.get('x-signature')
  const timestamp = req.headers.get('x-timestamp')
  const signed = Boolean(signingKey && signature && timestamp)

  if (signed) {
    if (!signatureValid(raw, timestamp!, signature!, signingKey!)) {
      return NextResponse.json({ ok: false, error: 'bad signature' }, { status: 401 })
    }
  } else {
    const key = new URL(req.url).searchParams.get('key')
    const auth = req.headers.get('authorization')
    if (!secret || (key !== secret && auth !== `Bearer ${secret}`)) {
      return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 })
    }
  }

  let input: Incoming
  try {
    input = JSON.parse(raw) as Incoming
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 })
  }

  // SYSTEM_PING, SMS_SENT and friends are not payments; acknowledge and stop.
  if (input.event && !HANDLED_EVENTS.has(input.event)) {
    return NextResponse.json({ ok: true, outcome: 'ignored', why: `event ${input.event}` })
  }

  const { body, sender } = extract(input)
  if (!body) {
    // Name the keys we were sent — never the values, which could be somebody's
    // private message — so an unexpected shape is a one-edit fix, not a hunt.
    return NextResponse.json(
      {
        ok: false,
        error: 'no message body found',
        receivedKeys: Object.keys(input ?? {}),
        payloadKeys: input?.payload ? Object.keys(input.payload) : undefined,
        expected: 'payload.message',
      },
      { status: 400 },
    )
  }

  try {
    const result = await ingestSms(body, sender)
    // Always 200 once authorised: a non-payment is not the gateway's fault, and
    // an error status would make it retry a message it should simply forget.
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('sms ingest failed', err)
    return NextResponse.json({ ok: false, error: 'ingest failed' }, { status: 500 })
  }
}

export function GET() {
  return NextResponse.json({ ok: true, endpoint: 'sms-webhook' })
}
