import { describe, expect, it } from 'vitest'
import { channelBody, fitsTelegram, manualPack, TELEGRAM_TEXT_LIMIT } from '@/lib/jobs/post-body'
import { writePostTemplate } from '@/lib/ai/providers/template'

const post = { am: 'የአማርኛ ጽሑፍ', en: 'English text' }

describe('channel body', () => {
  it('posts one language when the channel wants one', () => {
    expect(channelBody(post, 'am')).toBe('የአማርኛ ጽሑፍ')
    expect(channelBody(post, 'en')).toBe('English text')
  })

  it('stacks both with a divider when the channel takes both', () => {
    const body = channelBody(post, 'both')
    expect(body).toContain('የአማርኛ ጽሑፍ')
    expect(body).toContain('English text')
    expect(body.indexOf('የአማርኛ')).toBeLessThan(body.indexOf('English'))
  })

  it('a real bilingual post still fits one Telegram message', () => {
    const generated = writePostTemplate({
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
    const body = channelBody(generated, 'both')
    expect(fitsTelegram(body)).toBe(true)
    expect(body.length).toBeLessThan(TELEGRAM_TEXT_LIMIT)
  })

  it('rejects a body Telegram would reject', () => {
    expect(fitsTelegram('x'.repeat(TELEGRAM_TEXT_LIMIT))).toBe(true)
    expect(fitsTelegram('x'.repeat(TELEGRAM_TEXT_LIMIT + 1))).toBe(false)
  })
})

describe('manual copy pack', () => {
  it('appends the same tracked link the button would use', () => {
    const url = 'https://t.me/bot?start=job_12_3'
    expect(manualPack('body', url, 'en')).toBe(`body\n\nTo apply: ${url}`)
    expect(manualPack('body', url, 'am')).toContain('ለማመልከት፡')
    expect(manualPack('body', url, 'both')).toContain('ለማመልከት / To apply:')
  })
})
