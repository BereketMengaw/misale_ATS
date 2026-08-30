/**
 * Pairs what people asked with how you answered, ranked by how many people
 * asked it. The list to write the knowledge base from.
 *
 *   npm run mine:pairs -- <result.json>
 *
 * Reads only. Writes nothing, sends nothing anywhere.
 */
import { readFileSync } from 'node:fs'
import { cannedReplies, pair, type Conversation, type Turn } from '../lib/mining/pairs'

type Part = string | { type?: string; text?: string }
type Msg = { type?: string; from_id?: string; text?: Part | Part[] }
type Chat = { name?: string; type?: string; messages?: Msg[] }
type Export = { personal_information?: { user_id?: number }; chats?: { list?: Chat[] } }

const path = process.argv[2]
if (!path) {
  console.error('Usage: npm run mine:pairs -- <result.json> [howMany]')
  process.exit(1)
}
const show = Number(process.argv[3] || 30)

const data = JSON.parse(readFileSync(path, 'utf8')) as Export
const me = data.personal_information?.user_id ? `user${data.personal_information.user_id}` : null
if (!me) {
  console.error('The export has no personal_information.user_id, so your own messages cannot be told apart.')
  process.exit(1)
}

function flatten(text: Msg['text']): string {
  if (typeof text === 'string') return text
  if (Array.isArray(text)) return text.map((p) => (typeof p === 'string' ? p : p.text ?? '')).join('')
  if (text && typeof text === 'object') return text.text ?? ''
  return ''
}

const conversations: Conversation[] = []
for (const chat of data.chats?.list ?? []) {
  if (chat.type !== 'personal_chat') continue
  const turns: Turn[] = []
  for (const msg of chat.messages ?? []) {
    if (msg.type !== 'message') continue
    const text = flatten(msg.text).trim()
    if (text) turns.push({ mine: msg.from_id === me, text })
  }
  if (turns.length) conversations.push({ who: chat.name ?? 'unknown', turns })
}

const canned = cannedReplies(conversations)
console.log(`\n${'═'.repeat(72)}\nYOUR OWN ANSWERS, most reused first — write the bot from these\n${'═'.repeat(72)}`)
for (const c of canned.slice(0, 6)) {
  console.log(`\n── sent to ${c.people} different people ──\n${c.text.slice(0, 900)}`)
}

const pairs = pair(conversations)
const answered = pairs.filter((p) => p.replies.length > 0)

console.log(`\n${answered.length} questions you have answered, across ${conversations.length} conversations`)
console.log(`Showing the ${Math.min(show, answered.length)} most asked.\n`)

for (const p of answered.slice(0, show)) {
  const covered = p.topEntry ? `${p.topEntry} (${p.score})` : 'NOTHING COVERS THIS'
  const tag = p.intent ? `  [intent: ${p.intent}]` : ''
  console.log(`\n${'─'.repeat(72)}`)
  console.log(`${p.people} people asked · bot would reach: ${covered}${tag}`)
  console.log(`  Q: ${p.question.slice(0, 150)}`)
  for (const r of p.replies.slice(0, 2)) {
    console.log(`  A: (${r.count}×) ${r.text.replace(/\n/g, ' ⏎ ').slice(0, 260)}`)
  }
}
console.log()
