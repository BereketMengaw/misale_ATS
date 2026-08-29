import { messageTalentPool } from '../actions'
import { Button } from '@/components/ui/button'

export type PoolPreview = {
  chosen: { candidateId: number; name: string; score: number }[]
  rules: { minScore: number; maxPerJob: number; cooldownDays: number }
}

export type TalentMatch = {
  candidate_id: number
  score: number | string
  sent_at: string | null
  applied_at: string | null
  error: string | null
  candidates: unknown
}

/**
 * The tutors already in the pool who fit this job. Shows who would be messaged
 * before anything is sent — an unsolicited DM that misses gets the bot muted,
 * and a muted tutor is lost for every future job. Which is why the send asks.
 */
export function TalentPanel({
  jobId,
  preview,
  sent,
}: {
  jobId: number
  preview: PoolPreview | null
  sent: TalentMatch[]
}) {
  return (
    <div className="space-y-3">
      {sent.length > 0 && (
        <ul className="space-y-1 text-sm">
          {sent.map((m) => {
            const name = (m.candidates as { full_name: string | null } | null)?.full_name ?? 'Unnamed'
            return (
              <li key={m.candidate_id} className="flex items-center justify-between gap-3">
                <span>{name}</span>
                <span className="text-xs text-neutral-500">
                  {m.error ? `failed — ${m.error}` : m.applied_at ? 'applied ✓' : m.sent_at ? 'messaged' : 'queued'}
                  {' · '}
                  {Number(m.score)}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {preview && preview.chosen.length > 0 ? (
        <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-sm text-neutral-700">
            {preview.chosen.length} {preview.chosen.length === 1 ? 'tutor fits' : 'tutors fit'} this job and
            {' '}{preview.chosen.length === 1 ? 'has' : 'have'} not applied.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {preview.chosen.map((c) => (
              <li key={c.candidateId} className="rounded bg-white px-2 py-0.5 text-xs text-neutral-700 ring-1 ring-neutral-200">
                {c.name} · {c.score}
              </li>
            ))}
          </ul>
          <form action={messageTalentPool}>
            <input type="hidden" name="id" value={jobId} />
            <Button
              variant="primary"
              size="sm"
              pendingLabel="Sending…"
              confirm={`Send an unsolicited message to ${preview.chosen.length} tutor${preview.chosen.length === 1 ? '' : 's'}? A tutor who mutes the bot is lost for every future job.`}
            >
              Message {preview.chosen.length}
            </Button>
          </form>
          <p className="text-xs text-neutral-400">
            Scores {preview.rules.minScore}+ · at most {preview.rules.maxPerJob} · nobody messaged twice
            in {preview.rules.cooldownDays} days.
          </p>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          {sent.length > 0 ? 'Everyone who fits has been messaged.' : 'Nobody in the pool fits this job yet.'}
        </p>
      )}
    </div>
  )
}
