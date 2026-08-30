import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { DEFAULT_AREAS, EDUCATION, EXPERIENCE, GRADE_BANDS, labelFor } from '@/lib/candidates/options'
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

/** How many tutors one screen shows. The rest are reached by searching. */
const PAGE = 100

/**
 * Everyone the agency deals with. Parents had no home at all before this —
 * they existed only as a name inside whichever job they were attached to.
 */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string
    q?: string
    area?: string
    grade?: string
    bot?: string
    cv?: string
    sort?: string
  }>
}) {
  const { tab = 'tutors', q = '', area = '', grade = '', bot = '', cv = '', sort = 'completeness' } =
    await searchParams
  const db = supabaseAdmin()
  const needle = q.trim().toLowerCase()

  // Searching and limiting in Postgres rather than in memory. Seven hundred
  // tutors arrived from the old Google Form in one go; the page used to fetch
  // every row and filter the array afterwards, which was fine at twenty.
  const escaped = needle.replace(/[%,()]/g, ' ').trim()
  const tutorSearch = escaped
    ? `full_name.ilike.%${escaped}%,phone.ilike.%${escaped}%,area.ilike.%${escaped}%`
    : null

  let tutorQuery = db
    .from('candidates')
    .select('id, full_name, phone, area, education, experience, subjects, completeness, cv_path, telegram_id', {
      count: 'exact',
    })
  if (tutorSearch) tutorQuery = tutorQuery.or(tutorSearch)

  // Narrowing, all of it in Postgres. Searching by name only works when you
  // already know who you are looking for; picking a job's area and grade is
  // how you find out who could do it.
  if (area === '__none') tutorQuery = tutorQuery.is('area', null)
  else if (area) tutorQuery = tutorQuery.eq('area', area)

  if (grade) tutorQuery = tutorQuery.contains('grades', [grade])

  // Whether the bot can reach them. 716 came from a form and cannot be
  // messaged until they open it, which decides whether shortlisting them
  // does anything at all.
  if (bot === 'yes') tutorQuery = tutorQuery.not('telegram_id', 'is', null)
  else if (bot === 'no') tutorQuery = tutorQuery.is('telegram_id', null)

  if (cv === 'yes') tutorQuery = tutorQuery.not('cv_path', 'is', null)

  const ORDER: Record<string, { column: string; ascending: boolean }> = {
    completeness: { column: 'completeness', ascending: false },
    newest: { column: 'created_at', ascending: false },
    name: { column: 'full_name', ascending: true },
  }
  const order = ORDER[sort] ?? ORDER.completeness

  const [
    { data: candidates, error: tutorError, count: tutorTotal },
    { data: clients, error: parentError },
  ] = await Promise.all([
    tutorQuery.order(order.column, { ascending: order.ascending }).limit(PAGE),
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

  const tutors = candidates ?? []

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
            Tutors {tutorTotal ?? 0}
          </Tab>
          <Tab
            href={`/dashboard/people?tab=parents${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            active={onParents}
          >
            Parents {(clients ?? []).length}
          </Tab>
        </div>

        <form className="flex flex-wrap items-center gap-2">
          {onParents && <input type="hidden" name="tab" value="parents" />}
          <input
            name="q"
            defaultValue={q}
            aria-label="Search people"
            placeholder={onParents ? 'Search name or phone' : 'Search name, phone or area'}
            className="w-64 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
          />

          {/* One GET form, so every filter is in the URL and a useful view can
              be bookmarked or sent to somebody. No client state to go stale. */}
          {!onParents && (
            <>
              <Select name="area" value={area} label="Area">
                <option value="">Any area</option>
                {DEFAULT_AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
                <option value="__none">No area given</option>
              </Select>

              <Select name="grade" value={grade} label="Grades">
                <option value="">Any grade</option>
                {GRADE_BANDS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </Select>

              <Select name="bot" value={bot} label="On the bot">
                <option value="">Anyone</option>
                <option value="yes">On the bot</option>
                <option value="no">Not on the bot</option>
              </Select>

              <Select name="cv" value={cv} label="CV">
                <option value="">CV or not</option>
                <option value="yes">Has a CV</option>
              </Select>

              <Select name="sort" value={sort} label="Sort by">
                <option value="completeness">Fullest profile</option>
                <option value="newest">Newest first</option>
                <option value="name">By name</option>
              </Select>
            </>
          )}

          <Button variant="secondary" size="sm">Apply</Button>
          {!onParents && (area || grade || bot || cv || q) && (
            <Link href="/dashboard/people" className="text-xs text-neutral-500 underline underline-offset-2">
              Clear
            </Link>
          )}
        </form>
      </div>

      {error && <ErrorNote>{error.message}</ErrorNote>}

      {!onParents &&
        !error &&
        (tutors.length === 0 ? (
          <EmptyState
            action={
              needle || area || grade || bot || cv ? (
                <Link href="/dashboard/people" className="text-sm underline underline-offset-2">
                  Clear the filters
                </Link>
              ) : undefined
            }
          >
            {needle || area || grade || bot || cv
              ? 'No tutor matches that. Widening one of the filters usually finds somebody.'
              : 'Nobody yet. Tutors arrive when someone taps Apply on a published job.'}
          </EmptyState>
        ) : (
          <Card>
            {(tutorTotal ?? 0) > tutors.length && (
              <p className="border-b border-neutral-100 px-4 py-2 text-xs text-neutral-500">
                Showing {tutors.length} of {tutorTotal}. Search by name, phone or area to find the rest.
              </p>
            )}
            <Rows>
              {tutors.map((c) => (
                <LinkRow key={c.id} href={`/dashboard/people/${c.id}`}>
                  <div className="min-w-0 grow">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {c.full_name ?? 'Unnamed'}
                      {c.cv_path && <span className="text-xs font-normal text-neutral-400">CV</span>}
                      {/* Whether the bot can reach them at all. An imported
                          tutor is ranked and shortlisted like anyone else, but
                          a DM to one goes nowhere — worth seeing before you
                          wonder why they never replied. */}
                      {!c.telegram_id && (
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-normal text-neutral-500">
                          not on the bot
                        </span>
                      )}
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

/** A filter that remembers what it was set to, because it is in the URL. */
function Select({
  name,
  value,
  label,
  children,
}: {
  name: string
  value: string
  label: string
  children: React.ReactNode
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      aria-label={label}
      className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm focus:border-neutral-900 focus:outline-none"
    >
      {children}
    </select>
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
