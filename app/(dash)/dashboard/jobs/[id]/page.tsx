import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { applicantsFor } from '@/lib/scoring/board'
import { previewPool } from '@/lib/talent/service'
import { formatEtb, prepaymentCents, split } from '@/lib/money/commission'
import { jobLabel, rateSuffix } from '@/lib/ui/labels'
import { regenerateJob, saveBody, setApproval } from '../actions'
import { Badge, PageHeader, PageShell } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/styles'
import { Phase, Stepper, type PhaseState } from './phase'
import { PublishPanel } from './publish-panel'
import { TalentPanel } from './talent-panel'
import { Applicants } from './applicants'
import { ClientPanel } from './client-panel'
import { PlacementPanel } from './placement-panel'

export const dynamic = 'force-dynamic'

/**
 * A job, shown as the sequence it actually is.
 *
 * The old page rendered all eight panels at once, in an order that contradicted
 * the work: Publishing sat below Applicants, though nothing can apply until it
 * is published, and the Parent form sat at the top though it is only needed at
 * hire time. Here each step collapses once it is done, and only the step he is
 * on is open.
 */
export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const jobId = Number(id)
  if (!Number.isInteger(jobId)) notFound()

  const db = supabaseAdmin()

  const { data: job } = await db
    .from('job_posts')
    .select('*, clients(id, full_name, phone, telegram_id)')
    .eq('id', jobId)
    .maybeSingle()

  if (!job) notFound()

  const [{ data: publications }, { data: channels }, applicants, { data: matches }, { data: placement }] =
    await Promise.all([
      db
        .from('post_publications')
        .select('id, channel_id, method, posted_at, apply_count, error, channels(title)')
        .eq('job_post_id', jobId),
      db.from('channels').select('id, title, kind').eq('active', true).order('id'),
      applicantsFor(jobId),
      db
        .from('talent_matches')
        .select('candidate_id, score, sent_at, applied_at, error, candidates(full_name)')
        .eq('job_post_id', jobId)
        .order('score', { ascending: false }),
      db
        .from('placements')
        .select('id, status, schedule, starts_on, ends_on, rate_amount, commission_percent, candidates(id, full_name, phone), clients(full_name, phone)')
        .eq('job_post_id', jobId)
        .maybeSingle(),
    ])

  const client = (job.clients as unknown as { id: number; full_name: string; phone: string | null; telegram_id: number | null } | null) ?? null
  const pubs = publications ?? []
  const sent = matches ?? []
  const preview = job.status === 'open' ? await previewPool(jobId) : null

  const approved = Boolean(job.approved_at)
  const published = pubs.length > 0
  const filled = job.status === 'closed_filled'
  const open = job.status === 'open'
  const accepted = applicants.find((a) => a.status === 'commission_agreed')
  const asked = applicants.filter((a) =>
    ['shortlisted', 'presented', 'commission_agreed', 'hired'].includes(a.status),
  ).length
  const taps = pubs.reduce((n, p) => n + (p.apply_count ?? 0), 0)

  // Exactly one phase is "current": the next thing that needs him.
  const current: string = !approved
    ? 'post'
    : !published
      ? 'publishing'
      : open && !accepted && applicants.length === 0
        ? 'pool'
        : open
          ? 'applicants'
          : !client
            ? 'parent'
            : 'placement'

  // The step he is ON always wins. Ranking `done` first meant the Applicants
  // phase was marked finished — and so collapsed — the moment somebody
  // applied, hiding the applicant behind a summary line that counted them.
  const state = (key: string, done: boolean): PhaseState =>
    current === key ? 'current' : done ? 'done' : 'todo'

  const status = jobLabel(job.status, job.approved_at)

  return (
    <PageShell width="narrow">
      <PageHeader
        back={{ href: '/dashboard/jobs', label: 'Jobs' }}
        title={`${job.subject} · ${job.grade}`}
        subtitle={`${job.area} · ${job.days_per_week}×/week`}
        aside={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      <Money
        gross={Number(job.rate_amount)}
        percent={Number(job.commission_percent)}
        period={rateSuffix(job.rate_period)}
      />

      <Stepper
        steps={[
          { label: 'Written', state: 'done' },
          { label: 'Approved', state: state('post', approved) },
          { label: 'Published', state: state('publishing', published) },
          { label: 'Applicants', state: state('applicants', applicants.length > 0) },
          { label: 'Hired', state: filled ? 'done' : accepted ? 'current' : 'todo' },
          { label: 'Introduced', state: state('parent', filled && Boolean(client)) },
        ]}
      />

      <div className="space-y-3">
        <Phase
          id="post"
          title="The post"
          state={state('post', approved)}
          summary={`${job.generated_by}${job.body_edited ? ' · hand-edited' : ''} · ${job.body.length} characters`}
        >
          <div className="space-y-4">
            <div className="whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed">
              {job.body}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <form action={setApproval}>
                <input type="hidden" name="id" value={job.id} />
                <input type="hidden" name="approve" value={approved ? '0' : '1'} />
                <Button variant={approved ? 'secondary' : 'primary'} pendingLabel="Saving…">
                  {approved ? 'Withdraw approval' : 'Approve'}
                </Button>
              </form>
              <form action={regenerateJob}>
                <input type="hidden" name="id" value={job.id} />
                <Button
                  variant="secondary"
                  pendingLabel="Rewriting…"
                  confirm={job.body_edited ? 'Rewriting discards the edits you made by hand. Continue?' : undefined}
                >
                  Rewrite from fields
                </Button>
              </form>
            </div>

            <details className="border-t border-neutral-100 pt-4">
              <summary className="cursor-pointer text-sm text-neutral-500 underline underline-offset-2">
                Edit the text by hand
              </summary>
              <form action={saveBody} className="mt-3 space-y-3">
                <input type="hidden" name="id" value={job.id} />
                <textarea name="body" rows={14} defaultValue={job.body} className={inputClass} aria-label="Post text" />
                <p className="text-xs text-neutral-400">Saving clears the approval, so you re-read it once.</p>
                <Button variant="primary" pendingLabel="Saving…">
                  Save text
                </Button>
              </form>
            </details>
          </div>
        </Phase>

        <Phase
          id="publishing"
          title="Publishing"
          state={state('publishing', published)}
          summary={
            published
              ? `${pubs.length} channel${pubs.length === 1 ? '' : 's'} · ${taps} apply tap${taps === 1 ? '' : 's'}`
              : approved
                ? 'Ready to publish'
                : 'Approve it first'
          }
        >
          <PublishPanel jobId={job.id} approved={approved} publications={pubs} channels={channels ?? []} />
        </Phase>

        {(open || sent.length > 0) && (
          <Phase
            id="pool"
            title="Talent pool"
            state={state('pool', sent.length > 0)}
            summary={
              sent.length > 0
                ? `${sent.length} messaged · ${sent.filter((m) => m.applied_at).length} applied`
                : preview && preview.chosen.length > 0
                  ? `${preview.chosen.length} fit and have not applied`
                  : preview && preview.skipped.length > 0
                    ? `${preview.skipped.length} in the pool · none can be messaged`
                    : 'The pool is empty'
            }
          >
            <TalentPanel jobId={job.id} preview={preview} sent={sent} />
          </Phase>
        )}

        <Phase
          id="applicants"
          title="Applicants"
          state={state('applicants', applicants.length > 0)}
          summary={
            applicants.length === 0
              ? 'Nobody yet'
              : `${applicants.length} applied · ${asked === 0 ? 'nobody asked' : `${asked} asked`}${accepted ? ' · 1 accepted' : ''}`
          }
        >
          <Applicants
            jobId={job.id}
            jobOpen={open}
            applicants={applicants}
            rateAmount={Number(job.rate_amount)}
            ratePeriod={job.rate_period}
            commissionPercent={Number(job.commission_percent)}
          />
        </Phase>

        <Phase
          id="parent"
          title="The parent"
          state={state('parent', Boolean(client))}
          summary={
            client
              ? `${client.full_name}${client.telegram_id ? ' · on Telegram' : ''}`
              : 'Needed before anyone can be introduced'
          }
        >
          <ClientPanel
            job={{
              id: job.id,
              subject: job.subject,
              grade: job.grade,
              area: job.area,
              days_per_week: job.days_per_week,
              status: job.status,
              hired_application_id: job.hired_application_id,
            }}
            client={client}
          />
        </Phase>

        {placement && (
          <Phase
            id="placement"
            title="The placement"
            state={state('placement', Boolean(placement.schedule))}
            summary={placement.schedule ? 'Schedule agreed' : 'No schedule noted yet'}
          >
            <PlacementPanel placement={placement} />
          </Phase>
        )}
      </div>
    </PageShell>
  )
}

/** Who gets what. The post advertises the tutor's number, so show all three. */
function Money({ gross, percent, period }: { gross: number; percent: number; period: string }) {
  const s = split(gross, percent)
  const upfront = prepaymentCents(s.grossCents, percent)
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      <div className="flex gap-2">
        <dt className="text-neutral-500">Parent pays</dt>
        <dd className="font-medium tabular-nums">{formatEtb(s.grossCents)} ETB{period}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="text-neutral-500">Tutor gets</dt>
        <dd className="font-medium tabular-nums">{formatEtb(s.netCents)} ETB{period}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="text-neutral-500">You keep ({percent}%)</dt>
        <dd className="font-medium tabular-nums text-green-800">{formatEtb(s.commissionCents)} ETB{period}</dd>
      </div>
      {upfront > 0 && (
        <div className="flex gap-2">
          <dt className="text-neutral-500">Tutor pre-pays</dt>
          <dd
            className="font-medium tabular-nums text-green-800"
            title="A one-off charge before the first lesson, on top of the fee deducted every period"
          >
            {formatEtb(upfront)} ETB once
          </dd>
        </div>
      )}
    </dl>
  )
}
