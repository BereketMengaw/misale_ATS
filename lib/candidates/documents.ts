import { educationFrom, institutionFrom, nameFrom, sameName } from './cv'
import { EDUCATION, labelFor } from './options'
import type { RawDocument } from '@/lib/ai/types'

/**
 * Checking a degree or a transcript against what the tutor said about
 * themselves. PURE — a document's contents and a profile in, a verdict out.
 *
 * What this is NOT: it does not decide whether a certificate is genuine. A
 * model cannot tell a forged degree from a real one, and nothing here should be
 * read as saying it can. What it does is narrower and still worth having — it
 * reads what the paper claims and compares that with what its owner claimed,
 * which is the check the operator was doing by eye and mostly not doing at all.
 *
 * Nothing it concludes is ever written to a profile. `education` is the tutor's
 * own answer; a document that fails to back it is a thing to look at, not a
 * correction to apply.
 */

// ---------------------------------------------------------------------------
// What a document turns out to be
// ---------------------------------------------------------------------------

export const DOCUMENT_KINDS = [
  'degree',
  'diploma',
  'transcript',
  'grade12',
  'other',
  'not-a-document',
] as const

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  degree: 'Degree certificate',
  diploma: 'Diploma',
  transcript: 'Transcript',
  grade12: 'Grade 12 certificate',
  other: 'Something else',
  'not-a-document': 'Not an educational document',
}

export type DocumentFacts = {
  kind: DocumentKind
  /**
   * The qualification this document is evidence OF, as an education enum.
   *
   * Null for a transcript or a grade 12 certificate, and that is the point: a
   * school-leaving certificate is a real document that says nothing whatever
   * about whether somebody holds a degree. Setting it to 'student' would turn
   * "this paper does not speak to the claim" into "this paper contradicts it".
   */
  evidences: string | null
  /** The name on the document. */
  holder: string | null
  institution: string | null
  /** The year it was awarded, as written. */
  awardedYear: string | null
}

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

export type Verdict =
  | 'backs'
  | 'short'
  | 'name-mismatch'
  | 'unclaimed'
  | 'inconclusive'
  | 'not-a-document'

export type DocumentCheck = {
  facts: DocumentFacts
  verdict: Verdict
  /** What the tutor answered, and what the paper evidences. Both may be null. */
  claimed: string | null
  evidenced: string | null
}

/**
 * How the levels order. 'other' is deliberately absent: it is a real answer to
 * the wizard's question and an unrankable one, so a profile holding it can be
 * neither backed nor undercut by a certificate.
 */
const RANK: Record<string, number> = {
  student: 1,
  diploma: 2,
  degree: 3,
  masters: 4,
  phd: 5,
}

function isKind(value: unknown): value is DocumentKind {
  return typeof value === 'string' && (DOCUMENT_KINDS as readonly string[]).includes(value)
}

/** Whatever a provider handed back, reduced to what a verdict can be built on. */
export function readDocumentFacts(raw: RawDocument): DocumentFacts {
  const kind = isKind(raw.kind) ? raw.kind : 'other'

  // Only a qualification certificate evidences a level. A transcript is a list
  // of marks and a grade 12 certificate is the end of school; neither is proof
  // of a degree, and neither is proof against one.
  const evidences =
    kind === 'degree' || kind === 'diploma' ? educationFrom(raw.level) : null

  return {
    kind,
    evidences,
    holder: nameFrom(raw.holderName),
    institution: institutionFrom(raw.institution),
    awardedYear: /^\d{4}$/.test(String(raw.awardedYear ?? '').trim())
      ? String(raw.awardedYear).trim()
      : null,
  }
}

export type DocumentClaim = {
  fullName?: string | null
  education?: string | null
}

/**
 * The whole check, in the order the findings matter.
 *
 * A name that is not theirs comes first and outranks everything, including a
 * document that would otherwise back the claim perfectly — a real degree
 * belonging to somebody else is the worst case here, not the best one.
 */
export function checkDocument(claim: DocumentClaim, facts: DocumentFacts): DocumentCheck {
  const claimed = claim.education?.trim() || null
  const evidenced = facts.evidences

  const base = { facts, claimed, evidenced }

  if (facts.kind === 'not-a-document') return { ...base, verdict: 'not-a-document' }

  if (facts.holder && claim.fullName?.trim() && !sameName(claim.fullName, facts.holder)) {
    return { ...base, verdict: 'name-mismatch' }
  }

  if (!claimed) return { ...base, verdict: 'unclaimed' }
  if (!evidenced) return { ...base, verdict: 'inconclusive' }

  const claimedRank = RANK[claimed]
  const evidencedRank = RANK[evidenced]
  if (claimedRank == null || evidencedRank == null) return { ...base, verdict: 'inconclusive' }

  // Higher than claimed still backs it. Somebody with a master's who tapped
  // "Bachelor's degree" has understated themselves, which is not a discrepancy
  // anybody needs to chase.
  return { ...base, verdict: evidencedRank >= claimedRank ? 'backs' : 'short' }
}

/** True for the verdicts an operator has to actually look at. */
export function needsAttention(verdict: Verdict): boolean {
  return verdict === 'name-mismatch' || verdict === 'short' || verdict === 'not-a-document'
}

/** One line, for the profile page. */
export function verdictLine(check: DocumentCheck): string {
  const claimed = check.claimed ? labelFor(EDUCATION, check.claimed) : null
  const evidenced = check.evidenced ? labelFor(EDUCATION, check.evidenced) : null

  switch (check.verdict) {
    case 'backs':
      return `Backs up ${claimed}.`
    case 'short':
      return `They answered ${claimed}; this shows ${evidenced}.`
    case 'name-mismatch':
      return `The name on this is ${check.facts.holder}.`
    case 'unclaimed':
      return evidenced
        ? `Shows ${evidenced}, and no education is set on the profile.`
        : 'No education is set on the profile to check this against.'
    case 'inconclusive':
      return `${DOCUMENT_KIND_LABEL[check.facts.kind]} — it does not speak to the level they answered.`
    case 'not-a-document':
      return 'This is not an educational document.'
  }
}
