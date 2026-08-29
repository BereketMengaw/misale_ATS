/**
 * The parent's one-time connect link. PURE.
 *
 * A bot cannot message someone who has never started it (docs/01-overview.md),
 * so a parent has to tap once. After that tap everything reaches them
 * automatically and free — and Amharic stops costing 70 characters a segment,
 * because Telegram has no segments.
 *
 *   t.me/<bot>?start=parent_<clientId>
 */

export function parentPayload(clientId: number): string {
  return `parent_${clientId}`
}

export function parentConnectLink(botUsername: string, clientId: number): string {
  return `https://t.me/${botUsername.replace(/^@/, '')}?start=${parentPayload(clientId)}`
}

/** Reads what /start hands back. Null for anything unrecognised. */
export function parseParentPayload(payload: string | undefined | null): number | null {
  if (!payload) return null
  const match = /^parent_(\d+)$/.exec(payload.trim())
  return match ? Number(match[1]) : null
}
