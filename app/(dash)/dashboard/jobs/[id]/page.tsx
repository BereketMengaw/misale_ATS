import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { regenerateJob, saveBodies, setApproval } from '../actions'
import { PublishPanel } from './publish-panel'

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
            {job.area} · {job.days_per_week}×/week · {Number(job.rate_amount).toLocaleString()} ETB
            {RATE_LABEL[job.rate_period] ?? ''} · {job.commission_percent}% commission
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            approved ? 'bg-green-100 text-green-800' : 'bg-neutral-200 text-neutral-700'
          }`}
        >
          {approved ? 'Approved' : 'Draft'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Preview title="አማርኛ" body={job.body_am} />
        <Preview title="English" body={job.body_en} />
      </div>

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

      <PublishPanel jobId={job.id} approved={approved} />

      <details className="rounded-md border border-neutral-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium">Edit the text by hand</summary>
        <form action={saveBodies} className="mt-4 space-y-3">
          <input type="hidden" name="id" value={job.id} />
          <label className="block">
            <span className="text-sm text-neutral-600">አማርኛ</span>
            <textarea
              name="body_am"
              rows={12}
              defaultValue={job.body_am}
              className="mt-1 w-full rounded-md border border-neutral-300 p-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-600">English</span>
            <textarea
              name="body_en"
              rows={12}
              defaultValue={job.body_en}
              className="mt-1 w-full rounded-md border border-neutral-300 p-3 text-sm"
            />
          </label>
          <p className="text-xs text-neutral-400">Saving clears the approval, so you re-read it once.</p>
          <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
            Save text
          </button>
        </form>
      </details>
    </div>
  )
}

function Preview({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">{title}</h2>
      <div className="whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white p-4 text-sm leading-relaxed">
        {body}
      </div>
      <p className="mt-1 text-right text-xs text-neutral-400">{body.length} chars</p>
    </div>
  )
}
