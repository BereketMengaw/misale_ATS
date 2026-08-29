import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { EDUCATION, EXPERIENCE, labelFor } from '@/lib/candidates/options'

export const dynamic = 'force-dynamic'

export default async function CandidatesPage() {
  const { data: candidates, error } = await supabaseAdmin()
    .from('candidates')
    .select('id, full_name, phone, area, education, experience, subjects, grades, completeness, cv_path, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Candidates</h1>
        <p className="text-sm text-neutral-500">
          Everyone who has finished the registration wizard.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {!error && (candidates?.length ?? 0) === 0 && (
        <p className="rounded-md border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
          Nobody yet. Tap Apply on a published job from another phone.
        </p>
      )}

      {(candidates?.length ?? 0) > 0 && (
        <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white">
          {candidates!.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/candidates/${c.id}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-neutral-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {c.full_name ?? 'Unnamed'}
                    {c.cv_path && <span className="ml-2 text-xs text-neutral-400">CV</span>}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {[c.area, labelFor(EDUCATION, c.education), labelFor(EXPERIENCE, c.experience)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-neutral-400">
                    {(c.subjects ?? []).join(', ') || 'No subjects'}
                  </p>
                </div>
                <Completeness value={c.completeness} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The number the board sorts on, shown as a bar so gaps read at a glance. */
function Completeness({ value }: { value: number }) {
  const tone = value >= 85 ? 'bg-green-600' : value >= 65 ? 'bg-amber-500' : 'bg-neutral-400'
  return (
    <div className="w-24 shrink-0">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
        <div className={`h-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1 text-right text-xs tabular-nums text-neutral-400">{value}%</p>
    </div>
  )
}
