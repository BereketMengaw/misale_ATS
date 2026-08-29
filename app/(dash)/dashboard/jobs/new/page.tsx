import Link from 'next/link'
import { JobForm } from './job-form'

export default function NewJobPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/jobs" className="text-sm text-neutral-500 underline underline-offset-2">
          ← Jobs
        </Link>
        <h1 className="mt-2 text-lg font-semibold">New job post</h1>
        <p className="text-sm text-neutral-500">
          Answer the fields; the post writes itself in both languages. You can edit it after.
        </p>
      </div>
      <JobForm />
    </div>
  )
}
