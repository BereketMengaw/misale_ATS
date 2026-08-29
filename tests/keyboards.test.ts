import { describe, expect, it } from 'vitest'
import { applyKeyboard, mainMenu, openJobsKeyboard } from '@/lib/bot/keyboards'
import type { OpenJob } from '@/lib/bot/jobs'

/**
 * The non-negotiable rule: no button may route a message to a human expecting
 * a reply. This test fails the build if one is ever added.
 */
const FORBIDDEN = /talk to (a )?human|contact (the )?(admin|operator|owner)|message us|call us|chat with/i

const job: OpenJob = {
  id: 7,
  subject: 'Physics',
  grade: 'Grade 11',
  area: 'Piassa',
  body: 'body',
  status: 'open',
  expires_at: null,
}

describe('keyboards', () => {
  it('never offers a route to a human', () => {
    const buttons = [
      ...mainMenu().inline_keyboard.flat(),
      ...applyKeyboard(1).inline_keyboard.flat(),
      ...openJobsKeyboard([job]).inline_keyboard.flat(),
    ]
    for (const button of buttons) expect(button.text).not.toMatch(FORBIDDEN)
  })

  it('is entirely callback buttons — no free-text branch', () => {
    for (const button of mainMenu().inline_keyboard.flat()) {
      expect(button).toHaveProperty('callback_data')
    }
  })

  it('routes the apply button at the job it is showing', () => {
    const data = applyKeyboard(12).inline_keyboard.flat().map((b) =>
      'callback_data' in b ? b.callback_data : '',
    )
    expect(data).toContain('apply:12')
    expect(data).toContain('menu:main')
  })

  it('offers every live job, plus a way back', () => {
    const kb = openJobsKeyboard([job, { ...job, id: 8 }])
    const data = kb.inline_keyboard.flat().map((b) => ('callback_data' in b ? b.callback_data : ''))
    expect(data).toEqual(['job:7', 'job:8', 'menu:main'])
  })
})
