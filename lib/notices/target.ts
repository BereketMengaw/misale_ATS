/**
 * Which placement a tutor is giving notice on.
 *
 * This was one line in the service and it was wrong twice over:
 *
 *   .order('created_at', { ascending: false }).limit(1)
 *
 * The most recent placement, whatever it is. A tutor who finished a job in
 * March and is stopping their current one filed against the finished one; a
 * tutor holding two live jobs — which the knowledge base explicitly tells them
 * they may — filed against whichever was hired last. Both put the wrong family
 * on the operator's desk, and the right family finds out when the tutor stops
 * turning up.
 *
 * The rule is: never guess between two live placements. There is exactly one
 * honest question here — which one — and it is answerable with buttons, so the
 * design rule has nothing to say against asking it.
 *
 * Pure. Rows in, decision out — no I/O.
 */

/** Not 'ended'. A finished placement cannot be left; there is nothing to leave. */
export const LIVE_STATUSES = ['scheduled', 'active', 'paused'] as const

export type PlacementRow = {
  id: number
  status: string
  subject: string | null
  grade: string | null
  area: string | null
}

export function isLive(status: string | null | undefined): boolean {
  return LIVE_STATUSES.includes(status as (typeof LIVE_STATUSES)[number])
}

/**
 * How a placement is named to the person who teaches it. Their own job, in the
 * words they were hired under — a row id means nothing to a tutor.
 */
export function placementLabel(p: PlacementRow): string {
  const parts = [p.subject, p.grade, p.area].filter((s): s is string => Boolean(s && s.trim()))
  return parts.length ? parts.join(' · ') : `Placement #${p.id}`
}

export type NoticeTarget =
  /** Nothing live to leave. The question is hypothetical and the FAQ answers it. */
  | { kind: 'none' }
  /** Exactly one, so no question needs asking. */
  | { kind: 'one'; placement: PlacementRow }
  /** More than one. Ask; do not pick. */
  | { kind: 'which'; placements: PlacementRow[] }

export function noticeTarget(placements: PlacementRow[]): NoticeTarget {
  const live = placements.filter((p) => isLive(p.status))
  if (live.length === 0) return { kind: 'none' }
  if (live.length === 1) return { kind: 'one', placement: live[0] }
  return { kind: 'which', placements: live }
}
