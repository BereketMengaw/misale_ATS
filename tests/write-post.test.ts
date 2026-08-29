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
  it('carries every answered field into the post', () => {
    const { body, generatedBy } = writePostTemplate(base)
    expect(generatedBy).toBe('template')
    expect(body).toContain('Mathematics')
    expect(body).toContain('Grade 9')
    expect(body).toContain('Bole, Addis Ababa')
    expect(body).toContain('4,500')
    expect(body).toContain('15 September 2026')
  })

  it('is deterministic — same fields, same post', () => {
    expect(writePostTemplate(base)).toEqual(writePostTemplate(base))
  })

  it('omits lines for fields the operator left blank', () => {
    const { body } = writePostTemplate({ ...base, hoursPerSession: null, startsOn: null })
    expect(body).not.toContain('Per session:')
    expect(body).not.toContain('Starts:')
    // and never leaves a hole where the line was
    expect(body).not.toMatch(/\n{3,}/)
  })

  it('states a gender preference only when there is one', () => {
    expect(writePostTemplate(base).body).not.toContain('Preferred:')
    expect(writePostTemplate({ ...base, genderPref: 'female' }).body).toContain('Female tutor')
    expect(writePostTemplate({ ...base, genderPref: 'male' }).body).toContain('Male tutor')
  })

  it('renders every rate period', () => {
    expect(writePostTemplate({ ...base, ratePeriod: 'per_hour' }).body).toContain('ETB per hour')
    expect(writePostTemplate({ ...base, ratePeriod: 'per_session' }).body).toContain('ETB per session')
    expect(writePostTemplate({ ...base, ratePeriod: 'per_month' }).body).toContain('ETB per month')
  })

  it('groups thousands, and shows cents only when there are any', () => {
    expect(writePostTemplate({ ...base, rateAmount: 12000 }).body).toContain('12,000 ETB')
    expect(writePostTemplate({ ...base, rateAmount: 150.5 }).body).toContain('150.50 ETB')
  })

  it('says hour, not hours, for a one-hour session', () => {
    expect(writePostTemplate({ ...base, hoursPerSession: 1 }).body).toContain('1 hour\n')
    expect(writePostTemplate({ ...base, hoursPerSession: 2 }).body).toContain('2 hours')
  })

  it('includes the operator note when given', () => {
    const { body } = writePostTemplate({ ...base, notes: 'Exam preparation, evenings only.' })
    expect(body).toContain('Exam preparation, evenings only.')
  })

  it('ignores a start date it cannot read', () => {
    expect(writePostTemplate({ ...base, startsOn: 'not-a-date' }).body).not.toContain('Starts:')
  })
})
