import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function JobsPage() {
  const { data: jobs, error } = await supabaseAdmin()
    .from('job_posts')
    .select('id, subject, grade, area, status, approved_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Jobs</h1>
          <p className="text-sm text-neutral-500">Drafts and posts.</p>
        </div>
        <Link
          href="/dashboard/jobs/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          New job post
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {!error && (jobs?.length ?? 0) === 0 && (
        <p className="rounded-md border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
          No jobs yet.
        </p>
      )}

      {(jobs?.length ?? 0) > 0 && (
        <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white">
          {jobs!.map((job) => (
            <li key={job.id}>
              <Link href={`/dashboard/jobs/${job.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-neutral-50">
                <div>
                  <p className="text-sm font-medium">
                    {job.subject} · {job.grade}
                  </p>
                  <p className="text-xs text-neutral-500">{job.area}</p>
                </div>
                <span className="text-xs text-neutral-500">
                  {job.approved_at ? 'Approved' : job.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
