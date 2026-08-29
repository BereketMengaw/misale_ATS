import { describe, expect, it } from 'vitest'
import { gradeBand } from '@/lib/scoring/grades'

describe('grade bands', () => {
  it('reads the number out of however the operator wrote it', () => {
    expect(gradeBand('Grade 9')).toBe('9-10')
    expect(gradeBand('9')).toBe('9-10')
    expect(gradeBand('9th')).toBe('9-10')
    expect(gradeBand('grade 3')).toBe('1-4')
    expect(gradeBand('12')).toBe('11-12')
    expect(gradeBand('Grade 7')).toBe('5-8')
  })

  it('recognises university without a number', () => {
    expect(gradeBand('University')).toBe('university')
    expect(gradeBand('1st year college')).toBe('university')
  })

  it('returns null rather than guessing', () => {
    expect(gradeBand('')).toBeNull()
    expect(gradeBand(null)).toBeNull()
    expect(gradeBand('all levels')).toBeNull()
    expect(gradeBand('99')).toBeNull()
  })

  it('covers every grade a school actually has', () => {
    const bands = [1,2,3,4,5,6,7,8,9,10,11,12].map((n) => gradeBand(String(n)))
    expect(bands.every(Boolean)).toBe(true)
  })
})
