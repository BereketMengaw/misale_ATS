import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageHeader, PageShell } from '@/components/ui'
import { JobForm } from '../../new/job-form'
import { updateJob } from '../../actions'

export const dynamic = 'force-dynamic'

/**
 * Correcting a job after it exists.
 *
 * The gender preference in particular is a hard filter on who may be asked, so
 * getting it wrong once used to make a job unfillable with no way out of the
 * dashboard.
 */
export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const jobId = Number(id)
  if (!Number.isInteger(jobId)) notFound()

  const db = supabaseAdmin()

  const { data: job } = await db
    .from('job_posts')
    .select('id, subject, grade, area, days_per_week, hours_per_session, rate_amount, rate_period, gender_pref, starts_on, notes, commission_percent, body_edited, status')
    .eq('id', jobId)
    .maybeSingle()
  if (!job) notFound()

  const [{ count: applicants }, { count: publications }] = await Promise.all([
    db.from('applications').select('id', { count: 'exact', head: true }).eq('job_post_id', jobId),
    db.from('post_publications').select('id', { count: 'exact', head: true }).eq('job_post_id', jobId),
  ])

  const warnings: string[] = []
  if ((applicants ?? 0) > 0) {
    warnings.push(
      `${applicants} ${applicants === 1 ? 'person has' : 'people have'} already applied. Changing the pay or the gender preference changes who is eligible, and anyone already told the old terms is not told again.`,
    )
  }
  if ((publications ?? 0) > 0) {
    warnings.push(
      `This is posted to ${publications} ${publications === 1 ? 'channel' : 'channels'}. Those posts keep the text they were published with — only a fresh publish carries the new one.`,
    )
  }
  warnings.push(
    job.body_edited
      ? 'You edited this post by hand, so the text is left exactly as it is. Check it still matches the fields.'
      : 'The post will be rewritten from these fields.',
  )
  warnings.push('Saving clears the approval, so you read the post once more before it goes anywhere new.')

  return (
    <PageShell width="narrow">
      <PageHeader
        back={{ href: `/dashboard/jobs/${jobId}`, label: `${job.subject} · ${job.grade}` }}
        title="Edit the job"
        subtitle="The facts behind the post. Everything here decides who can apply and what they are paid."
      />

      <ul className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>

      <JobForm
        action={updateJob}
        submitLabel="Save the job"
        pendingLabel="Saving…"
        initial={{
          id: job.id,
          subject: job.subject,
          grade: job.grade,
          area: job.area,
          daysPerWeek: job.days_per_week,
          hoursPerSession: job.hours_per_session,
          rateAmount: Number(job.rate_amount),
          ratePeriod: job.rate_period,
          genderPref: job.gender_pref,
          startsOn: job.starts_on,
          notes: job.notes,
          commissionPercent: Number(job.commission_percent),
        }}
      />
    </PageShell>
  )
}
