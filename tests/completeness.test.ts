import { describe, expect, it } from 'vitest'
import { completeness, isUsable, missingFields, USABLE_THRESHOLD } from '@/lib/candidates/completeness'

const full = {
  fullName: 'Abebe Kebede',
  phone: '+251911234567',
  gender: 'male',
  area: 'Bole',
  education: 'degree',
  institution: 'AAU',
  subjects: ['Mathematics'],
  grades: ['9-10'],
  availability: { mon: ['evening'] },
  experience: '1_2',
  expectedRate: 200,
  cvPath: 'cvs/1.pdf',
}

describe('profile completeness', () => {
  it('is 100 for a fully answered profile', () => {
    expect(completeness(full)).toBe(100)
  })

  it('is 0 for an empty one', () => {
    expect(completeness({})).toBe(0)
  })

  it('never exceeds 100', () => {
    expect(completeness({ ...full, institution: 'x', gender: 'male' })).toBe(100)
  })

  it('weights a phone number above an institution', () => {
    expect(completeness({ phone: '+251911234567' })).toBeGreaterThan(
      completeness({ institution: 'Addis Ababa University' }),
    )
  })

  it('treats blank strings as unanswered', () => {
    expect(completeness({ fullName: '   ', phone: '' })).toBe(0)
  })

  it('counts an empty availability object as unanswered', () => {
    expect(completeness({ availability: {} })).toBe(0)
    expect(completeness({ availability: { mon: ['evening'] } })).toBe(15)
  })

  it('a profile without a CV is still usable', () => {
    const { cvPath, ...noCv } = full
    expect(completeness(noCv)).toBe(95)
    expect(isUsable(noCv)).toBe(true)
  })

  it('a profile missing what ranking needs is not usable', () => {
    expect(isUsable({ fullName: 'A', phone: '+251911234567', area: 'Bole' })).toBe(false)
  })

  it('the threshold is reachable without a CV or an institution', () => {
    expect(USABLE_THRESHOLD).toBeLessThanOrEqual(95)
  })

  it('lists what is still missing, in the order it is asked for', () => {
    expect(missingFields({ fullName: 'A', phone: '+251911234567' })).toEqual([
      'area', 'education', 'subjects', 'grades', 'availability', 'experience', 'expected rate', 'CV',
    ])
    expect(missingFields(full)).toEqual([])
  })
})
