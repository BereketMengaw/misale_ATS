/**
 * Turning what was logged into something a person can read. PURE — data in,
 * data out, no I/O, so it is unit tested.
 *
 * `message_log.payload` is whatever Telegram sent us, verbatim. That is the
 * right thing to store — it is the proof of what happened — and the wrong
 * thing to show: an inbound row is a whole Update object, and a button tap is
 * a callback string like `reg:subject:Mathematics`. Every one of those has to
 * become a line, because a transcript with holes in it is worse than no
 * transcript at all.
 */

export type Side = 'them' | 'bot' | 'operator'

/** The kind written on a line the operator typed himself. */
export const MANUAL_KIND = 'operator_manual'

export type LoggedMessage = {
  id: number
  direction: 'in' | 'out'
  kind: string | null
  payload: unknown
  operatorId: string | null
  createdAt: string
}

export type TranscriptLine = {
  /** Unique within a transcript. Negative ids belong to merged-in SMS. */
  id: number
  at: string
  side: Side
  /** What was said. Empty only when there were no words at all. */
  text: string
  /**
   * Set when the line is not typed words — a tap, a file, a shared contact.
   * Shown in place of a quotation, so a tap never looks like something
   * somebody wrote.
   */
  event: string | null
  /** 'telegram' for everything on the bot, 'sms' for a message sent by hand. */
  via: 'telegram' | 'sms'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function child(value: unknown, key: string): Record<string, unknown> | null {
  const rec = asRecord(value)
  return rec ? asRecord(rec[key]) : null
}

function str(value: unknown, key: string): string | null {
  const rec = asRecord(value)
  const v = rec?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/**
 * A callback string, in words.
 *
 * `reg:subject:Mathematics` is exact and unreadable; "Subject — Mathematics"
 * is the same fact. Deliberately generic rather than a lookup table of every
 * button: a table would go stale the day a button is renamed, and a stale
 * label is worse than a plain one. The raw string is kept in the log either
 * way, which is what an argument about what happened would be settled from.
 */
export function describeTap(data: string): string {
  const parts = data.split(':').filter(Boolean)
  if (parts.length === 0) return 'Tapped a button'

  const [head, ...rest] = parts
  const pretty = (s: string) => s.replace(/[_-]+/g, ' ').trim()

  // menu:jobs, edit:phone — one namespace, one thing.
  if (rest.length === 1) return `Tapped ${pretty(rest[0])}`
  // reg:subject:Mathematics — a wizard answer.
  if (rest.length >= 2) return `${cap(pretty(rest[0]))} — ${rest.slice(1).join(':')}`
  return `Tapped ${pretty(head)}`
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * What one logged row actually was. Returns null for an update carrying
 * nothing a reader would recognise — an edited-message notification, say —
 * so the transcript shows exchanges rather than protocol.
 */
export function readPayload(
  direction: 'in' | 'out',
  payload: unknown,
): { text: string; event: string | null } | null {
  if (direction === 'out') {
    const text = str(payload, 'text')
    if (text) return { text, event: null }
    // push_to_operator logs only who it was for; the body is on the queue row.
    const recipient = str(payload, 'recipient')
    if (recipient) return { text: '', event: `Pushed a message for ${recipient} to your phone` }
    return null
  }

  const callback = child(payload, 'callback_query')
  if (callback) {
    const data = str(callback, 'data')
    return { text: '', event: data ? describeTap(data) : 'Tapped a button' }
  }

  const message = child(payload, 'message')
  if (!message) return null

  const text = str(message, 'text')
  if (text) return { text, event: null }

  const caption = str(message, 'caption')

  if (asRecord(message.contact)) {
    return { text: caption ?? '', event: 'Shared their phone number' }
  }
  const document = asRecord(message.document)
  if (document) {
    const name = typeof document.file_name === 'string' ? document.file_name : 'a file'
    return { text: caption ?? '', event: `Sent ${name}` }
  }
  if (Array.isArray(message.photo)) {
    return { text: caption ?? '', event: 'Sent a photo' }
  }
  if (caption) return { text: caption, event: null }

  return null
}

/** Who said it. An operator id is the only thing that makes a line a person's. */
export function sideOf(row: Pick<LoggedMessage, 'direction' | 'kind' | 'operatorId'>): Side {
  if (row.direction === 'in') return 'them'
  return row.operatorId || row.kind === MANUAL_KIND ? 'operator' : 'bot'
}

/**
 * The whole exchange, oldest first.
 *
 * Rows that carry nothing readable are dropped rather than rendered blank:
 * eleven empty grey bubbles in a row is not a record of anything.
 */
export function toTranscript(rows: LoggedMessage[]): TranscriptLine[] {
  const lines: TranscriptLine[] = []

  for (const row of rows) {
    const read = readPayload(row.direction, row.payload)
    if (!read) continue
    if (!read.text && !read.event) continue

    lines.push({
      id: row.id,
      at: row.createdAt,
      side: sideOf(row),
      text: read.text,
      event: read.event,
      via: 'telegram',
    })
  }

  return lines.sort(byTime)
}

/**
 * A message the operator sent by hand, over SMS, outside the bot.
 *
 * A parent's transcript is a lie without these: for anyone who has not tapped
 * the connect link, the SMS queue is the ONLY place the agency has ever spoken
 * to them, and a page headed "everything we have said to this person" that
 * omits it is the wrong answer confidently given.
 */
export type SentSms = { id: number; body: string; sentAt: string }

export function withSms(lines: TranscriptLine[], sms: SentSms[]): TranscriptLine[] {
  const merged = [
    ...lines,
    // Negative, so an outbox id can never collide with a message_log id.
    ...sms.map((s) => ({
      id: -s.id,
      at: s.sentAt,
      side: 'operator' as const,
      text: s.body,
      event: null,
      via: 'sms' as const,
    })),
  ]
  return merged.sort(byTime)
}

function byTime(a: TranscriptLine, b: TranscriptLine): number {
  const diff = new Date(a.at).getTime() - new Date(b.at).getTime()
  return diff !== 0 ? diff : a.id - b.id
}

/** "3 days ago" — the only unit that matters when scanning a list. */
export function ago(from: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(from).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 31) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.round(months / 12)}y ago`
}
