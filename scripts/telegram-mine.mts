/**
 * Reads your own Telegram conversations and reports what the bot still cannot
 * answer. Run it whenever you want a refresh — no export, no file handling.
 *
 *   npm run mine:telegram
 *
 * First run asks for your phone and the login code Telegram sends you, then
 * writes a session string to .env.local so later runs need nothing. That
 * session stays on this machine: it is not printed, committed or sent anywhere.
 *
 * It reads only messages OTHER people sent you. Your own replies are skipped —
 * what was asked is the signal, what you answered is what we are improving.
 */
import { appendFileSync } from 'node:fs'
import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'
import input from 'input'
import { mine, printReport, type InboundMessage } from '../lib/mining/questions'

const apiId = Number(process.env.TELEGRAM_API_ID)
const apiHash = process.env.TELEGRAM_API_HASH?.trim()

if (!apiId || !apiHash) {
  console.error(
    [
      'Missing TELEGRAM_API_ID / TELEGRAM_API_HASH.',
      '',
      'Get them once at https://my.telegram.org → API development tools.',
      'Then add to .env.local:',
      '  TELEGRAM_API_ID=1234567',
      '  TELEGRAM_API_HASH=abc123...',
    ].join('\n'),
  )
  process.exit(1)
}

/**
 * Messages per conversation, newest first. 0 means the whole history — which
 * Telegram throttles, so a first full pull is better done from an export.
 */
const PER_CHAT = Number(process.env.MINE_PER_CHAT ?? 300)
/** How many conversations to walk, most recent first. */
const CHAT_LIMIT = Number(process.env.MINE_CHATS || 100)

const saved = process.env.TELEGRAM_SESSION?.trim() ?? ''
const session = new StringSession(saved)
const client = new TelegramClient(session, apiId, apiHash, {
  connectionRetries: 3,
  // Telegram answers a heavy history pull with FLOOD_WAIT. Below this many
  // seconds gramjs sleeps and retries by itself; above it, it throws and the
  // loop below reports what it managed rather than losing the whole run.
  floodSleepThreshold: 120,
})

await client.start({
  phoneNumber: async () => await input.text('Phone number (+251...): '),
  password: async () => await input.text('Two-step password: '),
  phoneCode: async () => await input.text('Code Telegram just sent you: '),
  onError: (err) => console.error(err),
})

if (!saved) {
  // Written, never printed: a session string is full access to the account.
  appendFileSync('.env.local', `\nTELEGRAM_SESSION=${client.session.save()}\n`)
  console.log('Session saved to .env.local — later runs will not ask again.')
}

const me = await client.getMe()
const myId = String(me.id)
console.log(`Signed in as ${me.username ? '@' + me.username : me.firstName}. Reading conversations…`)

const messages: InboundMessage[] = []
let chats = 0

for await (const dialog of client.iterDialogs({ limit: CHAT_LIMIT })) {
  // Channels and big groups are broadcasts, not conversations with tutors.
  if (!dialog.isUser) continue
  chats++

  let read = 0
  try {
    // limit: undefined walks the conversation back to its first message.
    for await (const msg of client.iterMessages(dialog.id, { limit: PER_CHAT || undefined })) {
      if (msg.out) continue // your own reply
      const text = typeof msg.message === 'string' ? msg.message : ''
      if (!text) continue
      messages.push({ text, from: String(dialog.id) })
      read++
    }
  } catch (err) {
    // A throttle or a chat we cannot open must not cost us the other hundred.
    console.warn(`  skipped the rest of one conversation: ${err instanceof Error ? err.message : err}`)
  }

  process.stdout.write(`\r  ${chats} conversations · ${messages.length} messages read`)
}
process.stdout.write('\n')

await client.disconnect()

console.log(`Read ${messages.length} incoming messages across ${chats} conversations.`)
printReport(mine(messages), `${chats} Telegram conversations`)
console.log(`(Your own ${myId ? '' : ''}replies were not read.)`)
