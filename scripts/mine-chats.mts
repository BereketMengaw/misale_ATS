/**
 * Reads a Telegram Desktop export and turns real conversations into a list of
 * what to write next in lib/bot/answers/knowledge.ts.
 *
 *   Telegram Desktop → Settings → Advanced → Export Telegram data
 *   → Personal chats, format JSON  →  result.json
 *
 *   npx tsx --tsconfig tsconfig.json scripts/mine-chats.mts ~/Downloads/result.json
 *
 * Reads only messages sent TO you — what people asked, never what you replied —
 * and never leaves this machine. Nothing is written anywhere.
 */
import { readFileSync } from 'node:fs'
import { mine, printReport, type InboundMessage } from '../lib/mining/questions'

type Part = string | { type?: string; text?: string }
type Msg = { type?: string; from_id?: string; text?: Part | Part[] }
type Chat = { name?: string; type?: string; messages?: Msg[] }
type Export = { personal_information?: { user_id?: number }; chats?: { list?: Chat[] } }

const path = process.argv[2]
if (!path) {
  console.error('Usage: npm run mine:export -- <result.json>')
  process.exit(1)
}

const data = JSON.parse(readFileSync(path, 'utf8')) as Export
const me = data.personal_information?.user_id ? `user${data.personal_information.user_id}` : null

/** Telegram writes text as a string, or as parts when it carries links or bold. */
function flatten(text: Msg['text']): string {
  if (typeof text === 'string') return text
  if (Array.isArray(text)) return text.map((p) => (typeof p === 'string' ? p : p.text ?? '')).join('')
  if (text && typeof text === 'object') return text.text ?? ''
  return ''
}

const messages: InboundMessage[] = []
let chats = 0

for (const chat of data.chats?.list ?? []) {
  if (chat.type === 'saved_messages') continue
  chats++
  for (const msg of chat.messages ?? []) {
    if (msg.type !== 'message') continue
    if (me && msg.from_id === me) continue // your own words are not the question
    const text = flatten(msg.text).trim()
    if (text) messages.push({ text, from: chat.name ?? 'unknown' })
  }
}

printReport(mine(messages), `${chats} exported conversations`)
