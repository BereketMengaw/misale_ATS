import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { describeSchedule, type Schedule } from '@/lib/placements/schedule'
import { formatEtb, split } from '@/lib/money/commission'
import { ScheduleForm } from './schedule-form'

export const dynamic = 'force-dynamic'

export default async function PlacementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: p } = await supabaseAdmin()
    .from('placements')
    .select('*, candidates(id, full_name, phone), clients(full_name, phone), job_posts(id, subject, grade, area)')
    .eq('id', Number(id))
    .maybeSingle()
  if (!p) notFound()

  const tutor = p.candidates as unknown as { id: number; full_name: string | null; phone: string | null } | null
  const client = p.clients as unknown as { full_name: string; phone: string | null } | null
  const job = p.job_posts as unknown as { id: number; subject: string; grade: string; area: string } | null

  const schedule = p.schedule as Schedule | null
  const money = split(Number(p.rate_amount), Number(p.commission_percent))
  const period = String(p.rate_period).replace('per_', 'per ')

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
          {job ? `${job.subject} · ${job.grade} · ${job.area}` : ''} · {describeSchedule(schedule)}
        </p>
      </div>

      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium">Money, every {period.replace('per ', '')}</h2>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-neutral-500">Parent pays</dt>
            <dd className="font-medium tabular-nums">{formatEtb(money.grossCents)} ETB</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-neutral-500">Tutor gets</dt>
            <dd className="font-medium tabular-nums">{formatEtb(money.netCents)} ETB</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-neutral-500">You keep ({Number(p.commission_percent)}%)</dt>
            <dd className="font-medium tabular-nums text-green-800">{formatEtb(money.commissionCents)} ETB</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-medium">Agreed schedule</h2>
        <p className="mb-3 text-xs text-neutral-500">
          A note of what was arranged. Nothing is sent and nobody is reminded.
        </p>
        <ScheduleForm
          placementId={p.id}
          current={schedule}
          startsOn={p.starts_on}
          endsOn={p.ends_on}
        />
      </section>

      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium">Contacts</h2>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Tutor</dt>
            <dd>
              {tutor?.id ? (
                <Link href={`/dashboard/candidates/${tutor.id}`} className="underline underline-offset-2">
                  {tutor.full_name}
                </Link>
              ) : '—'}
              {tutor?.phone && ` · ${tutor.phone}`}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Parent</dt>
            <dd>{client ? `${client.full_name}${client.phone ? ` · ${client.phone}` : ''}` : '—'}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
