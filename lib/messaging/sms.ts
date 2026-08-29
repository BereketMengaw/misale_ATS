/**
 * What an SMS actually costs to send. PURE.
 *
 * A message made only of GSM-7 characters fits 160 per segment. One character
 * outside that set — any Amharic letter, or a smart quote — switches the whole
 * message to UCS-2, where a segment is 70. So an Amharic message costs roughly
 * three times as many segments as the same text in English, and the operator
 * should see that before sending, not on the bill.
 */

const GSM7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'

// These take two GSM-7 characters each, via the escape table.
const GSM7_EXTENDED = '^{}\\[~]|€'

export type SmsCost = {
  encoding: 'GSM-7' | 'UCS-2'
  /** Characters as billed, which is not always the same as text.length. */
  units: number
  perSegment: number
  segments: number
}

export function smsCost(text: string): SmsCost {
  let units = 0
  let gsm = true

  for (const ch of text) {
    if (GSM7.includes(ch)) { units += 1; continue }
    if (GSM7_EXTENDED.includes(ch)) { units += 2; continue }
    gsm = false
    break
  }

  if (!gsm) {
    // UCS-2 bills per 16-bit code unit, so an emoji outside the BMP counts twice.
    units = [...text].reduce((n, ch) => n + (ch.codePointAt(0)! > 0xffff ? 2 : 1), 0)
    const perSegment = units <= 70 ? 70 : 67 // concatenated messages lose 3 units to the header
    return { encoding: 'UCS-2', units, perSegment, segments: Math.max(1, Math.ceil(units / perSegment)) }
  }

  const perSegment = units <= 160 ? 160 : 153
  return { encoding: 'GSM-7', units, perSegment, segments: Math.max(1, Math.ceil(units / perSegment)) }
}

/** "2 SMS · Amharic" — what to show beside a message before it is sent. */
export function describeCost(text: string): string {
  const c = smsCost(text)
  const script = c.encoding === 'UCS-2' ? 'Amharic' : 'English'
  return `${c.segments} SMS · ${script} · ${c.units}/${c.perSegment} per part`
}
