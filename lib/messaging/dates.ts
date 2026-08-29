/**
 * Dates as they appear in a message to a family. PURE.
 * Gregorian, in Amharic script — the same convention Ethiopian media uses.
 * Switching to the Ethiopian calendar would change every date in the system and
 * is the operator's decision, not a formatting detail.
 */

const MONTHS_AM = [
  'ጃንዩወሪ', 'ፌብሩወሪ', 'ማርች', 'ኤፕሪል', 'ሜይ', 'ጁን',
  'ጁላይ', 'ኦገስት', 'ሴፕቴምበር', 'ኦክቶበር', 'ኖቬምበር', 'ዲሴምበር',
]

/** "5 ኦክቶበር" — short on purpose: an Amharic SMS segment is only 70 characters. */
export function formatDateAm(date: Date): string {
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getUTCDate()} ${MONTHS_AM[date.getUTCMonth()]}`
}

/** "ሴፕቴምበር 2026" — for an invoice covering a whole month. */
export function formatMonthAm(year: number, month1to12: number): string {
  return `${MONTHS_AM[month1to12 - 1]} ${year}`
}
