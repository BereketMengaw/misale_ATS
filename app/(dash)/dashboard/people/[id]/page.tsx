import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { DAYS, EDUCATION, EXPERIENCE, GENDERS, labelFor, SLOTS } from '@/lib/candidates/options'
import { missingFields } from '@/lib/candidates/completeness'
import type { Availability } from '@/lib/candidates/availability'
import { applicationLabel, prepaymentLabel } from '@/lib/ui/labels'
import { Badge, Card, CardHead, Meter, PageHeader, PageShell } from '@/components/ui'
import { destinationLabel, isPayable, type PayoutProvider } from '@/lib/candidates/payout-details'
import { prepaymentStage } from '@/lib/money/prepayment'
import { formatEtb } from '@/lib/money/commission'
import { DestinationForm } from './destination-form'

export const dynamic = 'force-dynamic'

const DAY_LABEL = Object.fromEntries(DAYS.map((d) => [d.value, d.label]))
const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.value, s.label]))

export default async function TutorPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Degrees and transcripts, in the same private bucket under a different
  // prefix. Signed one by one: a link that outlives the page is a leak.
  const { data: documentRows } = await db
    .from('candidate_documents')
    .select('id, path, file_name, mime')
    .eq('candidate_id', c.id)
    .order('created_at', { ascending: true })

  const documents: { id: number; name: string; url: string | null }[] = []
  for (const row of documentRows ?? []) {
    const { data } = await db.storage.from('cvs').createSignedUrl(row.path as string, 60 * 10)
    documents.push({
      id: row.id as number,
      name: (row.file_name as string) ?? 'Document',
      url: data?.signedUrl ?? null,
    })
  }

  // Their side of the money: where they are paid, and what they owe up front.
  const [{ data: prepayments }, { data: payouts }] = await Promise.all([
    db
      .from('prepayments')
      .select('id, amount_cents, reference, status, due_on, notified_at, paid_at')
      .eq('candidate_id', c.id)
      .order('due_on'),
    db
      .from('payouts')
      .select('id, net_cents, status')
      .eq('candidate_id', c.id),
  ])

  const now = new Date()
  const owedToThem = (payouts ?? [])
    .filter((p) => p.status === 'due')
    .reduce((t, p) => t + Number(p.net_cents), 0)

  const destination = {
    provider: (c.payout_provider ?? null) as PayoutProvider | null,
    account: (c.payout_account ?? null) as string | null,
    name: (c.payout_name ?? null) as string | null,
    bank: (c.payout_bank ?? null) as string | null,
  }

  const availability = (c.availability ?? {}) as Availability
  const gaps = missingFields({
    fullName: c.full_name, phone: c.phone, area: c.area, education: c.education,
    subjects: c.subjects, grades: c.grades, availability, experience: c.experience,
    expectedRate: c.expected_rate, cvPath: c.cv_path,
  })

  return (
    <PageShell width="narrow">
      <PageHeader
        back={{ href: '/dashboard/people', label: 'People' }}
        title={c.full_name ?? 'Unnamed'}
        subtitle={[c.phone ?? 'No phone', c.area ?? 'Area unknown'].join(' · ')}
        aside={<Meter value={c.completeness} label={`${c.completeness}% of a complete profile`} />}
      />

      {gaps.length > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Still missing: {gaps.join(', ')}.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <CardHead title="Profile" className="mb-2" />
          <Row label="Gender" value={labelFor(GENDERS, c.gender)} />
          <Row label="Education" value={labelFor(EDUCATION, c.education)} />
          <Row label="Experience" value={labelFor(EXPERIENCE, c.experience)} />
          <Row
            label="Expects"
            value={c.expected_rate ? `${Number(c.expected_rate).toLocaleString()} ETB/hr` : '—'}
          />
        </Card>

        <Card className="p-4">
          <CardHead title="Teaches" className="mb-2" />
          <Row label="Subjects" value={(c.subjects ?? []).join(', ') || '—'} />
          <Row label="Grades" value={(c.grades ?? []).join(', ') || '—'} />
        </Card>
      </div>

      <Card className="p-4">
        <CardHead title="Availability" className="mb-2" />
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

      <Card className="p-4">
        <CardHead title="CV" className="mb-2" />
        {cvUrl ? (
          <a href={cvUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-700 underline underline-offset-2">
            {c.cv_name ?? 'Open CV'} ↗
          </a>
        ) : (
          <p className="text-sm text-neutral-500">Not uploaded.</p>
        )}
      </Card>

      <Card className="p-4">
        <CardHead title="Educational documents" className="mb-2" />
        {documents.length === 0 ? (
          <p className="text-sm text-neutral-500">None sent.</p>
        ) : (
          <ul className="space-y-1">
            {documents.map((d) => (
              <li key={d.id}>
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-sm text-blue-700 underline underline-offset-2">
                    {d.name} ↗
                  </a>
                ) : (
                  <span className="text-sm text-neutral-500">{d.name} — could not be opened</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Where the money goes, and what they owe. The account is shown in full
          rather than masked: this is the page the operator copies it from to
          make the transfer, and a masked number cannot be copied. */}
      <Card className="p-4">
        <CardHead title="Money" className="mb-2" />

        {isPayable(destination) ? (
          <>
            <Row
              label="Paid into"
              value={`${destinationLabel(destination.provider, destination.bank)} ${destination.account}`}
            />
            <Row label="Name on the account" value={destination.name ?? '—'} />
          </>
        ) : (
          <p className="text-sm text-amber-700">
            No account on file, so nothing can be paid out to them. The bot asks for this at the
            hire — if they never answered, enter it below.
          </p>
        )}

        {owedToThem > 0 && (
          <Row label="Owed to them now" value={`${formatEtb(owedToThem)} ETB`} />
        )}

        <DestinationForm
          candidateId={c.id}
          provider={destination.provider}
          account={destination.account}
          name={destination.name}
          bank={destination.bank}
        />

        <div className="mt-4 border-t border-neutral-100 pt-3">
          <p className="mb-1 text-xs font-medium text-neutral-500">Pre-payment</p>
          {(prepayments?.length ?? 0) === 0 ? (
            <p className="text-sm text-neutral-500">
              None owed. One is raised at each hire, for the placement that was agreed.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {prepayments!.map((r) => {
                const stage = prepaymentStage(
                  {
                    status: r.status,
                    dueOn: new Date(`${r.due_on}T00:00:00Z`),
                    paidAt: r.paid_at ? new Date(r.paid_at) : null,
                    notified: Boolean(r.notified_at),
                  },
                  now,
                )
                const label = prepaymentLabel(stage)
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3">
                    <span>
                      {formatEtb(Number(r.amount_cents))} ETB
                      <span className="ml-2 font-mono text-xs text-neutral-400">{r.reference}</span>
                      <span className="ml-2 text-xs text-neutral-400">due {r.due_on}</span>
                    </span>
                    <Badge tone={label.tone}>{label.label}</Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <CardHead title="Applications" className="mb-2" />
        {(applications?.length ?? 0) === 0 ? (
          <p className="text-sm text-neutral-500">None.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {applications!.map((a) => {
              const job = a.job_posts as unknown as { id: number; subject: string; grade: string; area: string } | null
              const stage = applicationLabel(a.status)
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3">
                  <Link href={job ? `/dashboard/jobs/${job.id}` : '#'} className="underline underline-offset-2">
                    {job ? `${job.subject} · ${job.grade} · ${job.area}` : 'Job removed'}
                  </Link>
                  <Badge tone={stage.tone}>{stage.label}</Badge>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </PageShell>
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
