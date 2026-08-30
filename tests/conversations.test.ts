import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ago,
  describeTap,
  MANUAL_KIND,
  readPayload,
  sideOf,
  toTranscript,
  withSms,
  type LoggedMessage,
} from '@/lib/conversations/transcript'
import { checkManualMessage, MAX_MANUAL_LENGTH } from '@/lib/conversations/compose'

const at = (n: number) => new Date(Date.UTC(2026, 0, 1, 12, n)).toISOString()

function row(partial: Partial<LoggedMessage> & Pick<LoggedMessage, 'direction' | 'payload'>): LoggedMessage {
  return { id: 1, kind: null, operatorId: null, createdAt: at(0), ...partial }
}

describe('reading a logged payload', () => {
  it('reads a typed message', () => {
    expect(readPayload('in', { message: { text: ' how much is the pay ' } })).toEqual({
      text: 'how much is the pay',
      event: null,
    })
  })

  it('reads what the bot sent', () => {
    expect(readPayload('out', { text: 'Tutors keep 80%.' })).toEqual({
      text: 'Tutors keep 80%.',
      event: null,
    })
  })

  // A tap is not something somebody wrote, and must never be shown as if it were.
  it('turns a button tap into words, with no quoted text', () => {
    const read = readPayload('in', { callback_query: { data: 'reg:subject:Mathematics' } })
    expect(read).toEqual({ text: '', event: 'Subject — Mathematics' })
  })

  it('names a shared contact, a file and a photo', () => {
    expect(readPayload('in', { message: { contact: { phone_number: '+251911' } } })?.event)
      .toBe('Shared their phone number')
    expect(readPayload('in', { message: { document: { file_name: 'abebe-cv.pdf' } } })?.event)
      .toBe('Sent abebe-cv.pdf')
    expect(readPayload('in', { message: { photo: [{ file_id: 'x' }] } })?.event).toBe('Sent a photo')
  })

  it('keeps a caption sent with a file', () => {
    const read = readPayload('in', { message: { document: { file_name: 'cv.pdf' }, caption: 'my CV' } })
    expect(read).toEqual({ text: 'my CV', event: 'Sent cv.pdf' })
  })

  it('says what a push to the operator was, since the body is not in the log', () => {
    expect(readPayload('out', { recipient: 'Almaz' })).toEqual({
      text: '',
      event: 'Pushed a message for Almaz to your phone',
    })
  })

  // Protocol noise. Rendering it as an empty bubble is worse than dropping it.
  it('returns nothing for an update carrying nothing readable', () => {
    expect(readPayload('in', { edited_message: { text: 'x' } })).toBeNull()
    expect(readPayload('in', {})).toBeNull()
    expect(readPayload('out', {})).toBeNull()
    expect(readPayload('in', null)).toBeNull()
    expect(readPayload('in', 'not an object')).toBeNull()
  })
})

describe('describing a tap', () => {
  it('reads a one-part callback as an action', () => {
    expect(describeTap('menu:jobs')).toBe('Tapped jobs')
    expect(describeTap('edit:phone')).toBe('Tapped phone')
  })

  it('reads a wizard answer as a field and a value', () => {
    expect(describeTap('reg:grade:Grade 9')).toBe('Grade — Grade 9')
    expect(describeTap('comm:41:yes')).toBe('41 — yes')
  })

  it('never returns an empty label', () => {
    for (const data of ['', ':', 'apply', 'a:b:c:d']) {
      expect(describeTap(data).trim()).not.toBe('')
    }
  })
})

/**
 * The distinction the whole feature turns on: a line the operator typed must
 * never be mistaken for something the bot asserted from knowledge.ts.
 */
describe('who said it', () => {
  it('is them for anything inbound', () => {
    expect(sideOf({ direction: 'in', kind: 'message', operatorId: null })).toBe('them')
  })

  it('is the bot for an ordinary reply', () => {
    expect(sideOf({ direction: 'out', kind: 'reply', operatorId: null })).toBe('bot')
  })

  it('is the operator when a person is on it', () => {
    expect(sideOf({ direction: 'out', kind: MANUAL_KIND, operatorId: null })).toBe('operator')
    expect(sideOf({ direction: 'out', kind: 'reply', operatorId: 'uuid' })).toBe('operator')
  })
})

describe('a transcript', () => {
  it('is oldest first, whatever order the rows arrived in', () => {
    const lines = toTranscript([
      row({ id: 3, direction: 'out', payload: { text: 'third' }, createdAt: at(3) }),
      row({ id: 1, direction: 'in', payload: { message: { text: 'first' } }, createdAt: at(1) }),
      row({ id: 2, direction: 'out', payload: { text: 'second' }, createdAt: at(2) }),
    ])
    expect(lines.map((l) => l.text)).toEqual(['first', 'second', 'third'])
  })

  it('drops rows with nothing to show rather than rendering them blank', () => {
    const lines = toTranscript([
      row({ id: 1, direction: 'in', payload: { message: { text: 'hello' } } }),
      row({ id: 2, direction: 'in', payload: { edited_message: {} }, createdAt: at(1) }),
    ])
    expect(lines).toHaveLength(1)
  })

  it('marks everything on the bot as telegram', () => {
    const lines = toTranscript([row({ direction: 'in', payload: { message: { text: 'hi' } } })])
    expect(lines[0].via).toBe('telegram')
  })
})

/**
 * A parent who never tapped the connect link has been billed by SMS and by
 * nothing else. A transcript that omitted that would be an empty page about
 * somebody we have written to four times.
 */
describe('merging in what was sent by SMS', () => {
  const lines = toTranscript([
    row({ id: 7, direction: 'out', payload: { text: 'on telegram' }, createdAt: at(5) }),
  ])
  const merged = withSms(lines, [{ id: 7, body: 'by sms', sentAt: at(1) }])

  it('interleaves by time, not by source', () => {
    expect(merged.map((l) => l.text)).toEqual(['by sms', 'on telegram'])
  })

  it('attributes an SMS to the operator, because he sent it himself', () => {
    expect(merged[0].side).toBe('operator')
    expect(merged[0].via).toBe('sms')
  })

  // An outbox id and a message_log id are both small integers from different
  // tables; colliding keys would drop a line from the page.
  it('cannot collide with a message_log id', () => {
    expect(merged[0].id).toBe(-7)
    expect(merged[1].id).toBe(7)
  })
})

describe('ago', () => {
  const now = new Date('2026-01-10T12:00:00Z')
  it('reads in the largest unit that still means something', () => {
    expect(ago('2026-01-10T11:59:30Z', now)).toBe('just now')
    expect(ago('2026-01-10T11:30:00Z', now)).toBe('30m ago')
    expect(ago('2026-01-10T06:00:00Z', now)).toBe('6h ago')
    expect(ago('2026-01-05T12:00:00Z', now)).toBe('5d ago')
    expect(ago('2025-10-10T12:00:00Z', now)).toBe('3mo ago')
    expect(ago('2024-01-10T12:00:00Z', now)).toBe('2y ago')
  })

  it('never reads as the future when a clock is slightly off', () => {
    expect(ago('2026-01-10T12:00:30Z', now)).toBe('just now')
  })
})

/**
 * CLAUDE.md: families are written to in Amharic, tutors and the bot in
 * English. The pre-written messages are held to that by their own tests. A
 * line typed into a box at nine at night is in no file, so it is checked here
 * instead — before it is sent, on the server, not only in the browser.
 */
describe('what may be sent by hand', () => {
  it('refuses nothing', () => {
    expect(checkManualMessage('tutor', '   ')?.code).toBe('empty')
  })

  it('refuses more than Telegram will take', () => {
    expect(checkManualMessage('tutor', 'a'.repeat(MAX_MANUAL_LENGTH + 1))?.code).toBe('too_long')
  })

  it('refuses English to a family', () => {
    expect(checkManualMessage('parent', 'Your invoice is due on Friday.')?.code).toBe('not_amharic')
  })

  it('accepts Amharic to a family', () => {
    expect(checkManualMessage('parent', 'ሰላም፣ ክፍያው አርብ ይደርሳል።')).toBeNull()
  })

  it('refuses Amharic to a tutor', () => {
    expect(checkManualMessage('tutor', 'ሰላም እንዴት ናችሁ')?.code).toBe('not_english')
  })

  it('accepts English to a tutor', () => {
    expect(checkManualMessage('tutor', 'Your first lesson is on Monday at 4pm.')).toBeNull()
  })

  // An English sentence quoting an Amharic name is still an English message.
  it('lets an English message carry an Amharic name', () => {
    expect(checkManualMessage('tutor', 'The family is ሚሳሌ — they will call you.')).toBeNull()
  })

  // A stranger is standing in an English bot; answering in Amharic would be
  // the odder of the two guesses.
  it('treats somebody we hold no record of as English', () => {
    expect(checkManualMessage('unknown', 'Tap Register to get started.')).toBeNull()
    expect(checkManualMessage('unknown', 'ሰላም እንዴት ናችሁ')?.code).toBe('not_english')
  })
})

/**
 * The fence.
 *
 * CLAUDE.md: the operator never holds a conversation, and nothing routes a
 * message at him expecting a reply. Reading a transcript does not break that
 * and neither does choosing to send a line. What WOULD break it is the inbox
 * quietly turning into a queue — a count beside the nav item, a row on Today,
 * an unread flag — because then a person typing at midnight becomes work with
 * his name on it. Each of those is one small commit away, so each is asserted
 * against here rather than left to memory.
 */
describe('the inbox is a record, not a queue', () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

  it('never reaches Today, which is the list of things waiting on him', () => {
    const today = read('lib/dashboard/today.ts')
    expect(today).not.toMatch(/conversations|\binbox\b/i)
  })

  it('carries no badge in the nav — only Today does', () => {
    const nav = read('app/(dash)/nav.tsx')
    const badge = nav.slice(nav.indexOf('waiting > 0'))
    expect(nav).toMatch(/label === 'Today' && waiting > 0/)
    expect(badge).not.toMatch(/Inbox/)
  })

  it('has no unread, assigned or awaiting-reply state to put a message in', () => {
    const migration = read('supabase/migrations/0019_conversations.sql')
    const table = migration.slice(
      migration.indexOf('create table if not exists conversations'),
      migration.indexOf('create index if not exists conversations_last_at_idx'),
    )
    expect(table).not.toMatch(/unread|assigned|awaiting|handled|resolved|needs_reply/i)
  })

  it('offers no way to escalate a thread to a person from the bot', () => {
    const copy = read('lib/bot/copy.ts')
    expect(copy).not.toMatch(/talk to (a|the) (human|person|agent)|speak to someone/i)
  })
})
