/**
 * What real conversations say about the answers we are missing.
 *
 * Pure: messages in, a report out. No I/O and no Telegram, so the export
 * reader and the live reader produce the same report from the same data, and
 * this can be tested without either.
 */
import { normalize, retrieve } from '@/lib/bot/answers/retrieve'

export type InboundMessage = {
  /** What they typed. */
  text: string
  /** Who said it — a chat name or id. Used to count people, not to identify them. */
  from: string
}

export type MinedQuestion = {
  text: string
  /** How many distinct people asked it. Weighted above raw count: one person
   *  asking five times is one problem, five people asking once is a pattern. */
  people: number
  count: number
  /** The entry retrieval would reach today, and how strongly. */
  topEntry: string | null
  score: number
}

export type Report = {
  total: number
  people: number
  /** People announcing they want the job. An intent, not a question. */
  wantsToApply: number
  /** People answering a list by position, with no idea which list. */
  picksFromAList: number
  /** Courtesies and bare agreement, counted and set aside. */
  courtesies: number
  /** Nothing matches: the entries to write. */
  uncovered: MinedQuestion[]
  /** Matches something, weakly. The dangerous bucket — a weak match is how
   *  "what if I want to stop teaching" reached the answer about deleting data. */
  weak: MinedQuestion[]
  covered: MinedQuestion[]
}

/** Below this a match is one incidental word — see MIN_SCORE in retrieve.ts. */
const CONFIDENT = 4

/**
 * What people say that is not a question. Courtesies and bare agreement are
 * most of what arrives: over a real export, "Thank you" and its variants came
 * from more people than any genuine question.
 *
 * Matched word by word rather than as whole phrases, because they stack —
 * "Okay Thank you", "Ok Thanks 🙏", "Eshi Thank you" — and a phrase list only
 * ever catches the spellings someone happened to think of.
 */
const COURTESY_WORDS = new Set([
  'ok', 'okay', 'oky', 'okey', 'k', 'yes', 'yeah', 'ya', 'yep', 'no', 'nope',
  'sure', 'fine', 'good', 'great', 'alright', 'thanks', 'thank', 'thankyou',
  'thx', 'tnx', 'welcome', 'hi', 'hello', 'hey', 'dear', 'sir', 'madam',
  'morning', 'afternoon', 'evening', 'night', 'problem', 'course', 'got',
  'noted', 'understood', 'same', 'too', 'please', 'sorry', 'np', 'well',
  'cool', 'nice', 'perfect', 'exactly', 'right', 'correct', 'bless', 'god',
  // Amharic in Latin script, as people actually type it
  'eshi', 'selam', 'nw', 'new', 'ameseginalehu', 'betam',
  // filler that carries no question on its own
  'i', 'you', 'it', 'its', 'is', 'was', 'am', 'are', 'do', 'did', 'does',
  'can', 'will', 'would', 'the', 'a', 'my', 'me', 'so', 'and', 'but', 'there',
  'how', 'much', 'very', 'brother', 'sister', 'bro', 'of', 'to', 'that', 'u',
  'not', 'really', 'deal', 'understand', 'lot', 'have', 'been',
  // normalize() turns an apostrophe into a space, so "It's" arrives as "it s".
  's', 'm', 't', 're', 'll', 've',
])

/**
 * The commonest message of all is somebody saying they want the job. That is
 * an intention to act, not a question to answer, and it needs a different
 * response from the bot — so it is counted separately rather than reported as
 * an answer nobody has written.
 */
const WANTS_TO_APPLY =
  /\bapply(?:ing)?\b|\binterested\b|\bi (?:want|wanna|need)\b.*\b(?:job|this|work|it)\b|\bi'?m in\b/i

/**
 * Someone choosing from a list you sent: "the first one", "this one", "I agree
 * with the first". Meaningless without the message it answers, which is what
 * makes it interesting — the bot has no memory of the previous turn.
 */
const PICKS_FROM_A_LIST =
  /\b(?:the\s+)?(?:first|second|third|last|1st|2nd|3rd)\s*(?:one|option|job|commission\w*)?\b|^(?:this|that)\s*(?:one)?\s*[🙏👍]*$/i

/** A question someone asked, not a command, a phone number, or a forwarded post. */
export function isWorthReading(body: string): boolean {
  const t = body.trim()
  if (t.length < 8 || t.length > 400) return false
  if (t.startsWith('/')) return false
  if (/^[\d\s+()-]+$/.test(t)) return false
  // A forwarded job post is a document, not something anyone is asking.
  if ((t.match(/\n/g) ?? []).length >= 3) return false
  return true
}

/** True when nothing in the message is more than politeness or agreement. */
export function isCourtesy(text: string): boolean {
  const words = normalize(text).split(' ').filter(Boolean)
  if (words.length === 0 || words.length > 6) return false
  return words.every((w) => COURTESY_WORDS.has(w))
}

export const wantsToApply = (t: string) => WANTS_TO_APPLY.test(t)
export const picksFromAList = (t: string) => PICKS_FROM_A_LIST.test(t.trim())

export function mine(messages: InboundMessage[]): Report {
  const asked = new Map<string, { text: string; count: number; people: Set<string> }>()
  const applying = new Set<string>()
  const picking = new Set<string>()
  let courtesies = 0

  for (const msg of messages) {
    const body = msg.text.trim()

    // Counted, then set aside: each of these needs a response from the bot,
    // but not one out of the knowledge base.
    if (wantsToApply(body)) { applying.add(msg.from); continue }
    if (picksFromAList(body)) { picking.add(msg.from); continue }
    if (isCourtesy(body)) { courtesies++; continue }

    if (!isWorthReading(body)) continue
    const key = normalize(body)
    if (!key) continue

    const seen = asked.get(key) ?? { text: body, count: 0, people: new Set<string>() }
    seen.count++
    seen.people.add(msg.from)
    asked.set(key, seen)
  }

  const rows: MinedQuestion[] = [...asked.values()].map((a) => {
    const hit = retrieve(a.text, 1)[0]
    return {
      text: a.text,
      people: a.people.size,
      count: a.count,
      topEntry: hit?.entry.id ?? null,
      score: hit?.score ?? 0,
    }
  })

  const byDemand = (a: MinedQuestion, b: MinedQuestion) => b.people - a.people || b.count - a.count

  return {
    total: rows.length,
    people: new Set(messages.map((m) => m.from)).size,
    wantsToApply: applying.size,
    picksFromAList: picking.size,
    courtesies,
    uncovered: rows.filter((r) => !r.topEntry).sort(byDemand),
    weak: rows.filter((r) => r.topEntry && r.score < CONFIDENT).sort(byDemand),
    covered: rows.filter((r) => r.topEntry && r.score >= CONFIDENT).sort(byDemand),
  }
}

export function printReport(report: Report, source: string): void {
  console.log(`\n${report.total} distinct questions from ${report.people} people · ${source}`)
  console.log(
    `set aside: ${report.wantsToApply} people want to apply · ` +
    `${report.picksFromAList} picked from a list · ${report.courtesies} courtesies\n`,
  )

  console.log(`── NOTHING COVERS THESE (${report.uncovered.length}) — the entries to write next\n`)
  for (const r of report.uncovered.slice(0, 40)) {
    console.log(`  ${String(r.people).padStart(3)} people  ${r.text.slice(0, 90)}`)
  }

  console.log(`\n── MATCHED, BUT WEAKLY (${report.weak.length}) — these reach an answer that may be the wrong one\n`)
  for (const r of report.weak.slice(0, 30)) {
    console.log(`  ${String(r.people).padStart(3)} people  ${r.text.slice(0, 60).padEnd(62)} → ${r.topEntry} (${r.score})`)
  }

  console.log(`\n── Already answered well: ${report.covered.length}\n`)
}
