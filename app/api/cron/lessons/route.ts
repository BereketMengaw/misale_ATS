import { NextResponse } from 'next/server'
import { runLessonCron } from '@/lib/placements/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Reminds tutors before a lesson and asks for hours after one.
 *
 * Deliberately callable by anything on a timer — Vercel Cron, Supabase pg_cron,
 * or a free external pinger — because Vercel's Hobby plan limits how often its
 * own cron may fire, and lesson reminders need to be closer to hourly than
 * daily. The pass is idempotent, so running it too often costs nothing and
 * running it twice changes nothing.
 *
 * Auth: Vercel Cron sends its own bearer token; anything else uses CRON_SECRET.
 */
function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = req.headers.get('authorization')
  if (header === `Bearer ${secret}`) return true

  // Allow the secret in the query string too: several free pingers cannot set
  // headers, and this endpoint only ever triggers work, never returns data.
  const url = new URL(req.url)
  return url.searchParams.get('key') === secret
}

async function handle(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 })
  }

  try {
    const result = await runLessonCron()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('lesson cron failed', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
