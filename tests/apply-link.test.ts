import { describe, expect, it } from 'vitest'
import { applyLink, applyPayload, parseApplyPayload, START_PAYLOAD_MAX } from '@/lib/jobs/apply-link'

describe('apply deep link', () => {
  it('carries the job and the publication', () => {
    expect(applyPayload(12, 3)).toBe('job_12_3')
    expect(applyLink('ethiotutorsbot', 12, 3)).toBe('https://t.me/ethiotutorsbot?start=job_12_3')
  })

  it('works without a publication, for a link not tied to a channel', () => {
    expect(applyPayload(12, null)).toBe('job_12')
    expect(applyLink('@ethiotutorsbot', 12)).toBe('https://t.me/ethiotutorsbot?start=job_12')
  })

  it('round-trips through what /start hands back', () => {
    for (const [job, pub] of [
      [1, 1],
      [12, 3],
      [999999, 123456],
    ] as const) {
      expect(parseApplyPayload(applyPayload(job, pub))).toEqual({
        jobId: job,
        publicationId: pub,
      })
    }
    expect(parseApplyPayload('job_7')).toEqual({ jobId: 7, publicationId: null })
  })

  it('refuses anything it does not recognise', () => {
    for (const bad of ['', '   ', 'job_', 'job_abc', 'jobs_1', 'job_1_2_3', '1_2', undefined, null]) {
      expect(parseApplyPayload(bad)).toBeNull()
    }
  })

  it('stays inside Telegram\'s payload limit at realistic ids', () => {
    expect(applyPayload(2_000_000_000, 2_000_000_000).length).toBeLessThanOrEqual(START_PAYLOAD_MAX)
  })
})
