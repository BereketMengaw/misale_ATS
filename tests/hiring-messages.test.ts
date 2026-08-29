import { describe, expect, it } from 'vitest'
import {
  commissionAccepted, commissionDeclined, commissionOffer, filledPost, hired,
  jobLine, notChosen, notChosenAfterShortlist, type JobSummary,
} from '@/lib/hiring/messages'

const job: JobSummary = {
  subject: 'Mathematics',
  grade: 'Grade 9',
  area: 'Bole',
  daysPerWeek: 3,
  rateAmount: 4500,
  ratePeriod: 'per_month',
}

const ALL = [
  commissionOffer(job, 20),
  commissionAccepted(job),
  commissionDeclined(job),
  hired(job, 'Selam', 20, 'after_first_payment', null),
  notChosen(job),
  notChosenAfterShortlist(job),
]

describe('hiring messages', () => {
  it('quotes the tutor their take-home, never the parent\'s bill', () => {
    const offer = commissionOffer(job, 20)
    expect(offer).toContain('3,600 ETB per month')
    expect(offer).not.toContain('4,500')
  })

  it('says the fee is already deducted, so nothing is owed later', () => {
    expect(commissionOffer(job, 20)).toContain('already taken out')
  })

  it('offers accept or decline, never a counter-offer', () => {
    const offer = commissionOffer(job, 20).toLowerCase()
    expect(offer).toContain('do you accept?')
    for (const word of ['negotiate', 'counter', 'how much', 'what would you', 'let us know']) {
      expect(offer).not.toContain(word)
    }
  })

  // The non-negotiable rule, applied to outbound messages this time.
  it('never invites a reply the operator would have to read', () => {
    const forbidden = /reply|write back|let us know|tell us|send us a message|call us|get in touch/i
    for (const message of ALL) {
      const inviting = message.split('\n').filter((l) => forbidden.test(l) && !/nothing to reply/i.test(l))
      expect(inviting, message.slice(0, 40)).toEqual([])
    }
  })

  it('tells the shortlisted losers something different from everyone else', () => {
    expect(notChosenAfterShortlist(job)).not.toBe(notChosen(job))
    expect(notChosenAfterShortlist(job)).toContain('final few')
  })

  it('honours contact release when it hands over a number', () => {
    const onHire = hired(job, 'Selam', 20, 'on_hire', '+251911234567')
    expect(onHire).toContain('+251911234567')

    const later = hired(job, 'Selam', 20, 'after_first_payment', '+251911234567')
    expect(later).not.toContain('+251911234567')
    expect(later).toContain('once the first month is paid')

    const never = hired(job, 'Selam', 20, 'never', '+251911234567')
    expect(never).not.toContain('+251911234567')
  })

  it('quotes the tutor the same figure at hire as at the offer', () => {
    expect(hired(job, 'Selam', 20, 'never', null)).toContain('3,600 ETB per month')
  })

  it('marks a filled post without destroying it', () => {
    const original = '📚 Tutor needed — Mathematics\n\nGrade: Grade 9\nPay: 3,600 ETB per month'
    const filled = filledPost(original)
    expect(filled.startsWith('✅ FILLED')).toBe(true)
    expect(filled).toContain('no longer accepting applications')
    expect(filled).toContain('Grade: Grade 9')  // the post is still readable
    expect(filled.length).toBeLessThan(4096)
  })

  it('describes a job the same way everywhere', () => {
    expect(jobLine(job)).toBe('Mathematics, Grade 9, Bole')
    for (const m of ALL) expect(m).toContain('Mathematics')
  })
})
