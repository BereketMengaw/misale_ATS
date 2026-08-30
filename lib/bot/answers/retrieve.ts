import { KNOWLEDGE, type KnowledgeEntry } from './knowledge'

/**
 * Which facts a typed question is about. Pure — text in, entries out, no I/O
 * and no model. This runs on every question, including the ones the model
 * answers: it is what the model is allowed to read.
 *
 * Deliberately dumb. A tutor FAQ is a small, repetitive question space, and a
 * scorer that can be read in one sitting is one whose wrong answers can be
 * fixed by editing a keyword list.
 */

/** Words too common to say anything about which topic a question is on. */
const STOP = new Set([
  'a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'do', 'does',
  'did', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'but', 'if', 'it',
  'this', 'that', 'my', 'me', 'i', 'you', 'your', 'we', 'us', 'they', 'them',
  'can', 'will', 'would', 'should', 'have', 'has', 'had', 'get', 'got', 'there',
  'please', 'hello', 'hi', 'thanks', 'thank', 'sir', 'madam', 'ok', 'okay',
])

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Crude singular. "jobs" and "job" must not be different topics. */
function stem(word: string): string {
  if (word.length > 3 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
  // Only a real -es plural loses both letters: "boxes", "classes", "matches".
  // Stripping "es" from every word turned "times" into "tim" and, worse,
  // "fees" into "fe" — so nobody asking about fees ever reached that answer.
  if (word.length > 4 && /(?:s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2)
  if (word.length > 2 && word.endsWith('s')) return word.slice(0, -1)
  return word
}

/** The question with every word stemmed, stop words kept, for phrase matching. */
function stemAll(text: string): string {
  return normalize(text).split(' ').filter(Boolean).map(stem).join(' ')
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((w) => w && !STOP.has(w))
    .map(stem)
}

export type Match = {
  entry: KnowledgeEntry
  score: number
}

/**
 * A phrase that appears whole beats any single word: "how much" in "how much
 * do you pay" should outrank the bare "how".
 *
 * Scored by its length, because a long phrase is a more specific claim on a
 * question than a short one. Flat scoring let "how long" (the wait) beat
 * "how long to register" on a question about registering.
 */
function phrasePoints(phrase: string): number {
  return 2 * phrase.split(' ').length
}

/**
 * How many entries each single word belongs to. A word that points at exactly
 * one topic ("scam", "commission", "cv") is strong evidence on its own; one
 * shared by five ("job", "pay", "how") is barely evidence at all. Computed
 * once from the knowledge base rather than tuned by hand, so adding an entry
 * re-weights the words it shares without anyone remembering to.
 */
const SPREAD: Map<string, number> = (() => {
  const spread = new Map<string, number>()
  for (const entry of KNOWLEDGE) {
    const own = new Set(
      entry.keywords.filter((k) => !k.includes(' ')).map(stem),
    )
    for (const word of own) spread.set(word, (spread.get(word) ?? 0) + 1)
  }
  return spread
})()

function wordPoints(word: string): number {
  const spread = SPREAD.get(word) ?? 1
  if (spread === 1) return 3
  if (spread === 2) return 2
  return 1
}

function scoreEntry(entry: KnowledgeEntry, question: string, asked: Set<string>): number {
  // Stemmed on both sides, so the keyword "lesson time" still claims someone
  // asking about their "lesson times".
  const flat = ` ${stemAll(question)} `
  let score = 0

  for (const keyword of entry.keywords) {
    if (keyword.includes(' ')) {
      if (flat.includes(` ${stemAll(keyword)} `)) score += phrasePoints(keyword)
      continue
    }
    const word = stem(keyword)
    if (asked.has(word)) score += wordPoints(word)
  }

  return score
}

/**
 * Below this a "match" is one word that several topics share, which is worse
 * than admitting the question is not covered.
 */
export const MIN_SCORE = 2

/**
 * Every entry the question touches at all, best first. Unfiltered.
 *
 * Not short-circuited when the question is all stop words: "did i get it?" has
 * nothing left after stripping, but it is still a phrase a topic claims.
 */
export function scoreAll(question: string): Match[] {
  if (!normalize(question)) return []
  const asked = new Set(tokens(question))

  return KNOWLEDGE.map((entry) => ({ entry, score: scoreEntry(entry, question, asked) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
}

export function retrieve(question: string, limit = 3): Match[] {
  return scoreAll(question)
    .filter((m) => m.score >= MIN_SCORE)
    .slice(0, limit)
}

/** The no-model answer: the best entry, verbatim. Null when nothing is close. */
export function bestAnswer(question: string): KnowledgeEntry | null {
  return retrieve(question, 1)[0]?.entry ?? null
}
