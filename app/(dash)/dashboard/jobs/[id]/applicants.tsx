import Link from 'next/link'
import type { Applicant } from '@/lib/scoring/board'
import { applicationLabel, offerTerms } from '@/lib/ui/labels'
import { hire, presentTop } from '../actions'
import { ActionForm, Badge, Meter } from '@/components/ui'
import { Button } from '@/components/ui/button'

/**
 * The applicant board. Shows the score with its breakdown rather than a
 * sentence: "subject +30, area +20" is more useful, and it is defensible to a
 * candidate who asks why they were not picked.
 */
export function Applicants({
  jobId,
  jobOpen,
  applicants,
  rateAmount,
  ratePeriod,
  commissionPercent,
}: {
  jobId: number
  jobOpen: boolean
  applicants: Applicant[]
  rateAmount: number
  ratePeriod: string
  commissionPercent: number
}) {
  const terms = offerTerms(rateAmount, ratePeriod, commissionPercent)
  const untouched = applicants.filter((a) => !a.rank.excluded && a.status === 'applied')
  const inPlay = applicants.filter((a) =>
    ['shortlisted', 'commission_agreed', 'hired'].includes(a.status),
  )
  const accepted = applicants.find((a) => a.status === 'commission_agreed')
  const presentedAny = inPlay.length > 0

  return (
    <div className="space-y-3">
      {/* The one thing to do, before the list he would have to scan for it. */}
      {jobOpen && accepted && (
        <div className="flex flex-wrap items-center gap-4 rounded-md border border-green-200 bg-green-50 p-3">
          <div className="min-w-0 grow">
            <p className="text-sm font-medium text-green-900">
              {accepted.name} accepted the commission
            </p>
            <p className="mt-0.5 text-xs text-green-800">
              {[accepted.area, accepted.phone].filter(Boolean).join(' · ')}
            </p>
          </div>
          <ActionForm action={hire} fields={{ id: jobId, applicationId: accepted.applicationId }}>
            <Button variant="success" pendingLabel="Hiring…">
              Hire {accepted.name.split(' ')[0]}
            </Button>
          </ActionForm>
        </div>
      )}

      {jobOpen && untouched.length > 0 && (
        <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <div>
            <p className="text-sm text-neutral-700">
              {presentedAny ? 'Not enough? Ask more.' : 'Ask the best few to accept the commission.'}
            </p>
            {/* The DM cannot be unsent, so the terms are on screen before it goes. */}
            <p className="mt-1 text-xs text-neutral-500">
              <span className="font-medium text-neutral-700">They will be told:</span> {terms.sentence}
            </p>
          </div>
          <ActionForm action={presentTop} fields={{ id: jobId, size: presentedAny ? 5 : 3 }}>
            <Button
              variant="primary"
              size="sm"
              pendingLabel="Asking…"
              confirm={`Message ${presentedAny ? Math.min(5, untouched.length) : Math.min(3, untouched.length)} tutor(s) with these terms? ${terms.sentence} This cannot be unsent.`}
            >
              {presentedAny ? `+${Math.min(5, untouched.length)} more` : `Ask top ${Math.min(3, untouched.length)}`}
            </Button>
          </ActionForm>
        </div>
      )}

      {applicants.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nobody has applied yet. They arrive here when someone taps Apply on the post.
        </p>
      )}

      <ul className="space-y-3">
        {applicants.map((a, i) => {
          const stage = applicationLabel(a.status)
          return (
            <li
              key={a.applicationId}
              className={`rounded-md border border-neutral-200 p-3 ${a.rank.excluded ? 'bg-neutral-50 opacity-70' : ''}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    <span className="mr-2 tabular-nums text-neutral-400">{i + 1}.</span>
                    <Link href={`/dashboard/people/${a.candidateId}`} className="underline underline-offset-2">
                      {a.name}
                    </Link>
                    {a.hasCv && <span className="ml-2 text-xs font-normal text-neutral-400">CV</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {[a.area, a.phone, a.channelTitle && `via ${a.channelTitle}`].filter(Boolean).join(' · ')}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={stage.tone}>{stage.label}</Badge>
                  {a.rank.excluded ? (
                    <Badge tone="neutral">{a.rank.excludedReason}</Badge>
                  ) : (
                    <Meter value={a.rank.score} />
                  )}
                </div>
              </div>

              {!a.rank.excluded && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {a.rank.breakdown.map((c) => (
                    <li
                      key={c.key}
                      className={`rounded px-2 py-0.5 text-xs ${
                        c.points === 0
                          ? 'bg-neutral-100 text-neutral-400'
                          : c.points === c.max
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                      title={`${c.points} of ${c.max}`}
                    >
                      {c.label} {c.points > 0 && `+${c.points}`}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
