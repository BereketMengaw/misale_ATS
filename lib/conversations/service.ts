import { GrammyError } from 'grammy'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getBot } from '@/lib/bot/bot'
import { logMessage } from '@/lib/bot/log'
import { checkManualMessage, type Audience } from './compose'
import {
  MANUAL_KIND,
  toTranscript,
  withSms,
  type LoggedMessage,
  type TranscriptLine,
} from './transcript'

/**
 * The inbox: reading what the bot and a person have said to each other, and
 * — only when the operator decides to — adding a line of his own.
 *
 * Nothing here creates work. There is no unread, no assignment, no queue; a
 * thread is a record, and the bot has already answered whatever was asked. See
 * the note at the top of supabase/migrations/0019_conversations.sql.
 */

/** Threads per page. The rest are reached by searching, as everywhere else. */
export const PAGE = 40

/**
 * How many people a `who` or search filter may resolve before it stops being
 * a filter and starts being a table scan. Comfortably above the number who
 * have ever opened the bot; the 716 imported tutors have no Telegram id and
 * so cannot have a thread at all.
 */
const MAX_FILTER_IDS = 2000

export type ThreadSummary = {
  telegramId: number
  chatId: number | null
  lastAt: string
  lastDirection: 'in' | 'out'
  lastText: string | null
  inboundCount: number
  outboundCount: number
  lastOperatorAt: string | null
  who: Audience
  name: string
  phone: string | null
  /** candidates.id or clients.id, for the link to their record. */
  personId: number | null
}

export type Person = {
  telegramId: number
  who: Audience
  name: string
  phone: string | null
  personId: number | null
}

type IdentityRow = { id: number; full_name: string | null; phone: string | null; telegram_id: number | null }

/**
 * Who these Telegram ids belong to. One round trip per side rather than one
 * per row: a forty-row page used to be forty lookups.
 */
async function identify(telegramIds: number[]): Promise<Map<number, Person>> {
  const found = new Map<number, Person>()
  if (telegramIds.length === 0) return found

  const db = supabaseAdmin()
  const [{ data: tutors }, { data: parents }] = await Promise.all([
    db.from('candidates').select('id, full_name, phone, telegram_id').in('telegram_id', telegramIds),
    db.from('clients').select('id, full_name, phone, telegram_id').in('telegram_id', telegramIds),
  ])

  // Parents second, so that in the vanishingly rare case of one person being
  // both, the money side wins — it is the one with an Amharic language rule.
  for (const row of (tutors ?? []) as IdentityRow[]) {
    if (row.telegram_id == null) continue
    found.set(Number(row.telegram_id), {
      telegramId: Number(row.telegram_id),
      who: 'tutor',
      name: row.full_name?.trim() || 'Unnamed tutor',
      phone: row.phone,
      personId: row.id,
    })
  }
  for (const row of (parents ?? []) as IdentityRow[]) {
    if (row.telegram_id == null) continue
    found.set(Number(row.telegram_id), {
      telegramId: Number(row.telegram_id),
      who: 'parent',
      name: row.full_name?.trim() || 'Unnamed parent',
      phone: row.phone,
      personId: row.id,
    })
  }

  return found
}

/** A stranger: they talked to the bot but match no record we hold. */
function unknownPerson(telegramId: number): Person {
  return { telegramId, who: 'unknown', name: `Telegram ${telegramId}`, phone: null, personId: null }
}

export async function whoIs(telegramId: number): Promise<Person> {
  const found = await identify([telegramId])
  return found.get(telegramId) ?? unknownPerson(telegramId)
}

/**
 * The Telegram ids a `who` or search filter narrows to, or null for "do not
 * narrow". Returning an empty array is a real answer — it means nobody
 * matched, and the caller must show nothing rather than everything.
 */
async function filterIds(who: string, needle: string): Promise<number[] | null> {
  if (who !== 'tutor' && who !== 'parent' && !needle) return null

  const db = supabaseAdmin()
  const escaped = needle.replace(/[%,()]/g, ' ').trim()
  const search = escaped ? `full_name.ilike.%${escaped}%,phone.ilike.%${escaped}%` : null

  const wantTutors = who !== 'parent'
  const wantParents = who !== 'tutor'

  const build = (table: 'candidates' | 'clients') => {
    let q = db.from(table).select('telegram_id').not('telegram_id', 'is', null)
    if (search) q = q.or(search)
    return q.limit(MAX_FILTER_IDS)
  }

  const [tutors, parents] = await Promise.all([
    wantTutors ? build('candidates') : Promise.resolve({ data: [] }),
    wantParents ? build('clients') : Promise.resolve({ data: [] }),
  ])

  const ids = new Set<number>()
  for (const row of [...(tutors.data ?? []), ...(parents.data ?? [])]) {
    if (row.telegram_id != null) ids.add(Number(row.telegram_id))
  }

  // Searching the raw id, so a thread with no matching record is still findable.
  if (/^\d{5,}$/.test(escaped)) ids.add(Number(escaped))

  return [...ids]
}

export type ThreadList = {
  threads: ThreadSummary[]
  total: number
  error: string | null
}

/**
 * @param theySpokeLast an ordinary filter the operator may choose, never a
 * default and never a badge. It answers "who have I not said anything to
 * since they wrote", which is a reasonable thing to want to browse — it is
 * not a list of people waiting, because the bot already answered every one
 * of them.
 */
export async function listThreads(opts: {
  q?: string
  who?: string
  theySpokeLast?: boolean
  page?: number
}): Promise<ThreadList> {
  const needle = (opts.q ?? '').trim()
  const who = opts.who ?? 'all'
  const page = Math.max(0, opts.page ?? 0)

  try {
    const ids = await filterIds(who, needle)
    if (ids && ids.length === 0) return { threads: [], total: 0, error: null }

    let query = supabaseAdmin()
      .from('conversations')
      .select(
        'telegram_id, chat_id, last_at, last_direction, last_text, inbound_count, outbound_count, last_operator_at',
        { count: 'exact' },
      )

    if (ids) query = query.in('telegram_id', ids)
    if (opts.theySpokeLast) query = query.eq('last_direction', 'in')

    const { data, error, count } = await query
      .order('last_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)

    if (error) return { threads: [], total: 0, error: error.message }

    const rows = data ?? []
    const people = await identify(rows.map((r) => Number(r.telegram_id)))

    const threads = rows.map((r): ThreadSummary => {
      const telegramId = Number(r.telegram_id)
      const person = people.get(telegramId) ?? unknownPerson(telegramId)
      return {
        ...person,
        chatId: r.chat_id == null ? null : Number(r.chat_id),
        lastAt: r.last_at as string,
        lastDirection: r.last_direction as 'in' | 'out',
        lastText: (r.last_text as string | null) ?? null,
        inboundCount: r.inbound_count as number,
        outboundCount: r.outbound_count as number,
        lastOperatorAt: (r.last_operator_at as string | null) ?? null,
      }
    })

    // A `who` filter narrowed by id set can still let a stranger through when
    // somebody's record was deleted after they messaged. Drop them here.
    const kept =
      who === 'tutor' || who === 'parent' ? threads.filter((t) => t.who === who) : threads

    return { threads: kept, total: count ?? kept.length, error: null }
  } catch (err) {
    return { threads: [], total: 0, error: err instanceof Error ? err.message : String(err) }
  }
}

export type Thread = {
  person: Person
  lines: TranscriptLine[]
  /** True when there is more history above what is shown. */
  truncated: boolean
  error: string | null
}

/** Messages loaded per thread. Long enough to be the whole story for nearly
 *  everyone, short enough that one chatty person cannot stall the page. */
const THREAD_LIMIT = 300

export async function loadThread(telegramId: number): Promise<Thread> {
  const db = supabaseAdmin()

  try {
    const person = await whoIs(telegramId)

    const { data, error } = await db
      .from('message_log')
      .select('id, direction, kind, payload, operator_id, created_at')
      .eq('telegram_id', telegramId)
      .order('created_at', { ascending: false })
      .limit(THREAD_LIMIT)

    if (error) return { person, lines: [], truncated: false, error: error.message }

    const rows = (data ?? []).map(
      (r): LoggedMessage => ({
        id: r.id as number,
        direction: r.direction as 'in' | 'out',
        kind: (r.kind as string | null) ?? null,
        payload: r.payload,
        operatorId: (r.operator_id as string | null) ?? null,
        createdAt: r.created_at as string,
      }),
    )

    let lines = toTranscript(rows)

    // What was sent to this parent by hand, over SMS. Without it, a parent who
    // never connected shows an empty page when in fact we have billed them
    // four times.
    if (person.who === 'parent' && person.personId) {
      const { data: sent } = await db
        .from('outbox')
        .select('id, body, sent_at')
        .eq('client_id', person.personId)
        .eq('status', 'sent')
        .not('sent_at', 'is', null)
        .order('sent_at', { ascending: false })
        .limit(THREAD_LIMIT)

      lines = withSms(
        lines,
        (sent ?? []).map((s) => ({
          id: s.id as number,
          body: s.body as string,
          sentAt: s.sent_at as string,
        })),
      )
    }

    return { person, lines, truncated: rows.length >= THREAD_LIMIT, error: null }
  } catch (err) {
    return {
      person: unknownPerson(telegramId),
      lines: [],
      truncated: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export type SendResult = { ok: true } | { ok: false; error: string }

/**
 * One line, typed by the operator, sent as itself.
 *
 * Sent through the same bot account the person already knows, because a second
 * number arriving out of nowhere is how a message gets ignored. It is logged
 * with his id on it, so the transcript can tell his words from the bot's — the
 * one distinction that would otherwise be lost forever.
 */
export async function sendManual(args: {
  operatorId: string
  telegramId: number
  text: string
}): Promise<SendResult> {
  const text = args.text.trim()
  const person = await whoIs(args.telegramId)

  const problem = checkManualMessage(person.who, text)
  if (problem) return { ok: false, error: problem.message }

  try {
    const bot = await getBot()
    await bot.api.sendMessage(args.telegramId, text, {
      link_preview_options: { is_disabled: true },
    })
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof GrammyError
          ? `Telegram refused it: ${err.description}`
          : err instanceof Error
            ? err.message
            : String(err),
    }
  }

  await logMessage({
    direction: 'out',
    telegramId: args.telegramId,
    chatId: args.telegramId,
    kind: MANUAL_KIND,
    payload: { text },
    operatorId: args.operatorId,
  })

  return { ok: true }
}
