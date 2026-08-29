import { supabaseAdmin } from '@/lib/supabase/admin'
import { previewPool } from '@/lib/talent/service'
import { messageTalentPool } from '../actions'

/**
 * The tutors already in the pool who fit this job. Shows who would be messaged
 * and why the rest would not, before anything is sent — an unsolicited DM that
 * misses gets the bot muted, and a muted tutor is lost for every future job.
 */
export async function TalentPanel({ jobId, jobOpen }: { jobId: number; jobOpen: boolean }) {
  if (!jobOpen) return null

  const db = supabaseAdmin()
  const [preview, { data: alreadySent }] = await Promise.all([
    previewPool(jobId),
    db
      .from('talent_matches')
      .select('candidate_id, score, sent_at, applied_at, error, candidates(full_name)')
      .eq('job_post_id', jobId)
      .order('score', { ascending: false }),
  ])

  const sent = alreadySent ?? []
  const converted = sent.filter((m) => m.applied_at).length

  return (
    <section className="space-y-3 rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium">Talent pool</h2>
        {sent.length > 0 && (
          <span className="text-xs text-neutral-400">
            {sent.length} messaged · {converted} applied
          </span>
        )}
      </div>

      {sent.length > 0 && (
        <ul className="space-y-1 text-sm">
          {sent.map((m) => {
            const name = (m.candidates as unknown as { full_name: string | null } | null)?.full_name ?? 'Unnamed'
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
            <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white">
              Message {preview.chosen.length}
            </button>
          </form>
          <p className="text-xs text-neutral-400">
            Scores {preview.rules.minScore}+ · at most {preview.rules.maxPerJob} · nobody messaged twice
            in {preview.rules.cooldownDays} days.
          </p>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          {sent.length > 0
            ? 'Everyone who fits has been messaged.'
            : 'Nobody in the pool fits this job yet.'}
        </p>
      )}
    </section>
  )
}
