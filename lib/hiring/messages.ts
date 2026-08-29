import { formatEtb, prepaymentCents, split } from '@/lib/money/commission'

/**
 * Every message the hiring step sends. PURE — text in, text out — so the
 * wording is reviewable and testable without a bot or a database.
 *
 * The rule these all obey: nothing invites a reply. No message asks a question
 * a human would have to read and answer.
 */

export type JobSummary = {
  subject: string
  grade: string
  area: string
  daysPerWeek: number
  rateAmount: number
  ratePeriod: 'per_hour' | 'per_session' | 'per_month'
}

const PERIOD: Record<JobSummary['ratePeriod'], string> = {
  per_hour: 'per hour',
  per_session: 'per session',
  per_month: 'per month',
}

export function jobLine(job: JobSummary): string {
  return `${job.subject}, ${job.grade}, ${job.area}`
}

/**
 * The commission offer. Accept or decline — there is deliberately no counter,
 * because a counter-offer is a negotiation and a negotiation is a conversation
 * (docs/06-decisions.md).
 */
export function commissionOffer(job: JobSummary, commissionPercent: number): string {
  const s = split(job.rateAmount, commissionPercent)
  const upfront = prepaymentCents(s.grossCents, commissionPercent)

  const lines = [
    'Good news — you are shortlisted for this job:',
    '',
    jobLine(job),
    `${job.daysPerWeek} days a week`,
    '',
    `You would be paid ${formatEtb(s.netCents)} ETB ${PERIOD[job.ratePeriod]}.`,
    `Our fee is ${commissionPercent}%, already taken out of that figure.`,
  ]

  // Said before they accept, in the money they would actually hand over. A
  // tutor who finds out about this after saying yes has been misled.
  if (upfront > 0) {
    lines.push(
      '',
      `There is also a one-off pre-payment of ${formatEtb(upfront)} ETB, due to us before your first lesson.`,
      'That is separate from the fee above, which still comes out of every payment — including your first.',
    )
  }

  lines.push('', 'Do you accept?')
  return lines.join('\n')
}

export function commissionAccepted(job: JobSummary): string {
  return [
    `Accepted. You are in for ${jobLine(job)}.`,
    '',
    'The family is choosing now. We will message you here either way — you do not need to do anything.',
  ].join('\n')
}

export function commissionDeclined(job: JobSummary): string {
  return [
    `No problem — you are out of ${jobLine(job)} and nothing else changes.`,
    '',
    'We will still message you when other jobs suit you.',
  ].join('\n')
}

/** The hire. Contact release is a setting; this respects it. */
export function hired(
  job: JobSummary,
  parentFirstName: string,
  commissionPercent: number,
  release: 'on_hire' | 'after_first_payment' | 'never',
  parentPhone: string | null,
): string {
  const s = split(job.rateAmount, commissionPercent)
  const lines = [
    'You got the job 🎉',
    '',
    jobLine(job),
    `${job.daysPerWeek} days a week · ${formatEtb(s.netCents)} ETB ${PERIOD[job.ratePeriod]} to you`,
    '',
    `The family is ${parentFirstName}'s.`,
  ]

  const upfront = prepaymentCents(s.grossCents, commissionPercent)
  if (upfront > 0) {
    lines.push(
      '',
      `Your one-off pre-payment of ${formatEtb(upfront)} ETB is now due, before the first lesson.`,
    )
  }

  if (release === 'on_hire' && parentPhone) {
    lines.push(`You can reach them on ${parentPhone}.`)
  } else if (release === 'after_first_payment') {
    lines.push(
      'We will send you their number once the first month is paid. Until then, arrange lessons through this bot.',
    )
  } else {
    lines.push('Arrange your lessons through this bot.')
  }

  lines.push('', 'We will remind you before every lesson and ask you to confirm the hours you worked.')
  return lines.join('\n')
}

/**
 * The two who were presented and not chosen. They agreed to a commission and
 * waited, so they get told properly rather than left to wonder.
 */
export function notChosenAfterShortlist(job: JobSummary): string {
  return [
    `The family chose someone else for ${jobLine(job)}.`,
    '',
    'You were one of the final few, which is not nothing — your profile is strong. We will message you when the next job fits.',
    '',
    'Nothing to reply to.',
  ].join('\n')
}

/** Everyone else in the pipeline. Short, honest, no false hope. */
export function notChosen(job: JobSummary): string {
  return [
    `${jobLine(job)} has been filled.`,
    '',
    'We will message you when something else suits you. Nothing to reply to.',
  ].join('\n')
}

/** What a channel post becomes once the job is filled. */
export function filledPost(originalBody: string): string {
  return `✅ FILLED\n\n${strikeHeader(originalBody)}`
}

/** Keep the post recognisable, but make the first line unmistakable. */
function strikeHeader(body: string): string {
  const [first, ...rest] = body.split('\n')
  return [`${first} — no longer accepting applications`, ...rest].join('\n')
}
