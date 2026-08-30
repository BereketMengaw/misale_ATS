/**
 * Everything the operator sends to a family. Amharic — these are the only
 * messages a parent ever sees, and they are read by people who are not the
 * tutors the bot talks to.
 *
 * PURE, and written natively rather than translated out of the English. Kept
 * short on purpose: an Amharic SMS fits 70 characters per segment against
 * English's 160, so every line costs about three times as much to send.
 */

export type ParentJob = {
  subject: string
  grade: string
  area: string
  daysPerWeek: number
}

export const AGENCY_NAME_AM = 'ሚሳሌ'

/** The introduction, sent once a tutor is hired. */
export function introductionAm(
  tutorName: string,
  tutorPhone: string | null,
  job: ParentJob,
  releaseNumber: boolean,
): string {
  const lines = [
    `${AGENCY_NAME_AM}፦ የልጅዎ አስተማሪ ${tutorName} ናቸው።`,
    `ትምህርት፦ ${job.subject} (${job.grade})`,
    `በሳምንት ${job.daysPerWeek} ቀን፣ ${job.area}።`,
  ]

  lines.push(
    releaseNumber && tutorPhone
      ? `ስልክ፦ ${tutorPhone}`
      : 'ስልክ ቁጥራቸውን በቅርቡ እንልክልዎታለን።',
  )

  return lines.join('\n')
}

/**
 * The invoice. The reference code is what makes the payment match itself.
 *
 * `payInto` is the account to send the money to — one account, already
 * formatted, from `payIntoSms`. Until it was added, this message carried an
 * amount, a code and a deadline, and never said where to pay: a bill with no
 * payee. The unchecked box in docs/07-setup-checklist.md, before step 10.
 *
 * Optional because a half-configured agency must still be able to bill; the
 * dashboard warns rather than blocking, and the message loses one line.
 */
export function invoiceAm(
  amountEtb: string,
  reference: string,
  dueLabel: string,
  payInto?: string | null,
): string {
  return [
    `${AGENCY_NAME_AM}፦ የዚህ ወር ክፍያ ${amountEtb} ብር ነው።`,
    `ማመሳከሪያ፦ ${reference}`,
    'ሲከፍሉ ይህን ኮድ በምክንያት ቦታ ላይ ይጻፉ።',
    ...(payInto ? [`ወደ፦ ${payInto}`] : []),
    `የመክፈያ ቀን፦ ${dueLabel}`,
  ].join('\n')
}

/** The chase, when a due date passes. Firm, not rude. */
export function overdueAm(amountEtb: string, reference: string, payInto?: string | null): string {
  return [
    `${AGENCY_NAME_AM}፦ ${amountEtb} ብር ክፍያ ገና አልደረሰንም።`,
    `ማመሳከሪያ፦ ${reference}`,
    ...(payInto ? [`ወደ፦ ${payInto}`] : []),
    'ከከፈሉ ይህን መልእክት ችላ ይበሉት።',
  ].join('\n')
}

/** Confirmation that money arrived, so nobody has to ask. */
export function paymentReceivedAm(amountEtb: string, reference: string): string {
  return [
    `${AGENCY_NAME_AM}፦ ${amountEtb} ብር ደርሶናል። አመሰግናለሁ።`,
    `ማመሳከሪያ፦ ${reference}`,
  ].join('\n')
}
