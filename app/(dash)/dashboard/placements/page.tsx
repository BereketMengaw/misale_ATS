import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function PlacementsPage() {
  const { data: placements, error } = await supabaseAdmin()
    .from('placements')
    .select('id, status, starts_on, ends_on, schedule, candidates(full_name), clients(full_name), job_posts(subject, grade, area)')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Placements</h1>
        <p className="text-sm text-neutral-500">Tutors who have been hired, and their lessons.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {(placements?.length ?? 0) === 0 && !error && (
        <p className="rounded-md border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
          None yet. A placement is created the moment you hire someone.
        </p>
      )}

      <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white">
        {placements?.map((p) => {
          const tutor = p.candidates as unknown as { full_name: string | null } | null
          const client = p.clients as unknown as { full_name: string } | null
          const job = p.job_posts as unknown as { subject: string; grade: string; area: string } | null
          const schedule = p.schedule as { days?: string[]; time?: string } | null

          return (
            <li key={p.id}>
              <Link href={`/dashboard/placements/${p.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-neutral-50">
                <div>
                  <p className="text-sm font-medium">
                    {tutor?.full_name ?? 'Tutor'} → {client?.full_name ?? 'no parent yet'}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {job ? `${job.subject} · ${job.grade} · ${job.area}` : ''}
                    {schedule?.days?.length ? ` · ${schedule.days.join(', ')} ${schedule.time}` : ' · not scheduled'}
                  </p>
                </div>
                <span className="text-xs text-neutral-500">{p.status}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
