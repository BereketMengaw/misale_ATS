/**
 * What people ask, paired with how you actually answered it.
 *
 * The question list alone says what is missing. This says what to write, in
 * the words you already use — the point being a bot that answers the way you
 * do, rather than the way I would guess you do.
 *
 * Pure: a conversation in, pairs out.
 */
import { normalize, retrieve } from '@/lib/bot/answers/retrieve'
import { detectIntent, isCourtesy } from '@/lib/bot/answers/intent'

export type Turn = {
  /** True when you sent it, false when they did. */
  mine: boolean
  text: string
}

export type Conversation = {
  /** Who the other person is. Counted, never shown. */
  who: string
  /** In the order they were sent. */
  turns: Turn[]
}

export type AnsweredPair = {
  question: string
  /** Distinct people who asked something that normalizes to the same thing. */
  people: number
  count: number
  /** How you answered, most common first. Deduplicated. */
  replies: { text: string; count: number }[]
  /** What the bot would reach today, if anything. */
  topEntry: string | null
  score: number
  /** Set when the message was an intent rather than a question. */
  intent: string | null
}

/** Your replies run long; the useful part is near the start. */
const MAX_REPLY = 400

/** A reply that is only politeness teaches the bot nothing. */
function isSubstantive(text: string): boolean {
  const t = text.trim()
  return t.length >= 15 && !t.startsWith('/')
}

function askable(text: string): boolean {
  const t = text.trim()
  if (t.length < 5 || t.length > 300 || t.startsWith('/')) return false
  if ((t.match(/\n/g) ?? []).length >= 3) return false
  // "Thank you" followed by your next message is not a question and its answer:
  // it pairs a courtesy with whatever topic you happened to raise next.
  return !isCourtesy(t)
}

export function pair(conversations: Conversation[]): AnsweredPair[] {
  const byQuestion = new Map<
    string,
    { question: string; people: Set<string>; count: number; replies: Map<string, number> }
  >()

  for (const convo of conversations) {
    let pending: string | null = null

    for (const turn of convo.turns) {
      if (!turn.mine) {
        // Their latest message is what your next reply answers.
        if (askable(turn.text)) pending = turn.text.trim()
        continue
      }

      if (!pending || !isSubstantive(turn.text)) continue

      const key = normalize(pending)
      if (!key) { pending = null; continue }

      const row =
        byQuestion.get(key) ??
        { question: pending, people: new Set<string>(), count: 0, replies: new Map<string, number>() }
      row.people.add(convo.who)
      row.count++

      const reply = turn.text.trim().slice(0, MAX_REPLY)
      row.replies.set(reply, (row.replies.get(reply) ?? 0) + 1)
      byQuestion.set(key, row)

      // One reply per question: the rest of your message is elaboration.
      pending = null
    }
  }

  return [...byQuestion.values()]
    .map((row) => {
      const hit = retrieve(row.question, 1)[0]
      return {
        question: row.question,
        people: row.people.size,
        count: row.count,
        replies: [...row.replies.entries()]
          .map(([text, count]) => ({ text, count }))
          .sort((a, b) => b.count - a.count),
        topEntry: hit?.entry.id ?? null,
        score: hit?.score ?? 0,
        intent: detectIntent(row.question),
      }
    })
    .sort((a, b) => b.people - a.people || b.count - a.count)
}

export type CannedReply = { text: string; people: number }

/**
 * The messages you send to many different people: your answers, already
 * written, in your own words. The most-reused of them is the material a
 * knowledge entry should be built from.
 */
export function cannedReplies(conversations: Conversation[], minLength = 60): CannedReply[] {
  const sent = new Map<string, { text: string; people: Set<string> }>()

  for (const convo of conversations) {
    for (const turn of convo.turns) {
      if (!turn.mine) continue
      const text = turn.text.trim()
      if (text.length < minLength) continue
      // Keyed on a prefix, so the same template counts as one however it ends.
      const key = text.toLowerCase().replace(/\s+/g, ' ').slice(0, 120)
      const row = sent.get(key) ?? { text, people: new Set<string>() }
      row.people.add(convo.who)
      sent.set(key, row)
    }
  }

  return [...sent.values()]
    .map((r) => ({ text: r.text, people: r.people.size }))
    .sort((a, b) => b.people - a.people)
}
