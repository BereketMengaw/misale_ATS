import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { describeSchedule, type Schedule } from '@/lib/placements/schedule'
import { genderExcluded } from '@/lib/scoring/rank'
import { formatEtb } from '@/lib/money/commission'
import { rateSuffix } from '@/lib/ui/labels'
import { Button } from '@/components/ui/button'
import {
  ActionForm,
  Badge,
  Card,
  EmptyState,
  ErrorNote,
  GroupLabel,
  LinkButton,
  PageHeader,
  PageShell,
  Rows,
} from '@/components/ui'
import { hire, presentTop } from './actions'

export const dynamic = 'force-dynamic'

type Phase = 'draft' | 'live' | 'filled'

type JobRow = {
  id: number
  subject: string
  grade: string
  area: string
  daysPerWeek: number
  rate: string
  status: string
  approvedAt: string | null
  createdAt: string
  generatedBy: string
  clientName: string | null
  tutorName: string | null
  schedule: Schedule | null
  applicants: number
  asked: number
  eligible: number
  barred: string | null
  accepted: { applicationId: number; name: string } | null
  phase: Phase
}

const PHASES: { key: Phase; label: string; note: string }[] = [
  { key: 'draft', label: 'Draft', note: 'not visible to anyone' },
  { key: 'live', label: 'Live', note: 'taking applications' },
  { key: 'filled', label: 'Filled', note: 'running placements' },
]

function ageInDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; phase?: string }>
}) {
  const { q = '', phase } = await searchParams
  const db = supabaseAdmin()

  const { data: jobs, error } = await db
    .from('job_posts')
    .select(
      'id, subject, grade, area, days_per_week, rate_amount, rate_period, status, approved_at, created_at, generated_by, gender_pref, clients(full_name)',
    )
    .order('created_at', { ascending: false })

  const ids = (jobs ?? []).map((j) => j.id)

  const [{ data: apps }, { data: placements }] = ids.length
    ? await Promise.all([
        db.from('applications').select('id, job_post_id, status, candidates(full_name, gender)').in('job_post_id', ids),
        db.from('placements').select('job_post_id, schedule, candidates(full_name)').in('job_post_id', ids),
      ])
    : [{ data: [] }, { data: [] }]

  const prefByJob = new Map((jobs ?? []).map((j) => [j.id, j.gender_pref as string | null]))

  type Bucket = {
    total: number
    asked: number
    eligible: number
    barred: string | null
    accepted: { applicationId: number; name: string } | null
  }

  const counts = new Map<number, Bucket>()
  for (const a of apps ?? []) {
    const bucket: Bucket =
      counts.get(a.job_post_id) ?? { total: 0, asked: 0, eligible: 0, barred: null, accepted: null }
    const c = a.candidates as unknown as { full_name: string | null; gender: string | null } | null
    bucket.total += 1

    if (['shortlisted', 'presented', 'commission_agreed', 'hired'].includes(a.status)) {
      bucket.asked += 1
    } else {
      // Only applicants the job's own preference allows can actually be asked.
      const barred = genderExcluded(prefByJob.get(a.job_post_id), c?.gender ?? null)
      if (barred) bucket.barred = barred
      else bucket.eligible += 1
    }

    if (a.status === 'commission_agreed' && !bucket.accepted) {
      bucket.accepted = { applicationId: a.id, name: c?.full_name ?? 'the tutor' }
    }
    counts.set(a.job_post_id, bucket)
  }

  const placementByJob = new Map(
    (placements ?? []).map((p) => [
      p.job_post_id,
      {
        tutor: (p.candidates as unknown as { full_name: string | null } | null)?.full_name ?? null,
        schedule: p.schedule as Schedule | null,
      },
    ]),
  )

  const rows: JobRow[] = (jobs ?? []).map((j) => {
    const bucket = counts.get(j.id) ?? { total: 0, asked: 0, eligible: 0, barred: null, accepted: null }
    const placement = placementByJob.get(j.id)
    const client = j.clients as unknown as { full_name: string } | null
    return {
      id: j.id,
      subject: j.subject,
      grade: j.grade,
      area: j.area,
      daysPerWeek: j.days_per_week,
      rate: `${formatEtb(Math.round(Number(j.rate_amount) * 100))} ETB${rateSuffix(j.rate_period)}`,
      status: j.status,
      approvedAt: j.approved_at,
      createdAt: j.created_at,
      generatedBy: j.generated_by,
      clientName: client?.full_name ?? null,
      tutorName: placement?.tutor ?? null,
      schedule: placement?.schedule ?? null,
      applicants: bucket.total,
      asked: bucket.asked,
      eligible: bucket.eligible,
      barred: bucket.barred,
      accepted: bucket.accepted,
      phase: j.status === 'open' ? 'live' : j.status === 'draft' ? 'draft' : 'filled',
    }
  })

  const needle = q.trim().toLowerCase()
  const matching = needle
    ? rows.filter((r) =>
        [r.subject, r.grade, r.area, r.clientName, r.tutorName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle),
      )
    : rows

  const visible = PHASES.filter((p) => !phase || p.key === phase)

  return (
    <PageShell>
      <PageHeader
        title="Jobs"
        subtitle={`${rows.length} job${rows.length === 1 ? '' : 's'}, grouped by where they are.`}
        action={<LinkButton href="/dashboard/jobs/new">New job post</LinkButton>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex items-center gap-2">
          {phase && <input type="hidden" name="phase" value={phase} />}
          <input
            name="q"
            defaultValue={q}
            aria-label="Search jobs"
            placeholder="Search subject, area or parent"
            className="w-72 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
          />
          <Button variant="secondary" size="sm">Search</Button>
        </form>

        <div className="flex flex-wrap items-center gap-1">
          <Pill href={q ? `/dashboard/jobs?q=${encodeURIComponent(q)}` : '/dashboard/jobs'} active={!phase}>
            All {rows.length}
          </Pill>
          {PHASES.map((p) => (
            <Pill
              key={p.key}
              href={`/dashboard/jobs?phase=${p.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              active={phase === p.key}
            >
              {p.label} {rows.filter((r) => r.phase === p.key).length}
            </Pill>
          ))}
        </div>
      </div>

      {error && <ErrorNote>{error.message}</ErrorNote>}

      {!error && rows.length === 0 && (
        <EmptyState action={<LinkButton href="/dashboard/jobs/new">New job post</LinkButton>}>
          No jobs yet. A job post is where everything else starts.
        </EmptyState>
      )}

      {!error && rows.length > 0 && matching.length === 0 && (
        <EmptyState action={<LinkButton href="/dashboard/jobs" variant="secondary">Clear the search</LinkButton>}>
          Nothing matches &ldquo;{q}&rdquo;.
        </EmptyState>
      )}

      {visible.map((p) => {
        const group = matching.filter((r) => r.phase === p.key)
        if (group.length === 0) return null
        return (
          <section key={p.key} className="space-y-2">
            <GroupLabel>
              {p.label} · {group.length} · {p.note}
            </GroupLabel>
            <Card>
              <Rows>
                {group.map((job) => (
                  <JobLine key={job.id} job={job} />
                ))}
              </Rows>
            </Card>
          </section>
        )
      })}
    </PageShell>
  )
}

function Pill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
        active
          ? 'bg-neutral-900 font-medium text-white'
          : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
      }`}
    >
      {children}
    </Link>
  )
}

/**
 * One job, and what it is waiting for. The nudge belongs in the list: a job
 * that needs a shortlist should say so before it is opened, not after.
 */
function JobLine({ job }: { job: JobRow }) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4">
      <div className="min-w-0 grow">
        <p className="text-sm font-medium">
          <Link href={`/dashboard/jobs/${job.id}`} className="hover:underline hover:underline-offset-2">
            {job.subject} · {job.grade}
          </Link>
          {job.phase === 'filled' && (job.tutorName || job.clientName) && (
            <span className="ml-2 font-normal text-neutral-500">
              {job.tutorName ?? 'Tutor'} &rarr; {job.clientName ?? 'no parent'}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">{summarise(job)}</p>
      </div>
      <Signal job={job} />
    </div>
  )
}

function summarise(job: JobRow): string {
  const base = `${job.area} · ${job.daysPerWeek}×/week · ${job.rate}`
  if (job.phase === 'filled') return `${base} · ${describeSchedule(job.schedule)}`
  if (job.phase === 'draft') {
    return job.approvedAt ? base : `${base} · written by ${job.generatedBy}`
  }
  if (job.applicants === 0) return `${base} · nobody has applied · posted ${ageInDays(job.createdAt)} days ago`
  if (job.asked === 0 && job.eligible === 0) {
    return `${base} · ${job.applicants} applied · ${job.barred ?? 'none eligible'}`
  }
  return `${base} · ${job.applicants} applied · ${job.asked === 0 ? 'nobody asked' : `${job.asked} asked`}`
}

/** The badge says what state it is in; the button, if any, is the way out of it. */
function Signal({ job }: { job: JobRow }) {
  if (job.phase === 'draft') {
    return job.approvedAt ? (
      <div className="flex items-center gap-3">
        <Badge tone="green">Approved</Badge>
        <LinkButton href={`/dashboard/jobs/${job.id}#publishing`} size="sm">
          Publish
        </LinkButton>
      </div>
    ) : (
      <div className="flex items-center gap-3">
        <Badge>Draft</Badge>
        <LinkButton href={`/dashboard/jobs/${job.id}`} variant="secondary" size="sm">
          Review
        </LinkButton>
      </div>
    )
  }

  if (job.phase === 'filled') {
    return <Badge tone="solid-green">Filled</Badge>
  }

  if (job.accepted) {
    return (
      <div className="flex items-center gap-3">
        <Badge tone="green">Ready to hire</Badge>
        <ActionForm action={hire} fields={{ id: job.id, applicationId: job.accepted.applicationId }}>
          <Button variant="success" size="sm" pendingLabel="Hiring…">
            Hire {job.accepted.name.split(' ')[0]}
          </Button>
        </ActionForm>
      </div>
    )
  }

  if (job.applicants > 0 && job.asked === 0 && job.eligible === 0) {
    return (
      <div className="flex items-center gap-3">
        <Badge tone="amber">Nobody you can ask</Badge>
        <LinkButton href={`/dashboard/jobs/${job.id}`} variant="secondary" size="sm">
          Review
        </LinkButton>
      </div>
    )
  }

  if (job.eligible > 0 && job.asked === 0) {
    return (
      <div className="flex items-center gap-3">
        <Badge tone="blue">Needs a shortlist</Badge>
        <ActionForm action={presentTop} fields={{ id: job.id, size: Math.min(3, job.eligible) }}>
          <Button variant="primary" size="sm" pendingLabel="Asking…">
            Ask top {Math.min(3, job.eligible)}
          </Button>
        </ActionForm>
      </div>
    )
  }

  if (job.applicants === 0 && ageInDays(job.createdAt) >= 7) {
    return (
      <div className="flex items-center gap-3">
        <Badge tone="amber">Going quiet</Badge>
        <LinkButton href={`/dashboard/jobs/${job.id}#pool`} variant="secondary" size="sm">
          Try the pool
        </LinkButton>
      </div>
    )
  }

  return <span className="text-xs text-neutral-400">Nothing to do</span>
}
