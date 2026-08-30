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

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * "15 September" — for a tutor, on Telegram, where length is free.
 *
 * The pre-payment message used to print the raw column, "Due by 2026-09-15",
 * in the middle of otherwise plain English. A date somebody has to decode is
 * a date they misread.
 */
export function formatDateEn(date: Date): string {
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getUTCDate()} ${MONTHS_EN[date.getUTCMonth()]}`
}
