import { describe, expect, it } from 'vitest'
import { payoutFor, reconciles, total, type PaidInvoice } from '@/lib/money/payout'
import { splitCents, formatEtb } from '@/lib/money/commission'

const invoice = (id: number, gross: number, percent: number): PaidInvoice => {
  const s = splitCents(gross, percent)
  return { invoiceId: id, grossCents: s.grossCents, commissionCents: s.commissionCents, netCents: s.netCents }
}

describe('a payout', () => {
  it('pays the tutor what the invoice said, to the cent', () => {
    const p = payoutFor(invoice(1, 450000, 20))
    expect(p.grossCents).toBe(450000)
    expect(p.commissionCents).toBe(90000)
    expect(p.netCents).toBe(360000)
    expect(formatEtb(p.netCents)).toBe('3,600')
  })

  it('copies the invoice rather than recomputing it', () => {
    // The percentage changed in settings after invoicing; the payout must not move.
    const invoiced = invoice(1, 450000, 20)
    expect(payoutFor(invoiced).netCents).toBe(360000)
    expect(payoutFor({ ...invoiced }).netCents).toBe(360000)
  })

  it('refuses an invoice that does not add up, rather than paying a wrong figure', () => {
    expect(() => payoutFor({ invoiceId: 9, grossCents: 450000, commissionCents: 90000, netCents: 350000 }))
      .toThrow(/does not add up/)
  })
})

describe('the books', () => {
  it('balances across many payouts at many rates', () => {
    const payouts = [
      invoice(1, 450000, 20), invoice(2, 300000, 20), invoice(3, 123457, 15),
      invoice(4, 1, 50), invoice(5, 999999, 33.33), invoice(6, 0, 20),
    ].map(payoutFor)

    const t = total(payouts)
    expect(t.count).toBe(6)
    expect(reconciles(t)).toBe(true)
    expect(t.commissionCents + t.netCents).toBe(t.grossCents)
  })

  it('balances over a whole year of monthly invoices', () => {
    const payouts = Array.from({ length: 12 }, (_, i) => payoutFor(invoice(i + 1, 450000, 20)))
    const t = total(payouts)
    expect(t.grossCents).toBe(5400000)   // 54,000 ETB collected
    expect(t.commissionCents).toBe(1080000) // 10,800 to the agency
    expect(t.netCents).toBe(4320000)     // 43,200 to tutors
    expect(reconciles(t)).toBe(true)
  })

  it('is zero and still balanced with nothing in it', () => {
    const t = total([])
    expect(t).toEqual({ count: 0, grossCents: 0, commissionCents: 0, netCents: 0 })
    expect(reconciles(t)).toBe(true)
  })

  it('catches a total that has drifted', () => {
    expect(reconciles({ count: 1, grossCents: 100, commissionCents: 20, netCents: 79 })).toBe(false)
  })
})
