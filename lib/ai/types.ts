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
  /**
   * The conversation so far, oldest first. Without it "are you sure", "what
   * about this" and "and when exactly" are unanswerable — and they are a large
   * share of what people actually send. The bot answered them anyway, from
   * whatever the words happened to match.
   */
  history?: { question: string; answer: string }[]
  /**
   * Where this person stands, read from the database — registered, applied,
   * shortlisted, hired. Context for the answer, never a fact to quote.
   */
  standing?: string | null
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

// ---------------------------------------------------------------------------
// Reading a CV
// ---------------------------------------------------------------------------

/**
 * A CV as it sits in storage. Bytes rather than text: the decision in
 * `docs/06-decisions.md` is that the model reads photos and PDFs natively, so
 * there is no OCR pipeline and no extractor to keep working.
 */
export type CvFile = {
  bytes: ArrayBuffer
  mime: string
  name?: string | null
}

/**
 * What a provider claims a CV says, before anything believes it.
 *
 * Every field is loose on purpose — a string where the profile holds an enum, a
 * number of years where the profile holds a band. Turning this into values the
 * ranker can use is `lib/candidates/cv.ts`'s job, where it is pure and tested,
 * because a prompt asking for an enum is a request and normalising is the
 * guarantee. A provider that invents a subject simply loses it there.
 */
export type RawCv = {
  fullName?: string | null
  phone?: string | null
  /** Free text: "BSc in Applied Physics", "MSc student". */
  education?: string | null
  institution?: string | null
  /** Whatever the address says; the sub-city is picked out of it. */
  area?: string | null
  /** Years of teaching or tutoring, as a number. Bands are derived. */
  experienceYears?: number | null
  subjects?: string[] | null
  /** However the CV writes them: "grades 9-12", "high school", "university". */
  grades?: string[] | null
}

export type CvRead = {
  /** False when no model ran, or nothing usable came back. Never an error. */
  read: boolean
  raw: RawCv
  /** Provider name, or 'template'. Recorded on the row so it is auditable. */
  generatedBy: string
}

export interface AiProvider {
  readonly name: string
  writePost(fields: JobFields): Promise<PostDraft>
  answerQuestion(question: Question): Promise<Answer>
  parseCv(file: CvFile): Promise<CvRead>
  // parseSMS lands at step 11.
}
