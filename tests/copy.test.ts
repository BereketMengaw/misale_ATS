import { describe, expect, it } from 'vitest'
import { copy, t } from '@/lib/bot/copy'

describe('bilingual copy', () => {
  it('returns one language when we know it', () => {
    expect(t(copy.menu, 'am')).toBe(copy.menu.am)
    expect(t(copy.menu, 'en')).toBe(copy.menu.en)
  })

  it('stacks both when we do not', () => {
    const both = t(copy.menu)
    expect(both).toContain(copy.menu.am)
    expect(both).toContain(copy.menu.en)
  })

  it('has an Amharic string for every English one', () => {
    const entries = Object.values(copy).filter(
      (v): v is { am: string; en: string } =>
        typeof v === 'object' && 'am' in v && 'en' in v && typeof v.am === 'string',
    )
    expect(entries.length).toBeGreaterThan(0)
    for (const e of entries) {
      expect(e.am.trim()).not.toBe('')
      expect(e.en.trim()).not.toBe('')
      // Amharic copy that is byte-identical to English was never written.
      expect(e.am).not.toBe(e.en)
    }
  })
})
