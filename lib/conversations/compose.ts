/**
 * What the operator is allowed to send by hand. PURE, and checked on the
 * server before anything leaves — a prompt is a request and a check is a
 * guarantee, the same reasoning as rejectAnswer() in lib/ai/provider.ts.
 *
 * The language rule in CLAUDE.md holds for every message the agency sends,
 * not only the ones a test can reach. `tests/parent-messages.test.ts` can fail
 * the build over `lib/messaging/parent.ts` because that file is written ahead
 * of time; a line typed into a box at nine at night is not in any file. So it
 * is checked at the moment of sending instead.
 *
 * An English SMS to a parent is not a small slip. It is the agency's voice
 * arriving in the wrong language from an unknown number, which is exactly the
 * message a family ignores.
 */

/** Telegram refuses anything over 4096; stop short of it with a real message. */
export const MAX_MANUAL_LENGTH = 3500

export type Audience = 'tutor' | 'parent' | 'unknown'

export type ComposeProblem = { code: string; message: string }

const ETHIOPIC = /[ሀ-፿]/
/** Latin letters, ignoring the odd name or account number a line may carry. */
const LATIN_WORD = /[A-Za-z]{3,}/

export function hasEthiopic(text: string): boolean {
  return ETHIOPIC.test(text)
}

/**
 * Returns the reason this must not be sent, or null.
 *
 * `unknown` — somebody who talked to the bot and is neither a registered tutor
 * nor a client — is checked as a tutor, because the bot they are standing in
 * is English and answering them in Amharic would be the odder of the two.
 */
export function checkManualMessage(audience: Audience, raw: string): ComposeProblem | null {
  const text = raw.trim()

  if (!text) {
    return { code: 'empty', message: 'Nothing to send.' }
  }
  if (text.length > MAX_MANUAL_LENGTH) {
    return {
      code: 'too_long',
      message: `That is ${text.length} characters. Telegram takes ${MAX_MANUAL_LENGTH}.`,
    }
  }

  if (audience === 'parent' && !hasEthiopic(text)) {
    return {
      code: 'not_amharic',
      message: 'Families are written to in Amharic. This has no Amharic in it.',
    }
  }

  if (audience !== 'parent' && hasEthiopic(text) && !LATIN_WORD.test(text)) {
    return {
      code: 'not_english',
      message: 'Tutors and the bot are English only. This is in Amharic.',
    }
  }

  return null
}
