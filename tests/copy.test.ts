import { describe, expect, it } from 'vitest'
import { copy, JOBS_GROUP } from '@/lib/bot/copy'

/** Everything the bot says, flattened. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}

describe('bot copy', () => {
  it('says something for every key', () => {
    const all = strings(copy)
    expect(all.length).toBeGreaterThan(5)
    for (const s of all) expect(s.trim()).not.toBe('')
  })

  // The project is English-only. This fails the build if Amharic creeps back in.
  it('is English only', () => {
    for (const s of strings(copy)) {
      expect(s).not.toMatch(/[ሀ-፿]/)
    }
  })

  it('never promises a reply from a person', () => {
    const forbidden = /we will (call|reply|get back)|contact us|reach out to us/i
    for (const s of strings(copy)) expect(s).not.toMatch(forbidden)
  })

  // The group the operator sent 122 people by hand. One constant, so a changed
  // link changes everywhere at once rather than in the three places it is said.
  it('names the jobs group from one place', () => {
    const mentions = strings(copy).filter((s) => s.includes('@'))
    expect(mentions.length).toBeGreaterThan(2)
    for (const s of mentions) expect(s).toContain(JOBS_GROUP)
  })

  // A link the model wrote would be rejected by rejectAnswer(), so links live
  // only in copy the code sends verbatim — never in the knowledge base.
  it('keeps links out of anything a model rewrites', async () => {
    const { KNOWLEDGE } = await import('@/lib/bot/answers/knowledge')
    for (const entry of KNOWLEDGE) {
      expect(entry.answer, entry.id).not.toMatch(/https?:\/\/|t\.me\/|@[a-z0-9_]{4,}/i)
    }
  })
})
