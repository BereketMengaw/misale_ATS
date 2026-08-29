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
}

export type PostDraft = {
  body: string
  /** Which provider produced this, recorded on the row so it is auditable. */
  generatedBy: string
}

export interface AiProvider {
  readonly name: string
  writePost(fields: JobFields): Promise<PostDraft>
  // parseCV lands at step 5, parseSMS at step 11.
}
