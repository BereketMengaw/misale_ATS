import { describe, expect, it } from 'vitest'
import { copy } from '@/lib/bot/copy'

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
})
