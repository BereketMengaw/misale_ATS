import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { regenerateJob, saveBody, setApproval } from '../actions'
import { PublishPanel } from './publish-panel'
import { formatEtb, split } from '@/lib/money/commission'
import { Applicants } from './applicants'

export const dynamic = 'force-dynamic'

const RATE_LABEL: Record<string, string> = {
  per_hour: '/hour',
  per_session: '/session',
  per_month: '/month',
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const jobId = Number(id)
  if (!Number.isInteger(jobId)) notFound()

  const { data: job } = await supabaseAdmin()
    .from('job_posts')
    .select('*')
    .eq('id', jobId)
    .maybeSingle()

  if (!job) notFound()

  const approved = Boolean(job.approved_at)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/jobs" className="text-sm text-neutral-500 underline underline-offset-2">
            ← Jobs
          </Link>
          <h1 className="mt-2 text-lg font-semibold">
            {job.subject} · {job.grade}
          </h1>
          <p className="text-sm text-neutral-500">
            {job.area} · {job.days_per_week}×/week
          </p>
          <Money
            gross={Number(job.rate_amount)}
            percent={Number(job.commission_percent)}
            period={RATE_LABEL[job.rate_period] ?? ''}
          />
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            approved ? 'bg-green-100 text-green-800' : 'bg-neutral-200 text-neutral-700'
          }`}
        >
          {approved ? 'Approved' : 'Draft'}
        </span>
      </div>

      <Preview body={job.body} />

      <p className="text-xs text-neutral-400">
        Written by <code>{job.generated_by}</code>
        {job.body_edited && ' · hand-edited since'}
      </p>

      <div className="flex flex-wrap gap-2">
        <form action={setApproval}>
          <input type="hidden" name="id" value={job.id} />
          <input type="hidden" name="approve" value={approved ? '0' : '1'} />
          <button
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              approved
                ? 'border border-neutral-300 bg-white text-neutral-700'
                : 'bg-neutral-900 text-white'
            }`}
          >
            {approved ? 'Withdraw approval' : 'Approve'}
          </button>
        </form>

        <form action={regenerateJob}>
          <input type="hidden" name="id" value={job.id} />
          <button className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-700">
            Rewrite from fields
          </button>
        </form>
      </div>

      <Applicants jobId={job.id} />

      <PublishPanel jobId={job.id} approved={approved} />

      <details className="rounded-md border border-neutral-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium">Edit the text by hand</summary>
        <form action={saveBody} className="mt-4 space-y-3">
          <input type="hidden" name="id" value={job.id} />
          <textarea
            name="body"
            rows={14}
            defaultValue={job.body}
            className="w-full rounded-md border border-neutral-300 p-3 text-sm"
          />
          <p className="text-xs text-neutral-400">Saving clears the approval, so you re-read it once.</p>
          <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
            Save text
          </button>
        </form>
      </details>
    </div>
  )
}

/** Who gets what. The post advertises the tutor's number, so show all three. */
function Money({ gross, percent, period }: { gross: number; percent: number; period: string }) {
  const s = split(gross, percent)
  return (
    <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
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
    </dl>
  )
}

function Preview({ body }: { body: string }) {
  return (
    <div className="max-w-xl">
      <div className="whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white p-4 text-sm leading-relaxed">
        {body}
      </div>
      <p className="mt-1 text-xs text-neutral-400">{body.length} / 4096 characters</p>
    </div>
  )
}
