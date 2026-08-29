import { describe, expect, it } from 'vitest'
import { mainMenu, languageKeyboard } from '@/lib/bot/keyboards'

/**
 * The non-negotiable rule: no button may route a message to a human expecting
 * a reply. This test fails the build if one is ever added.
 */
const FORBIDDEN = /talk to (a )?human|contact (the )?(admin|operator|owner)|message us|call us|chat with/i

describe('keyboards', () => {
  it('offers both languages', () => {
    const rows = languageKeyboard().inline_keyboard
    const data = rows.flat().map((b) => ('callback_data' in b ? b.callback_data : ''))
    expect(data).toEqual(['lang:am', 'lang:en'])
  })

  it('never offers a route to a human', () => {
    for (const lang of ['am', 'en'] as const) {
      for (const button of mainMenu(lang).inline_keyboard.flat()) {
        expect(button.text).not.toMatch(FORBIDDEN)
      }
    }
  })

  it('is entirely callback buttons — no free-text branch', () => {
    for (const button of mainMenu('en').inline_keyboard.flat()) {
      expect(button).toHaveProperty('callback_data')
    }
  })
})
