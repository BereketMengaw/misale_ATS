import { describe, expect, it } from 'vitest'
import { parseJobFields, normalizeFormData } from '@/lib/jobs/fields'

const valid = {
  subject: 'Physics',
  grade: 'Grade 11',
  area: 'Piassa',
  daysPerWeek: '2',
  rateAmount: '300',
  ratePeriod: 'per_hour',
  genderPref: 'any',
}

describe('job fields', () => {
  it('accepts a filled form and coerces the numbers', () => {
    const result = parseJobFields(valid)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.values.daysPerWeek).toBe(2)
      expect(result.values.rateAmount).toBe(300)
      expect(result.values.commissionPercent).toBe(20)
    }
  })

  it('reports one message per bad field', () => {
    const result = parseJobFields({ ...valid, daysPerWeek: '9', rateAmount: '0' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.daysPerWeek).toBeTruthy()
      expect(result.errors.rateAmount).toBeTruthy()
    }
  })

  it('treats an empty form field as unanswered, not as an empty string', () => {
    const fd = new FormData()
    fd.set('subject', ' Chemistry ')
    fd.set('notes', '   ')
    const normalized = normalizeFormData(fd)
    expect(normalized.subject).toBe('Chemistry')
    expect(normalized.notes).toBeNull()
  })

  it('rejects a malformed start date', () => {
    const result = parseJobFields({ ...valid, startsOn: '15/09/2026' })
    expect(result.ok).toBe(false)
  })
})
