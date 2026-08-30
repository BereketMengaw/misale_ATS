import { describe, expect, it } from 'vitest'
import { introductionAm, invoiceAm, overdueAm, paymentReceivedAm, type ParentJob } from '@/lib/messaging/parent'
import { smsCost } from '@/lib/messaging/sms'

const job: ParentJob = { subject: 'ሒሳብ', grade: '9ኛ ክፍል', area: 'ቦሌ', daysPerWeek: 3 }

/** A real account line, because the bill now has to carry one. */
const PAY_INTO = 'CBE 1000123456789'

const ALL = [
  introductionAm('አበበ ከበደ', '0911234567', job, true),
  introductionAm('አበበ ከበደ', '0911234567', job, false),
  invoiceAm('4,500', 'MIS-4823', '30 መስከረም', PAY_INTO),
  overdueAm('4,500', 'MIS-4823', PAY_INTO),
  paymentReceivedAm('4,500', 'MIS-4823'),
]

describe('parent messages', () => {
  it('are Amharic, not English', () => {
    for (const m of ALL) {
      expect(m).toMatch(/[ሀ-፿]/)
      expect(m).not.toMatch(/\b(your|the|is|and|please|payment)\b/i)
    }
  })

  it('name the agency so a stranger number is recognisable', () => {
    for (const m of ALL) expect(m).toContain('ሚሳሌ')
  })

  it('hands over the tutor number only when contact is released', () => {
    expect(introductionAm('አበበ ከበደ', '0911234567', job, true)).toContain('0911234567')
    const withheld = introductionAm('አበበ ከበደ', '0911234567', job, false)
    expect(withheld).not.toContain('0911234567')
    expect(withheld).toContain('በቅርቡ')
  })

  it('puts the reference code in every message about money', () => {
    for (const m of [invoiceAm('4,500', 'MIS-4823', '30 መስከረም', PAY_INTO), overdueAm('4,500', 'MIS-4823', PAY_INTO), paymentReceivedAm('4,500', 'MIS-4823')]) {
      expect(m).toContain('MIS-4823')
    }
  })

  it('tells the parent to put the code on the payment', () => {
    expect(invoiceAm('4,500', 'MIS-4823', '30 መስከረም', PAY_INTO)).toContain('ኮድ')
  })

  /**
   * The gap this closed: a bill that named an amount, a code and a deadline,
   * and never said where to send the money. docs/07-setup-checklist.md asked
   * for this before step 10 and nothing ever read it.
   */
  it('says where to send the money', () => {
    expect(invoiceAm('4,500', 'MIS-4823', '30 መስከረም', PAY_INTO)).toContain(PAY_INTO)
    expect(overdueAm('4,500', 'MIS-4823', PAY_INTO)).toContain(PAY_INTO)
  })

  it('still bills when no account has been configured yet', () => {
    const bare = invoiceAm('4,500', 'MIS-4823', '30 መስከረም', null)
    expect(bare).toContain('MIS-4823')
    expect(bare).not.toContain('ወደ፦')
  })

  // Amharic bills at 70 characters a segment, so length is money.
  it('stays within two SMS segments', () => {
    for (const m of ALL) {
      expect(smsCost(m).segments, m.split('\n')[0]).toBeLessThanOrEqual(2)
    }
  })

  it('never invites a reply', () => {
    for (const m of ALL) {
      expect(m).not.toMatch(/መልስ ይላኩ|ይደውሉልን|ያግኙን/)
    }
  })
})
