/** The fields the operator answers. Everything a post is written from. */
export type JobFields = {
  subject: string
  grade: string
  area: string
  daysPerWeek: number
  hoursPerSession?: number | null
  rateAmount: number
  ratePeriod: 'per_hour' | 'per_session' | 'per_month'
  genderPref: 'any' | 'female' | 'male'
  startsOn?: string | null
  notes?: string | null
  /** The agency's share, taken out of the advertised rate. */
  commissionPercent?: number | null
}

export type PostDraft = {
  body: string
  /** Which provider produced this, recorded on the row so it is auditable. */
  generatedBy: string
}

export type Fact = { id: string; topic: string; answer: string }

/**
 * A tutor's typed question, plus the only facts an answer may be built from.
 *
 * `facts` is not context to be improved on — it is the whole permitted world.
 * A provider that asserts anything outside it is a bug, and `provider.ts`
 * checks the reply before it is sent.
 *
 * `fallback` is what gets sent when there is no model, or when the model's
 * reply is rejected. It is separate from `facts` because the two differ: when
 * keyword retrieval finds nothing we hand the model everything and let it
 * decide, but there is no fact to fall back to, and a plain "I don't know"
 * beats an answer to a question nobody asked.
 */
export type Question = {
  text: string
  facts: Fact[]
  fallback: Fact | null
}

export type Answer = {
  text: string
  /** False when the facts did not cover the question; the bot then says so. */
  covered: boolean
  /**
   * Which facts the answer was actually built from. A provider that claims to
   * have answered but names no fact has written something from nothing, which
   * `provider.ts` treats as not covered.
   */
  usedFactIds?: string[]
  /** Provider name, or 'template'. Recorded on the row so it is auditable. */
  generatedBy: string
}

export interface AiProvider {
  readonly name: string
  writePost(fields: JobFields): Promise<PostDraft>
  answerQuestion(question: Question): Promise<Answer>
  // parseCV lands at step 5, parseSMS at step 11.
}
