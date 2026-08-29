import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { formatEat } from '@/lib/placements/schedule'
import { formatEtb, split, toCents } from '@/lib/money/commission'
import { ScheduleForm } from './schedule-form'
import { confirmSessionByHand } from '../actions'

export const dynamic = 'force-dynamic'

const STATUS_TONE: Record<string, string> = {
  scheduled: 'text-neutral-500',
  reminded: 'text-blue-700',
  confirmed: 'text-green-700',
  missed: 'text-amber-700',
  cancelled: 'text-neutral-400',
}

export default async function PlacementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = supabaseAdmin()

  const { data: p } = await db
    .from('placements')
    .select('*, candidates(id, full_name, phone), clients(full_name, phone), job_posts(id, subject, grade, area)')
    .eq('id', Number(id))
    .maybeSingle()
  if (!p) notFound()

  const { data: sessions } = await db
    .from('sessions')
    .select('id, scheduled_at, planned_hours, confirmed_hours, status, reminder_sent_at, confirmed_at')
    .eq('placement_id', p.id)
    .order('scheduled_at', { ascending: true })

  const tutor = p.candidates as unknown as { id: number; full_name: string | null; phone: string | null } | null
  const client = p.clients as unknown as { full_name: string; phone: string | null } | null
  const job = p.job_posts as unknown as { id: number; subject: string; grade: string; area: string } | null

  const rows = sessions ?? []
  const confirmed = rows.filter((s) => s.status === 'confirmed')
  const confirmedHours = confirmed.reduce((t, s) => t + Number(s.confirmed_hours ?? 0), 0)

  // Only confirmed hours are billable — docs/05-money.md.
  const perHour = p.rate_period === 'per_hour' ? Number(p.rate_amount) : null
  const grossCents = perHour ? toCents(perHour * confirmedHours) : null
  const money = grossCents !== null ? split(grossCents / 100, Number(p.commission_percent)) : null

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/placements" className="text-sm text-neutral-500 underline underline-offset-2">
          ← Placements
        </Link>
        <h1 className="mt-2 text-lg font-semibold">
          {tutor?.full_name ?? 'Tutor'} → {client?.full_name ?? 'no parent'}
        </h1>
        <p className="text-sm text-neutral-500">
          {job ? `${job.subject} · ${job.grade} · ${job.area}` : ''} · {Number(p.rate_amount).toLocaleString()} ETB{' '}
          {p.rate_period.replace('per_', 'per ')} · {p.commission_percent}% commission
        </p>
      </div>

      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium">Schedule</h2>
        <ScheduleForm
          placementId={p.id}
          current={p.schedule as { days?: string[]; time?: string; hours?: number } | null}
          startsOn={p.starts_on}
          endsOn={p.ends_on}
        />
      </section>

      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">Lessons</h2>
          <p className="text-xs text-neutral-500">
            {confirmed.length} of {rows.length} confirmed · {confirmedHours} hours
            {money && ` · ${formatEtb(money.grossCents)} ETB billable`}
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No lessons scheduled yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100 text-sm">
            {rows.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span>{formatEat(new Date(s.scheduled_at))}</span>
                <span className="flex items-center gap-3">
                  <span className={`text-xs ${STATUS_TONE[s.status] ?? ''}`}>
                    {s.status === 'confirmed'
                      ? `${s.confirmed_hours}h confirmed`
                      : s.status === 'missed'
                        ? 'did not happen'
                        : s.status === 'reminded'
                          ? 'reminded'
                          : `${s.planned_hours}h planned`}
                  </span>
                  {!s.confirmed_at && (
                    <form action={confirmSessionByHand} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="sessionId" value={s.id} />
                      <input
                        name="hours"
                        type="number"
                        step="0.5"
                        min={0}
                        max={12}
                        defaultValue={Number(s.planned_hours)}
                        className="w-16 rounded border border-neutral-300 px-1.5 py-0.5 text-xs"
                      />
                      <button className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600">
                        Record
                      </button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {money && (
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-neutral-100 pt-3 text-sm">
            <div className="flex gap-2"><dt className="text-neutral-500">Parent owes</dt><dd className="font-medium tabular-nums">{formatEtb(money.grossCents)} ETB</dd></div>
            <div className="flex gap-2"><dt className="text-neutral-500">Tutor earns</dt><dd className="font-medium tabular-nums">{formatEtb(money.netCents)} ETB</dd></div>
            <div className="flex gap-2"><dt className="text-neutral-500">You keep</dt><dd className="font-medium tabular-nums text-green-800">{formatEtb(money.commissionCents)} ETB</dd></div>
          </dl>
        )}
      </section>
    </div>
  )
}
