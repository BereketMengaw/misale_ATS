import { NextResponse } from 'next/server'
import { ingestSms } from '@/lib/payments/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Where the Android gateway forwards bank messages.
 *
 * The phone always initiates: the server never reaches into it. The app is
 * opened a few times a day and posts everything that arrived since it last
 * looked, so this endpoint sees repeats and must be idempotent — the unique
 * index on (txn_ref, amount, sender) is what makes that true.
 *
 * Accepts the shape android-sms-gateway sends, and a few obvious variations,
 * because the exact field names should be confirmed against the real app
 * before going live.
 */
type Incoming = {
  body?: string
  message?: string
  text?: string
  from?: string
  sender?: string
  phoneNumber?: string
  payload?: { message?: string; phoneNumber?: string }
}

function extract(input: Incoming): { body: string | null; sender: string | null } {
  const body = input.body ?? input.message ?? input.text ?? input.payload?.message ?? null
  const sender = input.from ?? input.sender ?? input.phoneNumber ?? input.payload?.phoneNumber ?? null
  return { body: body?.trim() || null, sender: sender?.trim() || null }
}

export async function POST(req: Request) {
  const secret = process.env.SMS_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'not configured' }, { status: 503 })
  }

  const auth = req.headers.get('authorization')
  const key = new URL(req.url).searchParams.get('key')
  if (auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 })
  }

  let input: Incoming
  try {
    input = (await req.json()) as Incoming
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 })
  }

  const { body, sender } = extract(input)
  if (!body) {
    // The gateway app's exact field names are worth confirming rather than
    // guessing. Report the keys we were sent — never the values, which could
    // be somebody's private message — so the shape can be adapted quickly.
    return NextResponse.json(
      {
        ok: false,
        error: 'no message body found',
        receivedKeys: Object.keys(input ?? {}),
        nestedKeys: input?.payload ? Object.keys(input.payload) : undefined,
        expected: 'one of: body, message, text, payload.message',
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
