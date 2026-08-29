import { PageHeader, PageShell } from '@/components/ui'
import { JobForm } from './job-form'

export default function NewJobPage() {
  return (
    <PageShell width="narrow">
      <PageHeader
        back={{ href: '/dashboard/jobs', label: 'Jobs' }}
        title="New job post"
        subtitle="Answer the fields; the post writes itself. You can edit it after."
      />
      <JobForm />
    </PageShell>
  )
}
