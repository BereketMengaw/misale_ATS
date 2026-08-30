import { describe, expect, it } from 'vitest'
import {
  findReferences, generateReference, isValidReference, ledgerOf,
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
    expect(generateReference('invoice', fixed)).toBe(generateReference('invoice', fixed))
  })
})

/**
 * Two ledgers share one bank inbox: families paying invoices, tutors paying
 * their one-off charge. Everything below is about them never being confused for
 * one another, because a tutor's transfer marking a family's invoice paid is
 * money lost quietly.
 */
describe('the two ledgers', () => {
  it('gives a tutor pre-payment its own prefix', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateReference('prepayment')
      expect(code.startsWith('TUT-')).toBe(true)
      expect(ledgerOf(code)).toBe('prepayment')
    }
  })

  it('never generates a code that reads as the other ledger', () => {
    for (let i = 0; i < 200; i++) {
      expect(ledgerOf(generateReference('invoice'))).toBe('invoice')
      expect(ledgerOf(generateReference('prepayment'))).toBe('prepayment')
    }
  })

  it('refuses a code for the ledger it does not belong to', () => {
    expect(isValidReference('TUT-HK7N', 'prepayment')).toBe(true)
    expect(isValidReference('TUT-HK7N', 'invoice')).toBe(false)
    expect(isValidReference('MIS-HK7N', 'prepayment')).toBe(false)
  })

  it('is not a ledger at all when the prefix is unknown', () => {
    for (const junk of ['XYZ-HK7N', 'HK7N', 'MIS-AEIO', '']) {
      expect(ledgerOf(junk), junk).toBeNull()
    }
  })

  it('reads a tutor code back however it is typed', () => {
    for (const typed of ['TUT-HK7N', 'tut-hk7n', 'TUThk7n', ' tut hk7n ']) {
      expect(normalizeReference(typed), typed).toBe('TUT-HK7N')
    }
  })

  it('reads a bare code as whichever screen is asking', () => {
    expect(normalizeReference('hk7n')).toBe('MIS-HK7N')
    expect(normalizeReference('hk7n', 'prepayment')).toBe('TUT-HK7N')
    // An explicit prefix always beats the fallback.
    expect(normalizeReference('MIS-HK7N', 'prepayment')).toBe('MIS-HK7N')
  })

  it('pulls a tutor code out of a bank SMS', () => {
    const sms = 'Dear customer, ETB 4,800.00 credited from ABEBE K. Reason: TUT-HK7N. Ref FT2609...'
    expect(findReferences(sms)).toEqual(['TUT-HK7N'])
  })

  it('finds both when a message somehow carries both', () => {
    expect(findReferences('MIS-HK7N and TUT-J4RP').sort()).toEqual(['MIS-HK7N', 'TUT-J4RP'])
  })
})
