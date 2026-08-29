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

/**
 * The operator's own connect link.
 *
 * The dashboard is used on a laptop, but messages are sent from a phone. Once
 * the operator has tapped this, any message can be pushed to their own Telegram
 * in one click and copied there — no retyping between devices.
 *
 * The payload is the operator's uuid rather than a guessable id: anyone who
 * could guess it would start receiving the operator's messages.
 */
export function adminPayload(operatorId: string): string {
  return `admin_${operatorId}`
}

export function adminConnectLink(botUsername: string, operatorId: string): string {
  return `https://t.me/${botUsername.replace(/^@/, '')}?start=${adminPayload(operatorId)}`
}

export function parseAdminPayload(payload: string | undefined | null): string | null {
  if (!payload) return null
  const match = /^admin_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
    .exec(payload.trim())
  return match ? match[1].toLowerCase() : null
}
