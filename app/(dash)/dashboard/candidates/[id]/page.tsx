import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { DAYS, EDUCATION, EXPERIENCE, GENDERS, labelFor, SLOTS } from '@/lib/candidates/options'
import { missingFields } from '@/lib/candidates/completeness'
import type { Availability } from '@/lib/candidates/availability'

export const dynamic = 'force-dynamic'

const DAY_LABEL = Object.fromEntries(DAYS.map((d) => [d.value, d.label]))
const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.value, s.label]))

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = supabaseAdmin()

  const { data: c } = await db.from('candidates').select('*').eq('id', Number(id)).maybeSingle()
  if (!c) notFound()

  const { data: applications } = await db
    .from('applications')
    .select('id, status, created_at, job_posts!applications_job_post_id_fkey(id, subject, grade, area)')
    .eq('candidate_id', c.id)
    .order('created_at', { ascending: false })

  // CVs live in a private bucket; the dashboard gets a short-lived link.
  let cvUrl: string | null = null
  if (c.cv_path) {
    const { data } = await db.storage.from('cvs').createSignedUrl(c.cv_path, 60 * 10)
    cvUrl = data?.signedUrl ?? null
  }

  const availability = (c.availability ?? {}) as Availability
  const gaps = missingFields({
    fullName: c.full_name, phone: c.phone, area: c.area, education: c.education,
    subjects: c.subjects, grades: c.grades, availability, experience: c.experience,
    expectedRate: c.expected_rate, cvPath: c.cv_path,
  })

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/candidates" className="text-sm text-neutral-500 underline underline-offset-2">
          ← Candidates
        </Link>
        <h1 className="mt-2 text-lg font-semibold">{c.full_name ?? 'Unnamed'}</h1>
        <p className="text-sm text-neutral-500">
          {c.phone ?? 'No phone'} · {c.area ?? 'Area unknown'} · {c.completeness}% complete
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Profile">
          <Row label="Gender" value={labelFor(GENDERS, c.gender)} />
          <Row label="Education" value={labelFor(EDUCATION, c.education)} />
          <Row label="Experience" value={labelFor(EXPERIENCE, c.experience)} />
          <Row
            label="Expects"
            value={c.expected_rate ? `${Number(c.expected_rate).toLocaleString()} ETB/hr` : '—'}
          />
        </Card>

        <Card title="Teaches">
          <Row label="Subjects" value={(c.subjects ?? []).join(', ') || '—'} />
          <Row label="Grades" value={(c.grades ?? []).join(', ') || '—'} />
        </Card>
      </div>

      <Card title="Availability">
        {Object.keys(availability).length === 0 ? (
          <p className="text-sm text-neutral-500">Not set.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {DAYS.filter((d) => availability[d.value]?.length).map((d) => (
              <li key={d.value} className="flex gap-3">
                <span className="w-12 shrink-0 text-neutral-500">{DAY_LABEL[d.value]}</span>
                <span>{availability[d.value].map((s) => SLOT_LABEL[s] ?? s).join(', ')}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="CV">
        {cvUrl ? (
          <a href={cvUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-700 underline underline-offset-2">
            {c.cv_name ?? 'Open CV'} ↗
          </a>
        ) : (
          <p className="text-sm text-neutral-500">Not uploaded.</p>
        )}
      </Card>

      <Card title="Applications">
        {(applications?.length ?? 0) === 0 ? (
          <p className="text-sm text-neutral-500">None.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {applications!.map((a) => {
              const job = a.job_posts as unknown as { id: number; subject: string; grade: string; area: string } | null
              return (
                <li key={a.id} className="flex justify-between gap-4">
                  <Link href={job ? `/dashboard/jobs/${job.id}` : '#'} className="underline underline-offset-2">
                    {job ? `${job.subject} · ${job.grade} · ${job.area}` : 'Job removed'}
                  </Link>
                  <span className="text-xs text-neutral-500">{a.status}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {gaps.length > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Still missing: {gaps.join(', ')}.
        </p>
      )}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-neutral-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-medium">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-0.5 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}
