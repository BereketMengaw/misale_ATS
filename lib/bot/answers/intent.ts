/**
 * What someone means, before asking what they want to know.
 *
 * Measured over 2,163 real conversations: of 1,350 people who wrote in, 781
 * said they wanted to apply, 277 answered by position, and courtesies were the
 * commonest message of all. None of those is a question, and answering them
 * out of the knowledge base produced "I don't have an answer for that one" for
 * most of everything anyone ever sent.
 *
 * Pure — text in, intent out. `lib/mining/questions.ts` uses the same matchers,
 * so what the miner sets aside and what the bot routes cannot drift apart.
 */
import { normalize } from './retrieve'

export type Intent =
  /** "I want to apply", "I'm interested" — an intention to act. */
  | 'apply'
  /** "Is it still open?" — answerable from the live job list. */
  | 'job-status'
  /** "The first one" — a reply to a message the bot has no memory of. */
  | 'picks-from-a-list'
  /** "Okay thank you" — deserves a reply, not an answer. */
  | 'courtesy'
  | null

/**
 * Courtesies stack — "Okay Thank you", "Ok Thanks 🙏", "Eshi Thank you" — so
 * they are matched word by word. A phrase list only ever catches the spellings
 * someone happened to think of.
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

const WANTS_TO_APPLY =
  /\bapply(?:ing)?\b|\binterested\b|\bi (?:want|wanna|need)\b.*\b(?:job|this|work|it)\b|\bi'?m in\b/i

const PICKS_FROM_A_LIST =
  /\b(?:the\s+)?(?:first|second|third|last|1st|2nd|3rd)\s*(?:one|option|job|commission\w*)?\b|^(?:this|that)\s*(?:one)?\s*[🙏👍]*$/i

/** "Is it still open?", "any new jobs?" — about a posting, not about policy. */
const ASKS_IF_OPEN =
  /\b(?:still (?:available|open|there|on)|is (?:it|this) (?:available|open|closed|taken|filled)|already (?:taken|filled|closed)|anything new|any new (?:job|post)|new (?:job|post)s?\b)/i

export function isCourtesy(text: string): boolean {
  const words = normalize(text).split(' ').filter(Boolean)
  if (words.length === 0 || words.length > 6) return false
  return words.every((w) => COURTESY_WORDS.has(w))
}

export const wantsToApply = (t: string) => WANTS_TO_APPLY.test(t)
export const picksFromAList = (t: string) => PICKS_FROM_A_LIST.test(t.trim())
export const asksIfOpen = (t: string) => ASKS_IF_OPEN.test(t)

/**
 * Order matters. "Is this job still open, I want to apply" is somebody
 * applying; "the first one" is a list reply even though it is also short
 * enough to look like a courtesy.
 */
export function detectIntent(text: string): Intent {
  const t = text.trim()
  if (!t) return null
  if (wantsToApply(t)) return 'apply'
  if (asksIfOpen(t)) return 'job-status'
  if (picksFromAList(t)) return 'picks-from-a-list'
  if (isCourtesy(t)) return 'courtesy'
  return null
}
