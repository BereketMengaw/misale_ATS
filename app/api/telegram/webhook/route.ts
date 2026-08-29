import { NextResponse } from 'next/server'
import { webhookCallback } from 'grammy'
import { getBot } from '@/lib/bot/bot'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // Telegram echoes the secret we registered with setWebhook. Anyone can find
  // the URL; only Telegram can send this header.
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== env.telegramWebhookSecret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const bot = await getBot()
  const handle = webhookCallback(bot, 'std/http')

  try {
    return await handle(req)
  } catch (err) {
    // Never 500 back at Telegram: it retries, and a poison update would loop.
    console.error('webhook handler failed', err)
    return NextResponse.json({ ok: true })
  }
}

export function GET() {
  return NextResponse.json({ ok: true, endpoint: 'telegram-webhook' })
}
