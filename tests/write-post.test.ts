import { describe, expect, it } from 'vitest'
import { writePostTemplate } from '@/lib/ai/providers/template'
import type { JobFields } from '@/lib/ai/types'

const base: JobFields = {
  subject: 'Mathematics',
  grade: 'Grade 9',
  area: 'Bole, Addis Ababa',
  daysPerWeek: 3,
  hoursPerSession: 2,
  rateAmount: 4500,
  ratePeriod: 'per_month',
  genderPref: 'any',
  startsOn: '2026-09-15',
  notes: null,
}

describe('template post writer', () => {
  it('writes both languages from the same fields', () => {
    const post = writePostTemplate(base)
    expect(post.generatedBy).toBe('template')
    for (const body of [post.am, post.en]) {
      expect(body).toContain('Mathematics')
      expect(body).toContain('Grade 9')
      expect(body).toContain('Bole, Addis Ababa')
      expect(body).toContain('4,500')
    }
  })

  it('is deterministic — same fields, same post', () => {
    expect(writePostTemplate(base)).toEqual(writePostTemplate(base))
  })

  it('writes Amharic natively, not as English structure', () => {
    const { am, en } = writePostTemplate(base)
    expect(am).not.toBe(en)
    expect(am).toMatch(/[ሀ-፿]/) // Ethiopic
    expect(am).toContain('የክፍል ደረጃ፡')
    expect(am).toContain('ብር')
    // No English labels leaking into the Amharic body.
    expect(am).not.toContain('Grade:')
    expect(am).not.toContain('Pay:')
  })

  it('omits lines for fields the operator left blank', () => {
    const post = writePostTemplate({ ...base, hoursPerSession: null, startsOn: null })
    expect(post.en).not.toContain('Per session:')
    expect(post.en).not.toContain('Starts:')
    expect(post.am).not.toContain('ትምህርት የሚጀምረው፡')
    // and never leaves a hole where the line was
    expect(post.en).not.toMatch(/\n{3,}/)
    expect(post.am).not.toMatch(/\n{3,}/)
  })

  it('states a gender preference only when there is one', () => {
    expect(writePostTemplate(base).en).not.toContain('Preferred:')
    const female = writePostTemplate({ ...base, genderPref: 'female' })
    expect(female.en).toContain('Female tutor')
    expect(female.am).toContain('ሴት አስተማሪ')
  })

  it('renders each rate period in both languages', () => {
    expect(writePostTemplate({ ...base, ratePeriod: 'per_hour' }).en).toContain('ETB per hour')
    expect(writePostTemplate({ ...base, ratePeriod: 'per_hour' }).am).toContain('ብር በሰዓት')
    expect(writePostTemplate({ ...base, ratePeriod: 'per_session' }).am).toContain('ብር በክፍለ ጊዜ')
    expect(writePostTemplate({ ...base, ratePeriod: 'per_month' }).am).toContain('ብር በወር')
  })

  it('groups thousands, and shows cents only when there are any', () => {
    expect(writePostTemplate({ ...base, rateAmount: 12000 }).en).toContain('12,000 ETB')
    expect(writePostTemplate({ ...base, rateAmount: 150.5 }).en).toContain('150.50 ETB')
  })

  it('writes the date in Amharic script in the Amharic post', () => {
    const post = writePostTemplate({ ...base, startsOn: '2026-09-15' })
    expect(post.en).toContain('15 September 2026')
    expect(post.am).toContain('15 ሴፕቴምበር 2026')
    expect(post.am).not.toContain('September')
  })

  it('includes the operator note when given', () => {
    const post = writePostTemplate({ ...base, notes: 'Exam preparation, evenings only.' })
    expect(post.en).toContain('Exam preparation, evenings only.')
    expect(post.am).toContain('Exam preparation, evenings only.')
  })

  it('fits a Telegram message', () => {
    const post = writePostTemplate({ ...base, notes: 'x'.repeat(400) })
    expect(post.am.length).toBeLessThan(4096)
    expect(post.en.length).toBeLessThan(4096)
  })
})
