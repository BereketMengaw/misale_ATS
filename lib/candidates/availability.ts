/**
 * The availability grid, as stored on the candidate.
 * Pure — step 6 scores overlap against a job's required days, so this has to be
 * exactly right and is tested rather than trusted.
 */

export type Availability = Record<string, string[]>

export function toggleSlot(current: Availability, day: string, slot: string): Availability {
  const next: Availability = { ...current }
  const slots = new Set(next[day] ?? [])

  slots.has(slot) ? slots.delete(slot) : slots.add(slot)

  if (slots.size === 0) delete next[day]
  else next[day] = [...slots].sort()

  return next
}

export function hasSlot(current: Availability, day: string, slot: string): boolean {
  return (current[day] ?? []).includes(slot)
}

/** How many separate day-slots the candidate offers. */
export function slotCount(current: Availability): number {
  return Object.values(current).reduce((total, slots) => total + slots.length, 0)
}

/** Days with at least one slot — what a job's days-per-week is matched against. */
export function availableDays(current: Availability): string[] {
  return Object.keys(current).filter((day) => (current[day] ?? []).length > 0)
}

export function summarise(current: Availability, dayLabels: Record<string, string>): string {
  const days = availableDays(current)
  if (days.length === 0) return 'Not set'
  return days.map((d) => `${dayLabels[d] ?? d} (${(current[d] ?? []).length})`).join(', ')
}

/**
 * The grid taken back apart into the two answers that built it. PURE.
 *
 * The wizard asks days and times separately and `draftAvailability` writes the
 * same times to every chosen day. Editing has to reverse that: a tutor changing
 * their area must get their existing days and times back exactly, because the
 * whole draft is written on save and anything this drops is silently erased.
 *
 * Days keep the grid's own order. Times are the union across days — with a
 * grid this function's own writer produced, every day holds the same set, so
 * the union is that set. A grid edited elsewhere may not, and taking the union
 * rather than one day's slots is what stops an edit narrowing somebody's
 * availability behind their back.
 */
export function splitAvailability(current: Availability): { days: string[]; times: string[] } {
  const days = availableDays(current)
  const times = [...new Set(days.flatMap((d) => current[d] ?? []))].sort()
  return { days, times }
}
