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
import { retrieve } from '../lib/bot/answers/retrieve'
import { normalize } from '../lib/bot/answers/retrieve'

type Part = string | { type?: string; text?: string }
type Msg = { type?: string; from_id?: string; from?: string; text?: Part | Part[]; date?: string }
type Chat = { name?: string; type?: string; messages?: Msg[] }
type Export = { personal_information?: { user_id?: number }; chats?: { list?: Chat[] } }

const path = process.argv[2]
if (!path) {
  console.error('Usage: mine-chats.mts <result.json>')
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

/** A question someone asked, not a greeting, a forward, or your own reply. */
function isWorthReading(body: string): boolean {
  const t = body.trim()
  if (t.length < 8 || t.length > 400) return false
  if (t.startsWith('/')) return false
  if (/^[\d\s+()-]+$/.test(t)) return false
  return true
}

const asked = new Map<string, { text: string; count: number; chats: Set<string> }>()

for (const chat of data.chats?.list ?? []) {
  if (chat.type === 'saved_messages') continue
  for (const msg of chat.messages ?? []) {
    if (msg.type !== 'message') continue
    if (me && msg.from_id === me) continue // your own words are not the question
    const body = flatten(msg.text).trim()
    if (!isWorthReading(body)) continue

    const key = normalize(body)
    const seen = asked.get(key) ?? { text: body, count: 0, chats: new Set<string>() }
    seen.count++
    seen.chats.add(chat.name ?? 'unknown')
    asked.set(key, seen)
  }
}

const rows = [...asked.values()].map((a) => {
  const hits = retrieve(a.text, 2)
  return { ...a, top: hits[0]?.entry.id ?? null, score: hits[0]?.score ?? 0, people: a.chats.size }
})

const uncovered = rows.filter((r) => !r.top).sort((a, b) => b.people - a.people || b.count - a.count)
const weak = rows.filter((r) => r.top && r.score < 4).sort((a, b) => b.people - a.people)
const covered = rows.filter((r) => r.top && r.score >= 4)

console.log(`\n${rows.length} distinct messages from ${new Set(rows.flatMap(r => [...r.chats])).size} people\n`)

console.log(`── NOTHING COVERS THESE (${uncovered.length}) — the entries to write next\n`)
for (const r of uncovered.slice(0, 40)) {
  console.log(`  ${String(r.people).padStart(3)} people  ${r.text.slice(0, 90)}`)
}

console.log(`\n── MATCHED, BUT WEAKLY (${weak.length}) — check these reach the right answer\n`)
for (const r of weak.slice(0, 25)) {
  console.log(`  ${String(r.people).padStart(3)} people  ${r.text.slice(0, 62).padEnd(64)} → ${r.top} (${r.score})`)
}

console.log(`\n── Already answered: ${covered.length}\n`)
