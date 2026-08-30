import { env } from '@/lib/env'
import type {
  AiProvider, Answer, CvFile, CvRead, DocumentRead, JobFields, PostDraft, Question,
} from './types'
import {
  templateProvider, writePostTemplate, answerQuestionTemplate, parseCvTemplate, verifyDocumentTemplate,
} from './providers/template'
import { geminiProvider } from './providers/gemini'

export type { AiProvider, Answer, CvFile, CvRead, DocumentRead, JobFields, PostDraft, Question }

/**
 * The ONLY place a model is called. Nothing else in the codebase imports a
 * model SDK — see CLAUDE.md.
 *
 * Default is the template provider, which uses no model at all. Real providers
 * (Gemini Flash free tier first) register here and must always degrade to the
 * template rather than fail: every AI step has to work without a model.
 */

const providers: Record<string, AiProvider> = {
  template: templateProvider,
  gemini: geminiProvider,
}

export function activeProviderName(): string {
  const name = env.aiProvider
  return name in providers ? name : 'template'
}

export function getProvider(): AiProvider {
  return providers[activeProviderName()]
}

/**
 * Write a job post. Never throws: a model that is down, rate-limited or
 * off its free tier falls back to the deterministic template, and the caller
 * gets a usable post either way.
 */
export async function writePost(fields: JobFields): Promise<PostDraft> {
  const provider = getProvider()
  if (provider.name === 'template') return writePostTemplate(fields)

  try {
    return await provider.writePost(fields)
  } catch (err) {
    console.error(`ai provider "${provider.name}" failed on writePost, using template`, err)
    return writePostTemplate(fields)
  }
}

// ---------------------------------------------------------------------------
// Reading a CV
// ---------------------------------------------------------------------------

/**
 * Read a CV. Never throws, and never on a path a stranger can reach.
 *
 * The cost rule in CLAUDE.md turns on that second clause. Answering a typed
 * question is the one model call anybody who finds the bot can set off, and it
 * is fenced accordingly. This one is not fenced, because it cannot be reached:
 * uploading a CV costs nothing and calls nothing, and the only caller is the
 * operator pressing a button on a profile he is already looking at. Somebody
 * who uploads fifty CVs has spent fifty rows of storage and no tokens at all.
 *
 * With no model the reading comes back empty, which is the state step 5 is
 * allowed to sit in indefinitely: the wizard's buttons already filled the
 * profile, so an unread CV is a file beside it rather than a gap in it.
 */
export async function parseCv(file: CvFile): Promise<CvRead> {
  const provider = getProvider()
  if (provider.name === 'template') return parseCvTemplate()

  try {
    return await provider.parseCv(file)
  } catch (err) {
    console.error(`ai provider "${provider.name}" failed on parseCv, reading nothing`, err)
    return parseCvTemplate()
  }
}

/**
 * Read one educational document. Never throws, operator-triggered like the CV.
 *
 * This shares step 5's budget rather than opening a new one. It is the same
 * act — reading what a tutor uploaded, on a button, on a profile the operator
 * already has open — and the fallback is the same: with no model the documents
 * are files he opens himself, exactly as they were.
 */
export async function verifyDocument(file: CvFile): Promise<DocumentRead> {
  const provider = getProvider()
  if (provider.name === 'template') return verifyDocumentTemplate()

  try {
    return await provider.verifyDocument(file)
  } catch (err) {
    console.error(`ai provider "${provider.name}" failed on verifyDocument, reading nothing`, err)
    return verifyDocumentTemplate()
  }
}

// ---------------------------------------------------------------------------
// Answering a tutor's typed question
// ---------------------------------------------------------------------------

/**
 * The model writes into a tutor's chat unsupervised, so what it produces is
 * checked rather than trusted. A prompt is a request; these are the guarantee.
 *
 * Any failure here is not an error to surface — it is a fall back to the
 * matched fact, verbatim. The tutor gets a blunter answer and never knows.
 */

/** Tutors and the bot are English only — see CLAUDE.md. */
const ETHIOPIC = /[ሀ-፿]/

/**
 * The non-negotiable rule, enforced on the model's own words: nothing may
 * suggest a human is on the other end of this chat.
 */
const PROMISES_A_HUMAN =
  /\b(?:we|i|someone|somebody|our team|an? (?:agent|operator|representative|staff))\b[^.!?]{0,40}\b(?:call|phone|ring|reply|respond|get back|be in touch|contact you|follow up)\b|\bcontact us\b|\breach out to us\b|\btalk to (?:a|an|our) (?:human|person|agent|operator|representative)\b|\bwe will let you know\b/i

/**
 * "I cannot call you" is the rule being kept, not broken — and on a question
 * that asks to be called it is the obvious thing to say, so matching the bare
 * shape threw away the model's best answers. A denial is checked for over the
 * whole sentence, because the negation can sit either side of the phrase:
 * "I cannot call you", "you cannot contact us".
 */
const DENIAL = /\b(?:not|never|no|none|nobody|cannot|unable)\b|n't\b/i

/** Sentence at a time, so a denial in one cannot excuse a promise in the next. */
function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/)
}

function promisesAHuman(text: string): boolean {
  return sentences(text).some((s) => PROMISES_A_HUMAN.test(s) && !DENIAL.test(s))
}

/** A model inventing a link is a phishing message the agency sent. */
const HAS_LINK = /https?:\/\/|www\.|t\.me\/|@[a-z0-9_]{4,}/i

/** Two short paragraphs. Longer than this and it is reciting, not answering. */
const MAX_LENGTH = 700

export type AnswerRejection =
  | 'not-english'
  | 'promises-a-human'
  | 'contains-link'
  | 'too-long'
  | 'empty'

/** Null when the text is safe to send. Exported so the tests can be specific. */
export function rejectAnswer(text: string): AnswerRejection | null {
  const trimmed = text.trim()
  if (!trimmed) return 'empty'
  if (trimmed.length > MAX_LENGTH) return 'too-long'
  if (ETHIOPIC.test(trimmed)) return 'not-english'
  if (HAS_LINK.test(trimmed)) return 'contains-link'
  if (promisesAHuman(trimmed)) return 'promises-a-human'
  return null
}

/**
 * Answer a tutor's question from the facts it was matched to. Never throws.
 *
 * `covered: false` means the facts did not answer it — the caller says so
 * plainly rather than inventing something, and never offers a person instead.
 */
export async function answerQuestion(question: Question): Promise<Answer> {
  const fallback = answerQuestionTemplate(question)
  const provider = getProvider()

  if (provider.name === 'template' || question.facts.length === 0) return fallback

  let answer: Answer
  try {
    answer = await provider.answerQuestion(question)
  } catch (err) {
    console.error(`ai provider "${provider.name}" failed on answerQuestion, using template`, err)
    return fallback
  }

  // Answered, but from no fact it can name. Asked "what if I want to stop
  // teaching", the model reached the entry about deleting your data — a fact
  // about a similar word, not about the question — and reported it covered, so
  // the gap looked answered instead of showing up as one to fill.
  if (answer.covered && answer.usedFactIds) {
    const known = new Set(question.facts.map((f) => f.id))
    const cited = answer.usedFactIds.filter((id) => known.has(id))
    if (cited.length === 0) {
      console.error(`ai provider "${provider.name}" answered citing no fact; treating as uncovered`)
      return { text: '', covered: false, generatedBy: answer.generatedBy }
    }
  }

  // The model read the facts and says they do not answer the question. Trust
  // it: keyword retrieval matches on words, not meaning, and its top hit for
  // "will I still be paid if the student stops coming" is the entry about
  // deleting your data. A wrong answer sent confidently is worse than none.
  //
  // This is deliberately not the same as the model failing — a rejected or
  // broken reply still falls back to the fact below, because there the
  // keyword match is the best judgement anyone made.
  if (!answer.covered) {
    return { text: '', covered: false, generatedBy: answer.generatedBy }
  }

  const rejection = rejectAnswer(answer.text)
  if (rejection) {
    console.error(`ai provider "${provider.name}" answer rejected: ${rejection}`)
    return fallback
  }

  return answer
}
