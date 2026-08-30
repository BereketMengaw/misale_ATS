import { supabaseAdmin } from '@/lib/supabase/admin'
import { getSession, saveSession } from '@/lib/bot/session'
import { standingOf } from './standing'
import { activeProviderName, answerQuestion } from '@/lib/ai/provider'
import { actionFor, KNOWLEDGE, knowledgeFingerprint, type KnowledgeEntry } from './knowledge'
import { normalize, retrieve } from './retrieve'

/**
 * Answering a typed question: the I/O around the pure parts.
 *
 * The model runs on a free tier, so two things stand between a tutor's chat
 * and a bill: the same question is answered from the cache rather than asked
 * twice, and one person cannot ask more than a handful in an hour. Both
 * degrade to the matched fact, which is a real answer, not an error.
 */

/** Questions per person per hour before they get the verbatim fact instead. */
const HOURLY_LIMIT = 12

/** How long an answer stays reusable. Knowledge changes rarely; wording never. */
const CACHE_DAYS = 30

/**
 * A question we could not answer is cached far more briefly. Long enough to
 * blunt someone sending the same thing five times, short enough that adding
 * the missing entry to knowledge.ts takes effect the next day.
 */
const UNCOVERED_CACHE_HOURS = 24

/**
 * How long the last exchange stays relevant. Long enough that someone reading
 * an answer and typing "are you sure" is understood; short enough that
 * tomorrow's question is not resolved against yesterday's.
 */
const FOLLOW_UP_MINUTES = 30

/** Shorter than this is a greeting or a stray tap, not a question. */
const MIN_QUESTION_LENGTH = 6

/** Longer than this is a story. Truncate before it reaches a token counter. */
const MAX_QUESTION_LENGTH = 500

type Turn = { question: string; answer: string; factIds: string[]; at: string }

/** How many exchanges the bot keeps in mind. Enough to follow a thread, short
 *  enough that the prompt stays small and the oldest turn stays relevant. */
const THREAD_LENGTH = 4

/** The conversation so far, oldest first, while it is still recent enough to
 *  be what "it" refers to. */
async function recentThread(telegramId: number): Promise<Turn[]> {
  try {
    const session = await getSession(telegramId)
    const thread = session?.data?.thread as Turn[] | undefined
    if (!Array.isArray(thread) || thread.length === 0) return []
    const cutoff = Date.now() - FOLLOW_UP_MINUTES * 60 * 1000
    return thread.filter((t) => t?.question && t.at && new Date(t.at).getTime() >= cutoff)
  } catch (err) {
    console.error('could not read the thread', err)
    return []
  }
}

async function rememberTurn(
  telegramId: number,
  chatId: number,
  thread: Turn[],
  turn: Omit<Turn, 'at'>,
): Promise<void> {
  try {
    const next = [...thread, { ...turn, at: new Date().toISOString() }].slice(-THREAD_LENGTH)
    await saveSession(telegramId, chatId, { data: { thread: next } })
  } catch (err) {
    // Losing the memory costs context, never the answer.
    console.error('could not remember the turn', err)
  }
}

export type AnsweredQuestion = {
  text: string
  /** False when nothing in the knowledge base covered it. */
  covered: boolean
  /** Nearest topics, offered as buttons so a miss still leads somewhere. */
  related: KnowledgeEntry[]
  /**
   * The one button an answer earns: present only where the answer names an
   * exact next step, so it hands over the thing rather than describing it.
   */
  action: { label: string; callback: string } | null
  source: string
}

export function looksLikeAQuestion(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < MIN_QUESTION_LENGTH) return false
  // A command is a command, and a lone number is a phone number or a rate.
  if (trimmed.startsWith('/')) return false
  if (/^[\d\s+()-]+$/.test(trimmed)) return false
  return true
}

async function askedThisHour(telegramId: number): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error } = await supabaseAdmin()
    .from('bot_answers')
    .select('id', { count: 'exact', head: true })
    .eq('telegram_id', telegramId)
    .gte('created_at', since)

  if (error) {
    console.error('bot_answers rate check failed', error)
    return 0 // A broken count must not stop someone getting an answer.
  }
  return count ?? 0
}

async function cached(questionNorm: string): Promise<{ answer: string; covered: boolean } | null> {
  const oldest = new Date(Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin()
    .from('bot_answers')
    .select('answer, covered, created_at')
    .eq('question_norm', questionNorm)
    .gte('created_at', oldest)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('bot_answers cache read failed', error)
    return null
  }
  if (!data) return null

  if (!data.covered) {
    const cutoff = Date.now() - UNCOVERED_CACHE_HOURS * 60 * 60 * 1000
    if (new Date(data.created_at).getTime() < cutoff) return null
    return { answer: '', covered: false }
  }

  return data.answer ? { answer: data.answer, covered: true } : null
}

async function record(row: {
  telegramId: number
  chatId: number
  question: string
  questionNorm: string
  matchedIds: string[]
  covered: boolean
  answer: string
  source: string
}): Promise<void> {
  try {
    await supabaseAdmin().from('bot_answers').insert({
      telegram_id: row.telegramId,
      chat_id: row.chatId,
      question: row.question,
      question_norm: row.questionNorm,
      matched_ids: row.matchedIds,
      covered: row.covered,
      answer: row.answer,
      source: row.source,
    })
  } catch (err) {
    // Losing the log must never cost the tutor their answer.
    console.error('bot_answers insert failed', err)
  }
}

/**
 * The nearest topics to offer when an answer lands — or when none does.
 * A question the bot cannot answer still has to leave somewhere to go.
 */
function relatedTo(matched: KnowledgeEntry[]): KnowledgeEntry[] {
  if (matched.length > 0) return matched.slice(0, 3)
  return [
    KNOWLEDGE.find((e) => e.id === 'how-it-works'),
    KNOWLEDGE.find((e) => e.id === 'pay'),
    KNOWLEDGE.find((e) => e.id === 'hear-back'),
  ].filter((e): e is KnowledgeEntry => Boolean(e))
}

const asFact = (e: KnowledgeEntry) => ({ id: e.id, topic: e.topic, answer: e.answer })

export async function answerFor(
  telegramId: number,
  chatId: number,
  rawQuestion: string,
): Promise<AnsweredQuestion> {
  const question = rawQuestion.trim().slice(0, MAX_QUESTION_LENGTH)

  const matched = retrieve(question, 3).map((m) => m.entry)
  const related = relatedTo(matched)
  const hasModel = activeProviderName() !== 'template'
  const [thread, standing] = await Promise.all([recentThread(telegramId), standingOf(telegramId)])
  const previous = thread.length ? thread[thread.length - 1] : null

  // The cache key carries who was asking AND what the facts currently say.
  //
  // Standing, because the same words get a different answer depending on where
  // someone stands: keying on the question alone would serve a stranger the
  // reply written for somebody already teaching.
  //
  // The fingerprint, because a corrected fact must not go on being served from
  // a month-old row. Editing knowledge.ts used to change nothing for thirty
  // days — the bot kept telling tutors to tap "Register again" after that
  // button was removed. Now an edited fact simply stops matching its old rows.
  //
  // Nothing but the cache reads question_norm, so it can hold all three.
  const fingerprint = knowledgeFingerprint(matched.length ? matched : KNOWLEDGE)
  const questionNorm = `${normalize(question)}|${standing?.key ?? 'unknown'}|${fingerprint}`

  // "Are you sure?" retrieves nothing, because it is about whatever came
  // before it. Carry the last answer's facts rather than handing the model
  // everything and hoping, or telling them we have no answer.
  const carried =
    matched.length === 0 && previous
      ? previous.factIds.map((id) => KNOWLEDGE.find((e) => e.id === id)).filter(Boolean as unknown as (e: KnowledgeEntry | undefined) => e is KnowledgeEntry)
      : []

  // Taken from the matched fact, never from the model's words: the button has
  // to go somewhere real, and what came back is prose that may not mention it.
  const action = actionFor(matched)

  const finish = async (text: string, covered: boolean, source: string) => {
    await record({
      telegramId,
      chatId,
      question,
      questionNorm,
      matchedIds: matched.map((e) => e.id),
      covered,
      answer: text,
      source,
    })
    return { text, covered, related, action: covered ? action : null, source }
  }

  // Keywords found nothing. Without a model that is the end of it — there is
  // no fact to send. With one, hand it the whole knowledge base and let it
  // judge: keyword matching misses paraphrases ("can I teach two families at
  // once"), and reading eighteen short facts is exactly what it is good at.
  const wide = matched.length === 0 && carried.length === 0
  if (matched.length === 0 && carried.length === 0 && !hasModel) {
    return await finish('', false, 'unmatched')
  }

  // A follow-up is not cacheable: "are you sure" means something different
  // after every answer, so the same words must not reuse the same reply.
  if (!previous) {
    const hit = await cached(questionNorm)
    if (hit) return await finish(hit.answer, hit.covered, 'cache')
  }

  // Out of questions for the hour. The matched fact is still a real answer;
  // an unmatched one has nothing to degrade to, so it is left uncovered.
  if ((await askedThisHour(telegramId)) >= HOURLY_LIMIT) {
    return wide
      ? await finish('', false, 'rate-limited')
      : await finish(matched[0].answer, true, 'rate-limited')
  }

  const facts = wide ? KNOWLEDGE : matched.length ? matched : carried
  const answer = await answerQuestion({
    text: question,
    facts: facts.map(asFact),
    fallback: matched[0] ? asFact(matched[0]) : null,
    history: thread.map((t) => ({ question: t.question, answer: t.answer })),
    standing: standing?.text ?? null,
  })

  if (answer.covered && answer.text) {
    await rememberTurn(telegramId, chatId, thread, {
      question,
      answer: answer.text,
      factIds: answer.usedFactIds?.length ? answer.usedFactIds : facts.map((e) => e.id),
    })
  }

  const source = wide ? `${answer.generatedBy}:wide` : carried.length ? `${answer.generatedBy}:follow-up` : answer.generatedBy
  return await finish(answer.text, answer.covered, source)
}
