/**
 * The Apply deep link. Pure — this is the one string that ties a channel post
 * to an applicant, so it is tested rather than trusted.
 *
 *   t.me/<bot>?start=job_<jobId>_<publicationId>
 *
 * Telegram start payloads allow A-Za-z0-9_- only, up to 64 characters.
 * The publication id is what tells us which channel an applicant came from.
 */

export const START_PAYLOAD_MAX = 64

export function applyPayload(jobId: number, publicationId?: number | null): string {
  return publicationId ? `job_${jobId}_${publicationId}` : `job_${jobId}`
}

export function applyLink(
  botUsername: string,
  jobId: number,
  publicationId?: number | null,
): string {
  const payload = applyPayload(jobId, publicationId)
  if (payload.length > START_PAYLOAD_MAX) {
    throw new Error(`Apply payload too long for Telegram: ${payload}`)
  }
  return `https://t.me/${botUsername.replace(/^@/, '')}?start=${payload}`
}

export type ParsedPayload = { jobId: number; publicationId: number | null }

/** Reads what /start hands us back. Returns null for anything unrecognised. */
export function parseApplyPayload(payload: string | undefined | null): ParsedPayload | null {
  if (!payload) return null
  const match = /^job_(\d+)(?:_(\d+))?$/.exec(payload.trim())
  if (!match) return null
  return {
    jobId: Number(match[1]),
    publicationId: match[2] ? Number(match[2]) : null,
  }
}
