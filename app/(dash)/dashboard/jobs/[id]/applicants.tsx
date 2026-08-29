import Link from 'next/link'
import { applicantsFor } from '@/lib/scoring/board'

/**
 * The applicant board. Shows the score with its breakdown rather than a
 * sentence: "subject +30, area +20" is more useful, and it is defensible to a
 * candidate who asks why they were not picked.
 */
export async function Applicants({ jobId }: { jobId: number }) {
  const applicants = await applicantsFor(jobId)

  return (
    <section className="space-y-3 rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium">
          Applicants{applicants.length > 0 && ` · ${applicants.length}`}
        </h2>
        {applicants.length > 0 && (
          <span className="text-xs text-neutral-400">Ranked best first</span>
        )}
      </div>

      {applicants.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nobody has applied yet. They arrive here when someone taps Apply on the post.
        </p>
      )}

      <ul className="space-y-3">
        {applicants.map((a, i) => (
          <li
            key={a.applicationId}
            className={`rounded-md border p-3 ${
              a.rank.excluded ? 'border-neutral-200 bg-neutral-50 opacity-70' : 'border-neutral-200'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="mr-2 tabular-nums text-neutral-400">{i + 1}.</span>
                  <Link href={`/dashboard/candidates/${a.candidateId}`} className="underline underline-offset-2">
                    {a.name}
                  </Link>
                  {a.hasCv && <span className="ml-2 text-xs text-neutral-400">CV</span>}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {[a.area, a.phone, a.channelTitle && `via ${a.channelTitle}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              {a.rank.excluded ? (
                <span className="rounded-full bg-neutral-200 px-2.5 py-1 text-xs text-neutral-700">
                  {a.rank.excludedReason}
                </span>
              ) : (
                <Score value={a.rank.score} />
              )}
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
        ))}
      </ul>
    </section>
  )
}

function Score({ value }: { value: number }) {
  const tone = value >= 75 ? 'bg-green-600' : value >= 50 ? 'bg-amber-500' : 'bg-neutral-400'
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200">
        <div className={`h-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right text-sm font-medium tabular-nums">{value}</span>
    </div>
  )
}
