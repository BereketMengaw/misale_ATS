import type { AiProvider, Answer, JobFields, PostDraft, Question } from '../types'
import { formatEtb, split, toCents } from '@/lib/money/commission'
import { ALL_SUBJECTS } from '@/lib/candidates/options'

/**
 * The no-model provider, and the fallback for every other one.
 * Pure: fields in, text out. No I/O, no network, no cost.
 */

const RATE_LABEL: Record<JobFields['ratePeriod'], string> = {
  per_hour: 'per hour',
  per_session: 'per session',
  per_month: 'per month',
}

const GENDER_LABEL: Record<JobFields['genderPref'], string | null> = {
  any: null,
  female: 'Female tutor',
  male: 'Male tutor',
}

/** 4500 → "4,500". Birr amounts get read aloud over the phone; grouping helps. */
function money(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

function humanDate(iso?: string | null): string | null {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function line(label: string, value: string | null): string | null {
  return value ? `${label} ${value}` : null
}

/**
 * The channel post is read by tutors, so it advertises what a TUTOR receives —
 * the rate the operator entered is what the PARENT pays, and the commission
 * comes out of it. Advertising the parent's number and revealing the smaller
 * one at the commission step would read as bait.
 */
function payLine(fields: JobFields): string {
  const percent = fields.commissionPercent
  if (percent == null || percent <= 0) return money(fields.rateAmount)
  return formatEtb(split(fields.rateAmount, percent).netCents)
}

export function writePostTemplate(fields: JobFields): PostDraft {
  const hours = fields.hoursPerSession
  const notes = fields.notes?.trim() || null

  // Most posts are for a grade, not a subject. "Tutor needed — All subjects"
  // buries the one thing a reader is scanning for, so the grade leads and the
  // Grade line goes, rather than saying it twice.
  const everySubject = fields.subject.trim().toLowerCase() === ALL_SUBJECTS.toLowerCase()

  const body = [
    everySubject
      ? `📚 Tutor needed — ${fields.grade}, all subjects`
      : `📚 Tutor needed — ${fields.subject}`,
    '',
    everySubject ? null : line('Grade:', fields.grade),
    line('Area:', fields.area),
    line('Days per week:', String(fields.daysPerWeek)),
    hours ? line('Per session:', `${hours} hour${hours === 1 ? '' : 's'}`) : null,
    line('Pay:', `${payLine(fields)} ETB ${RATE_LABEL[fields.ratePeriod]}`),
    line('Preferred:', GENDER_LABEL[fields.genderPref]),
    line('Starts:', humanDate(fields.startsOn)),
    '',
    notes,
    notes ? '' : null,
    'Tap the button below to apply.',
  ]
    .filter((l): l is string => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { body, generatedBy: 'template' }
}

/**
 * The no-model answer: the best-matching fact, sent word for word.
 *
 * This is both the answer when no model is configured and the fallback for
 * every model that fails, is rate-limited, or replies with something the
 * guards in provider.ts reject. It is never wrong, only sometimes blunt.
 */
export function answerQuestionTemplate(question: Question): Answer {
  const best = question.fallback
  if (!best) return { text: '', covered: false, generatedBy: 'template' }
  return { text: best.answer, covered: true, generatedBy: 'template' }
}

export const templateProvider: AiProvider = {
  name: 'template',
  async writePost(fields: JobFields): Promise<PostDraft> {
    return writePostTemplate(fields)
  },
  async answerQuestion(question: Question): Promise<Answer> {
    return answerQuestionTemplate(question)
  },
}
