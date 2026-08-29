/**
 * Checks that the parts nobody can unit-test are actually wired up:
 * environment, database schema, the bot token, the webhook, the channels.
 *
 *   npm run doctor
 *
 * Every line is either fine, or tells you what to do about it.
 */
import { createClient } from '@supabase/supabase-js'
import { Bot, GrammyError } from 'grammy'

type Result = { ok: boolean; label: string; detail?: string; fix?: string }
const results: Result[] = []

function pass(label: string, detail?: string) {
  results.push({ ok: true, label, detail })
}
function fail(label: string, detail: string, fix?: string) {
  results.push({ ok: false, label, detail, fix })
}

// ---------------------------------------------------------------- environment
const need = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'NEXT_PUBLIC_APP_URL',
] as const

const missing = need.filter((k) => !process.env[k])
if (missing.length) {
  fail('Environment', `missing ${missing.join(', ')}`, 'Copy .env.example to .env.local and fill it in.')
  report()
  process.exit(1)
}
pass('Environment', `${need.length} variables set`)

// ------------------------------------------------------------------- database
/** A dead host makes supabase-js throw rather than return an error. Catch both. */
async function safe<T>(run: () => PromiseLike<{ data?: T; error: { message: string } | null; count?: number | null }>) {
  try {
    return await run()
  } catch (err) {
    return { data: undefined, error: { message: err instanceof Error ? err.message : String(err) }, count: null }
  }
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
})

const TABLES = [
  'operators',
  'settings',
  'bot_sessions',
  'message_log',
  'job_posts',
  'channels',
  'post_publications',
] as const

// A HEAD request against a missing table returns no body, and supabase-js then
// reports no error — so every existence check has to ask for an actual row.
const probe = await safe(() => db.from('operators').select('*').limit(1))
const reachable = !probe.error || !/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(probe.error.message)

if (!reachable) {
  fail('Database', probe.error!.message, 'Check NEXT_PUBLIC_SUPABASE_URL and that the project is running.')
}

if (reachable) {
  for (const table of TABLES) {
    const { error } = await safe(() => db.from(table).select('*').limit(1))
    if (error) {
      fail(`Table ${table}`, error.message, 'Run the migrations in supabase/migrations, oldest first.')
    } else {
      pass(`Table ${table}`)
    }
  }
}

// The settings rows the code reads by key.
if (reachable) {
const { data: settings } = await safe<{ key: string }[]>(() => db.from('settings').select('key'))
const keys = new Set((settings ?? []).map((s) => s.key))
for (const key of ['commission', 'contact_release', 'ranking_weights', 'post_expiry_days']) {
  keys.has(key)
    ? pass(`Setting ${key}`)
    : fail(`Setting ${key}`, 'not seeded', 'Re-run migration 0001.')
}

// The one stored function the bot calls.
{
  const { error } = await safe(() => db.rpc('bump_apply_count', { publication_id: -1 }))
  error
    ? fail('Function bump_apply_count', error.message, 'Re-run migration 0003.')
    : pass('Function bump_apply_count')
}

// The PostgREST filter the bot uses to list live jobs — easy to get wrong.
{
  const { error } = await safe(() =>
    db
      .from('job_posts')
      .select('id')
      .eq('status', 'open')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .limit(1),
  )
  error
    ? fail('Live-jobs filter', error.message, 'The .or() filter in lib/bot/jobs.ts needs fixing.')
    : pass('Live-jobs filter')
}

// Someone has to be able to log in.
{
  const { count } = await safe(() => db.from('operators').select('*', { count: 'exact' }).limit(1))
  count && count > 0
    ? pass('Operators', `${count} can log in`)
    : fail(
        'Operators',
        'no rows — every login will be refused',
        "Create your user in Supabase Auth, then: insert into operators (id, email) values ('<uuid>', '<email>');",
      )
}
}

// -------------------------------------------------------------------- telegram
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!)
let botUsername = ''

try {
  await bot.init()
  botUsername = bot.botInfo.username
  pass('Bot token', `@${botUsername}`)
} catch (err) {
  fail(
    'Bot token',
    err instanceof GrammyError ? err.description : String(err),
    'Check TELEGRAM_BOT_TOKEN against @BotFather.',
  )
}

if (botUsername) {
  const expected = `${process.env.NEXT_PUBLIC_APP_URL!.replace(/\/$/, '')}/api/telegram/webhook`
  const info = await bot.api.getWebhookInfo()

  if (!info.url) {
    fail('Webhook', 'not registered', 'npm run bot:set-webhook')
  } else if (info.url !== expected) {
    fail('Webhook', `points at ${info.url}`, `Expected ${expected}. Re-run npm run bot:set-webhook.`)
  } else {
    pass('Webhook', info.url)
  }

  if (info.last_error_message) {
    fail('Webhook delivery', info.last_error_message, 'Telegram could not reach the app. Is it deployed?')
  }
  if (info.pending_update_count > 0) {
    fail('Webhook backlog', `${info.pending_update_count} updates queued`, 'Updates are arriving but not being handled.')
  }

  // ------------------------------------------------------------------ channels
  const { data: channels } = await safe<{ id: number; title: string; chat_id: number | null; kind: string }[]>(
    () => db.from('channels').select('id, title, chat_id, kind'),
  )

  if (!channels?.length) {
    fail('Channels', 'none added', 'Add a private test channel at /dashboard/channels.')
  }

  for (const c of channels ?? []) {
    if (!c.chat_id) {
      pass(`Channel ${c.title}`, 'manual — posted by hand')
      continue
    }
    try {
      const member = await bot.api.getChatMember(c.chat_id, bot.botInfo.id)
      if (member.status !== 'administrator') {
        fail(`Channel ${c.title}`, `bot is "${member.status}"`, 'Make the bot an admin of the channel.')
      } else if (member.can_post_messages === false) {
        fail(`Channel ${c.title}`, 'admin without "Post messages"', 'Grant the Post messages permission.')
      } else {
        pass(`Channel ${c.title}`, 'bot can post')
      }
    } catch (err) {
      fail(`Channel ${c.title}`, err instanceof GrammyError ? err.description : String(err))
    }
  }
}

report()

function report() {
  const failures = results.filter((r) => !r.ok)

  console.log('')
  for (const r of results) {
    const mark = r.ok ? '\x1b[32m ok \x1b[0m' : '\x1b[31mFAIL\x1b[0m'
    console.log(`  ${mark}  ${r.label}${r.detail ? `  \x1b[90m${r.detail}\x1b[0m` : ''}`)
    if (!r.ok && r.fix) console.log(`        \x1b[33m→ ${r.fix}\x1b[0m`)
  }

  console.log('')
  if (failures.length === 0) {
    console.log(`  \x1b[32mAll ${results.length} checks passed.\x1b[0m Send /start to the bot, then publish a job.\n`)
  } else {
    console.log(`  \x1b[31m${failures.length} of ${results.length} checks failed.\x1b[0m\n`)
  }
  process.exitCode = failures.length ? 1 : 0
}
