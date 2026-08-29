import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { EDUCATION, EXPERIENCE, labelFor } from '@/lib/candidates/options'
import {
  Badge,
  Card,
  EmptyState,
  ErrorNote,
  LinkRow,
  Meter,
  PageHeader,
  PageShell,
  Row,
  Rows,
} from '@/components/ui'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

/**
 * Everyone the agency deals with. Parents had no home at all before this —
 * they existed only as a name inside whichever job they were attached to.
 */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>
}) {
  const { tab = 'tutors', q = '' } = await searchParams
  const db = supabaseAdmin()
  const needle = q.trim().toLowerCase()

  const [{ data: candidates, error: tutorError }, { data: clients, error: parentError }] = await Promise.all([
    db
      .from('candidates')
      .select('id, full_name, phone, area, education, experience, subjects, completeness, cv_path')
      .order('completeness', { ascending: false }),
    db.from('clients').select('id, full_name, phone, telegram_id, area').order('created_at', { ascending: false }),
  ])

  const clientIds = (clients ?? []).map((c) => c.id)
  const { data: placements } = clientIds.length
    ? await db
        .from('placements')
        .select('client_id, status, job_posts(id, subject, grade)')
        .in('client_id', clientIds)
    : { data: [] }

  const byClient = new Map<number, { jobId: number | null; label: string; running: number }>()
  for (const p of placements ?? []) {
    if (!p.client_id) continue
    const job = p.job_posts as unknown as { id: number; subject: string; grade: string } | null
    const bucket = byClient.get(p.client_id) ?? { jobId: null, label: '', running: 0 }
    if (job && !bucket.jobId) {
      bucket.jobId = job.id
      bucket.label = `${job.subject} · ${job.grade}`
    }
    if (['scheduled', 'active'].includes(p.status)) bucket.running += 1
    byClient.set(p.client_id, bucket)
  }

  const tutors = (candidates ?? []).filter((c) =>
    needle
      ? [c.full_name, c.area, c.phone, (c.subjects ?? []).join(' ')]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle)
      : true,
  )

  const parents = (clients ?? []).filter((c) =>
    needle ? [c.full_name, c.phone, c.area].filter(Boolean).join(' ').toLowerCase().includes(needle) : true,
  )

  const onParents = tab === 'parents'
  const error = onParents ? parentError : tutorError

  return (
    <PageShell>
      <PageHeader
        title="People"
        subtitle="Tutors who finished the registration wizard, and the parents paying for lessons."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Tab href={`/dashboard/people${q ? `?q=${encodeURIComponent(q)}` : ''}`} active={!onParents}>
            Tutors {(candidates ?? []).length}
          </Tab>
          <Tab
            href={`/dashboard/people?tab=parents${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            active={onParents}
          >
            Parents {(clients ?? []).length}
          </Tab>
        </div>

        <form className="flex items-center gap-2">
          {onParents && <input type="hidden" name="tab" value="parents" />}
          <input
            name="q"
            defaultValue={q}
            aria-label="Search people"
            placeholder={onParents ? 'Search name or phone' : 'Search name, area or subject'}
            className="w-72 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
          />
          <Button variant="secondary" size="sm">Search</Button>
        </form>
      </div>

      {error && <ErrorNote>{error.message}</ErrorNote>}

      {!onParents &&
        !error &&
        (tutors.length === 0 ? (
          <EmptyState>
            {needle
              ? `No tutor matches “${q}”.`
              : 'Nobody yet. Tutors arrive when someone taps Apply on a published job.'}
          </EmptyState>
        ) : (
          <Card>
            <Rows>
              {tutors.map((c) => (
                <LinkRow key={c.id} href={`/dashboard/people/${c.id}`}>
                  <div className="min-w-0 grow">
                    <p className="text-sm font-medium">
                      {c.full_name ?? 'Unnamed'}
                      {c.cv_path && <span className="ml-2 text-xs font-normal text-neutral-400">CV</span>}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {[c.area, c.phone, labelFor(EDUCATION, c.education), labelFor(EXPERIENCE, c.experience)]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-neutral-400">
                      {(c.subjects ?? []).join(', ') || 'No subjects'}
                    </p>
                  </div>
                  <Meter value={c.completeness} label={`${c.completeness}% of a complete profile`} />
                </LinkRow>
              ))}
            </Rows>
          </Card>
        ))}

      {onParents &&
        !error &&
        (parents.length === 0 ? (
          <EmptyState>
            {needle
              ? `No parent matches “${q}”.`
              : 'No parents yet. One is added from the job page when a tutor is about to be hired.'}
          </EmptyState>
        ) : (
          <Card>
            <Rows>
              {parents.map((c) => {
                const bucket = byClient.get(c.id)
                return (
                  <Row key={c.id}>
                    <div className="min-w-0 grow">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {c.full_name}
                        {c.telegram_id ? <Badge tone="green">On Telegram</Badge> : <Badge>SMS only</Badge>}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">
                        {[c.phone, c.area].filter(Boolean).join(' · ') || 'No phone'}
                      </p>
                    </div>
                    {bucket?.jobId ? (
                      <Link
                        href={`/dashboard/jobs/${bucket.jobId}`}
                        className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
                      >
                        {bucket.label}
                        {bucket.running > 1 && ` +${bucket.running - 1} more`}
                      </Link>
                    ) : (
                      <span className="text-xs text-neutral-400">No placement</span>
                    )}
                  </Row>
                )
              })}
            </Rows>
          </Card>
        ))}
    </PageShell>
  )
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
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
