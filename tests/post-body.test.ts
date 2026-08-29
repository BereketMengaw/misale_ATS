import { describe, expect, it } from 'vitest'
import { fitsTelegram, manualPack, TELEGRAM_TEXT_LIMIT } from '@/lib/jobs/post-body'
import { writePostTemplate } from '@/lib/ai/providers/template'

describe('telegram limit', () => {
  it('a real post with a maxed-out note still fits one message', () => {
    const { body } = writePostTemplate({
      subject: 'Mathematics',
      grade: 'Grade 9',
      area: 'Bole, Addis Ababa',
      daysPerWeek: 3,
      hoursPerSession: 2,
      rateAmount: 4500,
      ratePeriod: 'per_month',
      genderPref: 'female',
      startsOn: '2026-09-15',
      notes: 'x'.repeat(400),
    })
    expect(fitsTelegram(body)).toBe(true)
  })

  it('rejects a body Telegram would reject', () => {
    expect(fitsTelegram('x'.repeat(TELEGRAM_TEXT_LIMIT))).toBe(true)
    expect(fitsTelegram('x'.repeat(TELEGRAM_TEXT_LIMIT + 1))).toBe(false)
  })
})

describe('manual copy pack', () => {
  it('appends the same tracked link the button would use', () => {
    const url = 'https://t.me/bot?start=job_12_3'
    expect(manualPack('Tutor needed', url)).toBe(`Tutor needed\n\nTo apply: ${url}`)
  })

  it('is what someone pastes, so it carries no stray whitespace', () => {
    expect(manualPack('  body  ', 'u')).toBe('body\n\nTo apply: u')
  })
})
