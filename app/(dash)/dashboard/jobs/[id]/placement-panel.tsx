import Link from 'next/link'
import { formatEtb, split } from '@/lib/money/commission'
import { placementLabel } from '@/lib/ui/labels'
import type { Schedule } from '@/lib/placements/schedule'
import { Badge } from '@/components/ui'
import { ScheduleForm } from './schedule-form'

export type PlacementRow = {
  id: number
  status: string
  schedule: Schedule | null
  starts_on: string | null
  ends_on: string | null
  rate_amount: number | string
  commission_percent: number | string
  candidates: unknown
  clients: unknown
}

/**
 * What was agreed once the tutor was hired. This used to be a page of its own
 * that repeated the job's tutor, parent and money split — the same three
 * numbers rendered twice, in two files.
 */
export function PlacementPanel({ placement }: { placement: PlacementRow }) {
  const tutor = placement.candidates as { id: number; full_name: string | null; phone: string | null } | null
  const client = placement.clients as { full_name: string; phone: string | null } | null
  const money = split(Number(placement.rate_amount), Number(placement.commission_percent))
  const status = placementLabel(placement.status)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={status.tone}>{status.label}</Badge>
        <span className="text-sm text-neutral-600">
          Tutor keeps {formatEtb(money.netCents)} ETB · you keep {formatEtb(money.commissionCents)} ETB
        </span>
      </div>

      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">Tutor</dt>
          <dd>
            {tutor?.id ? (
              <Link href={`/dashboard/people/${tutor.id}`} className="underline underline-offset-2">
                {tutor.full_name}
              </Link>
            ) : (
              '—'
            )}
            {tutor?.phone && ` · ${tutor.phone}`}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">Parent</dt>
          <dd>{client ? `${client.full_name}${client.phone ? ` · ${client.phone}` : ''}` : '—'}</dd>
        </div>
      </dl>

      <div className="border-t border-neutral-100 pt-4">
        <p className="text-sm font-medium">Agreed schedule</p>
        <p className="mb-3 text-xs text-neutral-500">
          A note of what was arranged. Nothing is sent and nobody is reminded.
        </p>
        <ScheduleForm
          placementId={placement.id}
          current={placement.schedule}
          startsOn={placement.starts_on}
          endsOn={placement.ends_on}
        />
      </div>
    </div>
  )
}
