/**
 * The commission split. PURE, and asserted to the cent — see CLAUDE.md.
 *
 * The advertised rate is what the PARENT pays. The agency's share comes out of
 * it; the tutor receives the rest.
 *
 *     gross − commission = net
 *
 * All arithmetic runs in integer cents. Doing it in floats means 0.1 + 0.2
 * problems land in somebody's actual pay.
 */

export type Split = {
  /** What the parent is billed. */
  grossCents: number
  /** What the agency keeps. */
  commissionCents: number
  /** What the tutor receives. */
  netCents: number
  percent: number
}

export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) throw new Error('amount must be a finite number')

  // Multiplying by 100 loses half-cents: 8.245 * 100 is 824.4999999999999 in
  // floats, which rounds DOWN to 824 and quietly underpays. Shifting the
  // decimal point through string notation keeps the digits that were written.
  const shifted = Number(`${amount}e2`)
  return Math.round(Number.isFinite(shifted) ? shifted : amount * 100)
}

export function fromCents(cents: number): number {
  return cents / 100
}

/**
 * Split a gross amount. The commission is rounded to the nearest cent and the
 * net is whatever is left, so commission + net always equals gross exactly —
 * a half-cent can never go missing or be invented.
 */
export function splitCents(grossCents: number, percent: number): Split {
  if (!Number.isInteger(grossCents)) throw new Error('grossCents must be an integer')
  if (grossCents < 0) throw new Error('gross cannot be negative')
  if (percent < 0 || percent >= 100) throw new Error('percent must be between 0 and 100')

  const commissionCents = Math.round((grossCents * percent) / 100)
  return {
    grossCents,
    commissionCents,
    netCents: grossCents - commissionCents,
    percent,
  }
}

/** The same split from an ETB amount, e.g. 4500 at 20%. */
export function split(grossAmount: number, percent: number): Split {
  return splitCents(toCents(grossAmount), percent)
}

/** What the tutor takes home from an advertised rate. */
export function tutorPay(grossAmount: number, percent: number): number {
  return fromCents(split(grossAmount, percent).netCents)
}

/** 450000 → "4,500". Grouped, and cents only when there are any. */
export function formatEtb(cents: number): string {
  const amount = fromCents(cents)
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}
