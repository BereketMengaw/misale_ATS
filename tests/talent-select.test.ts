import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES, selectForDm, type PoolCandidate } from '@/lib/talent/select'

const NOW = new Date('2026-09-01T12:00:00Z')

function person(over: Partial<PoolCandidate> & { candidateId: number }): PoolCandidate {
  return {
    score: 80, excluded: false, hasApplied: false, alreadyMatched: false,
    lastDmAt: null, reachable: true, ...over,
  }
}

describe('who gets a talent-pool DM', () => {
  it('messages a strong match who has done nothing yet', () => {
    const { chosen } = selectForDm([person({ candidateId: 1 })], DEFAULT_RULES, NOW)
    expect(chosen.map((c) => c.candidateId)).toEqual([1])
  })

  it('never messages someone who already applied', () => {
    const { chosen, skipped } = selectForDm([person({ candidateId: 1, hasApplied: true })], DEFAULT_RULES, NOW)
    expect(chosen).toEqual([])
    expect(skipped[0].reason).toBe('already applied')
  })

  it('never messages twice about the same job', () => {
    const { chosen } = selectForDm([person({ candidateId: 1, alreadyMatched: true })], DEFAULT_RULES, NOW)
    expect(chosen).toEqual([])
  })

  it('skips someone the job excludes', () => {
    const { chosen } = selectForDm([person({ candidateId: 1, excluded: true })], DEFAULT_RULES, NOW)
    expect(chosen).toEqual([])
  })

  it('skips someone the bot has never been able to reach', () => {
    const { chosen } = selectForDm([person({ candidateId: 1, reachable: false })], DEFAULT_RULES, NOW)
    expect(chosen).toEqual([])
  })

  it('skips a weak match rather than filling the quota with noise', () => {
    const { chosen, skipped } = selectForDm([person({ candidateId: 1, score: 40 })], DEFAULT_RULES, NOW)
    expect(chosen).toEqual([])
    expect(skipped[0].reason).toContain('below 60')
  })

  it('respects the cooldown however well someone matches', () => {
    const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const { chosen, skipped } = selectForDm(
      [person({ candidateId: 1, score: 100, lastDmAt: yesterday })], DEFAULT_RULES, NOW,
    )
    expect(chosen).toEqual([])
    expect(skipped[0].reason).toContain('messaged recently')
  })

  it('messages again once the cooldown has passed', () => {
    const longAgo = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const { chosen } = selectForDm([person({ candidateId: 1, lastDmAt: longAgo })], DEFAULT_RULES, NOW)
    expect(chosen).toHaveLength(1)
  })

  it('keeps the strongest when the cap bites, not the earliest', () => {
    const pool = [
      person({ candidateId: 1, score: 65 }),
      person({ candidateId: 2, score: 95 }),
      person({ candidateId: 3, score: 80 }),
    ]
    const { chosen } = selectForDm(pool, { ...DEFAULT_RULES, maxPerJob: 2 }, NOW)
    expect(chosen.map((c) => c.candidateId)).toEqual([2, 3])
  })

  it('says why about everyone it skipped', () => {
    const pool = [
      person({ candidateId: 1, hasApplied: true }),
      person({ candidateId: 2, score: 10 }),
      person({ candidateId: 3, reachable: false }),
    ]
    const { skipped } = selectForDm(pool, DEFAULT_RULES, NOW)
    expect(skipped).toHaveLength(3)
    for (const s of skipped) expect(s.reason.length).toBeGreaterThan(0)
  })

  it('sends nothing at all rather than something bad', () => {
    expect(selectForDm([], DEFAULT_RULES, NOW).chosen).toEqual([])
  })
})
