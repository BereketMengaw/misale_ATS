import { z } from 'zod'
import type { JobFields } from '@/lib/ai/types'

/**
 * The operator's answers, validated. Pure — takes a plain object, returns
 * fields or an error map, so it is testable without a form or a database.
 */
export const jobFieldsSchema = z.object({
  subject: z.string().trim().min(2, 'Subject is required').max(80),
  grade: z.string().trim().min(1, 'Grade is required').max(40),
  area: z.string().trim().min(2, 'Area is required').max(80),
  daysPerWeek: z.coerce.number().int().min(1, 'At least 1 day').max(7, 'At most 7 days'),
  hoursPerSession: z.coerce.number().positive().max(12).optional().nullable(),
  rateAmount: z.coerce.number().positive('Pay must be more than 0').max(1_000_000),
  ratePeriod: z.enum(['per_hour', 'per_session', 'per_month']),
  genderPref: z.enum(['any', 'female', 'male']).default('any'),
  startsOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .optional()
    .nullable(),
  notes: z.string().trim().max(400).optional().nullable(),
  commissionPercent: z.coerce.number().min(0).max(99).default(20),
})

export type JobFormInput = z.input<typeof jobFieldsSchema>
export type JobFormValues = z.output<typeof jobFieldsSchema>

/** Empty strings from an HTML form mean "not answered", not "the empty string". */
export function normalizeFormData(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    out[key] = trimmed === '' ? null : trimmed
  }
  return out
}

export type ParseResult =
  | { ok: true; values: JobFormValues }
  | { ok: false; errors: Record<string, string> }

export function parseJobFields(input: unknown): ParseResult {
  const result = jobFieldsSchema.safeParse(input)
  if (result.success) return { ok: true, values: result.data }

  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? 'form')
    errors[key] ??= issue.message
  }
  return { ok: false, errors }
}

/** The subset the post writer needs — commission is money, not copy. */
export function toAiFields(values: JobFormValues): JobFields {
  return {
    subject: values.subject,
    grade: values.grade,
    area: values.area,
    daysPerWeek: values.daysPerWeek,
    hoursPerSession: values.hoursPerSession ?? null,
    rateAmount: values.rateAmount,
    ratePeriod: values.ratePeriod,
    genderPref: values.genderPref,
    startsOn: values.startsOn ?? null,
    notes: values.notes ?? null,
  }
}
