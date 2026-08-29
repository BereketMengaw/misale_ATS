import type { JobFields, PostDraft } from '../types'

/**
 * The no-model provider, and the fallback for every other one.
 * Pure: fields in, text out. No I/O, no network, no cost.
 *
 * Amharic and English are written separately. Neither is a translation of the
 * other's sentence structure.
 */

const RATE_AM: Record<JobFields['ratePeriod'], string> = {
  per_hour: 'በሰዓት',
  per_session: 'በክፍለ ጊዜ',
  per_month: 'በወር',
}

const RATE_EN: Record<JobFields['ratePeriod'], string> = {
  per_hour: 'per hour',
  per_session: 'per session',
  per_month: 'per month',
}

const GENDER_AM: Record<JobFields['genderPref'], string | null> = {
  any: null,
  female: 'ሴት አስተማሪ',
  male: 'ወንድ አስተማሪ',
}

const GENDER_EN: Record<JobFields['genderPref'], string | null> = {
  any: null,
  female: 'Female tutor',
  male: 'Male tutor',
}

/** 4500 → "4,500". Birr amounts are read aloud over the phone; grouping helps. */
function money(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

/** Gregorian months as Ethiopian media writes them in Amharic script. */
const MONTHS_AM = [
  'ጃንዩወሪ', 'ፌብሩወሪ', 'ማርች', 'ኤፕሪል', 'ሜይ', 'ጁን',
  'ጁላይ', 'ኦገስት', 'ሴፕቴምበር', 'ኦክቶበር', 'ኖቬምበር', 'ዲሴምበር',
]

function parseDate(iso?: string | null): Date | null {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function dateEn(iso?: string | null): string | null {
  const d = parseDate(iso)
  if (!d) return null
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Gregorian, in Amharic script. Not the Ethiopian calendar — switching to
 * ዓ.ም. dates is the operator's call and would change every date in the system.
 */
function dateAm(iso?: string | null): string | null {
  const d = parseDate(iso)
  if (!d) return null
  return `${d.getUTCDate()} ${MONTHS_AM[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function line(label: string, value: string | null): string | null {
  return value ? `${label} ${value}` : null
}

export function writePostTemplate(fields: JobFields): PostDraft {
  const hours = fields.hoursPerSession
  const notes = fields.notes?.trim() || null

  const am = [
    `📚 የማስተማር ዕድል — ${fields.subject}`,
    '',
    line('የክፍል ደረጃ፡', fields.grade),
    line('አካባቢ፡', fields.area),
    line('በሳምንት፡', `${fields.daysPerWeek} ቀናት`),
    hours ? line('በአንድ ክፍለ ጊዜ፡', `${hours} ሰዓት`) : null,
    line('ክፍያ፡', `${money(fields.rateAmount)} ብር ${RATE_AM[fields.ratePeriod]}`),
    line('የሚፈለገው፡', GENDER_AM[fields.genderPref]),
    line('ትምህርት የሚጀምረው፡', dateAm(fields.startsOn)),
    '',
    notes,
    notes ? '' : null,
    'ብቁ ነኝ የሚሉ አስተማሪዎች ከታች ያለውን አዝራር ተጭነው ያመልክቱ።',
  ]
    .filter((l): l is string => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const en = [
    `📚 Tutor needed — ${fields.subject}`,
    '',
    line('Grade:', fields.grade),
    line('Area:', fields.area),
    line('Days per week:', String(fields.daysPerWeek)),
    hours ? line('Per session:', `${hours} hour${hours === 1 ? '' : 's'}`) : null,
    line('Pay:', `${money(fields.rateAmount)} ETB ${RATE_EN[fields.ratePeriod]}`),
    line('Preferred:', GENDER_EN[fields.genderPref]),
    line('Starts:', dateEn(fields.startsOn)),
    '',
    notes,
    notes ? '' : null,
    'Tap the button below to apply.',
  ]
    .filter((l): l is string => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { am, en, generatedBy: 'template' }
}

export const templateProvider = {
  name: 'template',
  async writePost(fields: JobFields): Promise<PostDraft> {
    return writePostTemplate(fields)
  },
}
