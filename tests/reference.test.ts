import { describe, expect, it } from 'vitest'
import {
  findReferences, generateReference, isValidReference,
  normalizeReference, REFERENCE_SPACE,
} from '@/lib/money/reference'

describe('payment reference', () => {
  it('generates codes that pass its own validator', () => {
    for (let i = 0; i < 500; i++) expect(isValidReference(generateReference())).toBe(true)
  })

  it('never contains a character that can be misread', () => {
    for (let i = 0; i < 500; i++) {
      const body = generateReference().slice(4)
      for (const ch of ['0', 'O', '1', 'I', 'L', 'A', 'E', 'U']) {
        expect(body).not.toContain(ch)
      }
    }
  })

  it('has enough codes to make a collision unremarkable', () => {
    expect(REFERENCE_SPACE).toBeGreaterThan(500_000)
  })

  it('accepts every way a parent might write it back', () => {
    for (const typed of ['MIS-HK7N', 'mis-hk7n', 'MIShk7n', ' MIS HK7N ', 'hk7n', 'HK7N', 'M1S-HK7N', 'mls hk7n']) {
      expect(normalizeReference(typed), typed).toBe('MIS-HK7N')
    }
  })

  it('refuses what is not a reference rather than inventing one', () => {
    for (const junk of ['', 'MIS-', 'HK7', 'HK7NN', 'thanks', '4500', 'MIS-AEIO']) {
      expect(normalizeReference(junk), junk).toBeNull()
    }
  })

  it('pulls the code out of a bank SMS', () => {
    const sms = 'Dear customer, ETB 4,500.00 credited from SELAM T. Reason: MIS-HK7N. Ref FT2609...'
    expect(findReferences(sms)).toEqual(['MIS-HK7N'])
  })

  it('finds it without the dash, and without duplicating it', () => {
    expect(findReferences('reason mis hk7n and again MIS-HK7N')).toEqual(['MIS-HK7N'])
  })

  it('finds nothing in a message that carries no reference', () => {
    expect(findReferences('ETB 4,500.00 credited from SELAM T. Ref FT2609XYZ')).toEqual([])
  })

  it('is stable given a stable random source', () => {
    const fixed = () => 0.5
    expect(generateReference(fixed)).toBe(generateReference(fixed))
  })
})
