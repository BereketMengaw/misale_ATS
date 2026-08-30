/**
 * What real conversations say about the answers we are missing.
 *
 * Pure: messages in, a report out. No I/O and no Telegram, so the export
 * reader and the live reader produce the same report from the same data, and
 * this can be tested without either.
 */
import { normalize, retrieve } from '@/lib/bot/answers/retrieve'
// The bot routes on these same matchers, so what the miner sets aside and what
// the bot acts on cannot drift apart.
import { isCourtesy, picksFromAList, wantsToApply } from '@/lib/bot/answers/intent'

export { isCourtesy, picksFromAList, wantsToApply }

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
