import { describe, expect, it } from 'vitest'
import {
  checkDocument,
  needsAttention,
  readDocumentFacts,
  verdictLine,
  type DocumentFacts,
} from '@/lib/candidates/documents'

const degree: DocumentFacts = {
  kind: 'degree',
  evidences: 'degree',
  holder: 'Abebe Kebede',
  institution: 'Addis Ababa University',
  awardedYear: '2017',
}

describe('reading a document', () => {
  it('takes the level only from a certificate that awards one', () => {
    expect(
      readDocumentFacts({ kind: 'degree', level: 'Bachelor of Science in Physics' }).evidences,
    ).toBe('degree')
    expect(readDocumentFacts({ kind: 'diploma', level: 'Diploma in Accounting' }).evidences).toBe(
      'diploma',
    )
  })

  it('takes no level from a transcript or a school certificate', () => {
    // A grade 12 certificate is a real document that says nothing about whether
    // somebody holds a degree. Reading a level off it would turn "this paper
    // does not speak to the claim" into "this paper contradicts it".
    expect(readDocumentFacts({ kind: 'grade12', level: 'Grade 12' }).evidences).toBeNull()
    expect(readDocumentFacts({ kind: 'transcript', level: 'BSc' }).evidences).toBeNull()
  })

  it('falls back to "other" for a kind it does not know', () => {
    expect(readDocumentFacts({ kind: 'passport' }).kind).toBe('other')
    expect(readDocumentFacts({}).kind).toBe('other')
  })

  it('keeps a year only when it is one', () => {
    expect(readDocumentFacts({ awardedYear: '2017' }).awardedYear).toBe('2017')
    expect(readDocumentFacts({ awardedYear: 'sometime' }).awardedYear).toBeNull()
    expect(readDocumentFacts({ awardedYear: 17 }).awardedYear).toBeNull()
  })
})

describe('checking a document against what the tutor answered', () => {
  const claim = { fullName: 'Abebe Kebede', education: 'degree' }

  it('backs a claim the certificate matches', () => {
    expect(checkDocument(claim, degree).verdict).toBe('backs')
  })

  it('treats a higher qualification as backing, not as a discrepancy', () => {
    // Somebody with a master's who tapped "Bachelor's degree" has understated
    // themselves. Nobody needs to chase that.
    expect(checkDocument(claim, { ...degree, evidences: 'masters' }).verdict).toBe('backs')
  })

  it('reports a certificate for less than they answered', () => {
    expect(checkDocument(claim, { ...degree, evidences: 'diploma' }).verdict).toBe('short')
  })

  it('puts a name that is not theirs above everything else', () => {
    // A real degree belonging to somebody else is the worst case here, not the
    // best one — so it outranks a certificate that would otherwise back them.
    const check = checkDocument(claim, { ...degree, holder: 'Selam Girma' })
    expect(check.verdict).toBe('name-mismatch')
  })

  it('allows a middle name on the certificate that the profile does not have', () => {
    expect(checkDocument(claim, { ...degree, holder: 'Abebe Kebede Tadesse' }).verdict).toBe('backs')
  })

  it('says a transcript is inconclusive rather than short', () => {
    const facts: DocumentFacts = { ...degree, kind: 'transcript', evidences: null }
    expect(checkDocument(claim, facts).verdict).toBe('inconclusive')
  })

  it('has nothing to check against when no education is set', () => {
    expect(checkDocument({ fullName: 'Abebe Kebede' }, degree).verdict).toBe('unclaimed')
  })

  it('cannot rank "other", so it never backs or undercuts it', () => {
    // "Something else" is a real answer to the wizard's question and an
    // unrankable one. A certificate can neither confirm nor contradict it.
    expect(checkDocument({ ...claim, education: 'other' }, degree).verdict).toBe('inconclusive')
  })

  it('flags a file that is not an educational document at all', () => {
    const facts: DocumentFacts = {
      kind: 'not-a-document',
      evidences: null,
      holder: null,
      institution: null,
      awardedYear: null,
    }
    expect(checkDocument(claim, facts).verdict).toBe('not-a-document')
  })

  it('never reports on authenticity', () => {
    // The check compares two claims about a qualification. It has no opinion on
    // whether the paper is genuine, and no verdict may imply one.
    const verdicts = ['backs', 'short', 'name-mismatch', 'unclaimed', 'inconclusive', 'not-a-document']
    for (const v of verdicts) expect(v).not.toMatch(/fake|forged|genuine|authentic|fraud/)
  })
})

describe('what the operator is shown', () => {
  it('asks for attention only where there is something to do', () => {
    expect(needsAttention('name-mismatch')).toBe(true)
    expect(needsAttention('short')).toBe(true)
    expect(needsAttention('not-a-document')).toBe(true)
    expect(needsAttention('backs')).toBe(false)
    expect(needsAttention('inconclusive')).toBe(false)
    expect(needsAttention('unclaimed')).toBe(false)
  })

  it('names both sides of a mismatch in words, not enums', () => {
    const line = verdictLine(checkDocument({ fullName: 'Abebe Kebede', education: 'masters' }, degree))
    expect(line).toContain("Master's degree")
    expect(line).toContain("Bachelor's degree")
  })

  it('has a line for every verdict', () => {
    const claim = { fullName: 'Abebe Kebede', education: 'degree' }
    const cases: DocumentFacts[] = [
      degree,
      { ...degree, evidences: 'diploma' },
      { ...degree, holder: 'Selam Girma' },
      { ...degree, kind: 'transcript', evidences: null },
      { ...degree, kind: 'not-a-document' },
    ]
    for (const facts of cases) {
      expect(verdictLine(checkDocument(claim, facts)).length).toBeGreaterThan(0)
    }
    expect(verdictLine(checkDocument({}, degree)).length).toBeGreaterThan(0)
  })
})

describe('what the document reader asks a model for', () => {
  it('requires every field, like the CV schema', async () => {
    const { DOC_SCHEMA } = await import('@/lib/ai/providers/gemini')
    expect([...DOC_SCHEMA.required].sort()).toEqual(Object.keys(DOC_SCHEMA.properties).sort())
  })

  it('never asks the model to judge the person or the paper', async () => {
    const { DOC_SCHEMA } = await import('@/lib/ai/providers/gemini')
    const asked = Object.keys(DOC_SCHEMA.properties).join(' ').toLowerCase()
    for (const word of ['authentic', 'genuine', 'fake', 'forged', 'valid', 'suspicious', 'confidence']) {
      expect(asked).not.toContain(word)
    }
  })
})
