import { describe, expect, it } from 'vitest'
import { parentConnectLink, parentPayload, parseParentPayload } from '@/lib/messaging/connect'
import { parseApplyPayload } from '@/lib/jobs/apply-link'
import { parentBotCopy } from '@/lib/messaging/parent-bot'

describe('the parent connect link', () => {
  it('builds a link a parent can tap once', () => {
    expect(parentConnectLink('misaletutoragentbot', 7))
      .toBe('https://t.me/misaletutoragentbot?start=parent_7')
    expect(parentConnectLink('@misaletutoragentbot', 7))
      .toBe('https://t.me/misaletutoragentbot?start=parent_7')
  })

  it('round-trips', () => {
    for (const id of [1, 7, 999999]) {
      expect(parseParentPayload(parentPayload(id))).toBe(id)
    }
  })

  it('refuses anything it does not recognise', () => {
    for (const bad of ['', 'parent_', 'parent_abc', 'parents_1', 'job_1', undefined, null]) {
      expect(parseParentPayload(bad), String(bad)).toBeNull()
    }
  })

  // The two deep links share one /start handler, so they must never collide.
  it('cannot be confused with a tutor apply link', () => {
    expect(parseApplyPayload('parent_7')).toBeNull()
    expect(parseParentPayload('job_7_1')).toBeNull()
  })

  it('fits Telegram\'s 64-character start payload at any real id', () => {
    expect(parentPayload(2_000_000_000).length).toBeLessThanOrEqual(64)
  })
})

describe('what a parent is told', () => {
  it('is Amharic', () => {
    for (const m of [parentBotCopy.connected('ማሪቱ'), parentBotCopy.alreadyConnected, parentBotCopy.notFound]) {
      expect(m).toMatch(/[ሀ-፿]/)
    }
  })

  it('says plainly that nobody reads a reply', () => {
    expect(parentBotCopy.connected('ማሪቱ')).toContain('መልስ መስጠት አያስፈልግም')
    expect(parentBotCopy.nothingToReply).toContain('መልስ አይነበብም')
  })
})
