/**
 * Job posts carry a free-text grade ("Grade 9", "9", "3", "university").
 * Candidates pick bands from buttons. Matching one to the other is pure and
 * tested, because getting it wrong silently reorders the whole board.
 */
export const BANDS = ['1-4', '5-8', '9-10', '11-12', 'university'] as const
export type Band = (typeof BANDS)[number]

export function gradeBand(grade: string | null | undefined): Band | null {
  if (!grade) return null
  const text = grade.toLowerCase()

  if (/uni|degree|college|freshman/.test(text)) return 'university'

  // First number anywhere in the string: "Grade 9", "9th", "9ኛ ክፍል", "9".
  const match = /(\d{1,2})/.exec(text)
  if (!match) return null

  const n = Number(match[1])
  if (n >= 1 && n <= 4) return '1-4'
  if (n >= 5 && n <= 8) return '5-8'
  if (n >= 9 && n <= 10) return '9-10'
  if (n >= 11 && n <= 12) return '11-12'
  return null
}
