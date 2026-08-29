import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Lang } from './copy'

export type OpenJob = {
  id: number
  subject: string
  grade: string
  area: string
  body_am: string
  body_en: string
  status: string
  expires_at: string | null
}

/** Open, and not past its expiry window. */
export function isLive(job: OpenJob): boolean {
  if (job.status !== 'open') return false
  return !job.expires_at || new Date(job.expires_at) > new Date()
}

export async function getJob(jobId: number): Promise<OpenJob | null> {
  const { data } = await supabaseAdmin()
    .from('job_posts')
    .select('id, subject, grade, area, body_am, body_en, status, expires_at')
    .eq('id', jobId)
    .maybeSingle<OpenJob>()
  return data ?? null
}

/** Live jobs, for the buttons a dead link falls back to. */
export async function listOpenJobs(limit = 5): Promise<OpenJob[]> {
  const { data } = await supabaseAdmin()
    .from('job_posts')
    .select('id, subject, grade, area, body_am, body_en, status, expires_at')
    .eq('status', 'open')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<OpenJob[]>()
  return data ?? []
}

export function jobLabel(job: OpenJob): string {
  return `${job.subject} · ${job.grade} · ${job.area}`
}

export function jobBody(job: OpenJob, lang?: Lang): string {
  if (lang === 'am') return job.body_am
  if (lang === 'en') return job.body_en
  return `${job.body_am}\n\n— — —\n\n${job.body_en}`
}

/** Counted without a read first: two taps can land on two instances at once. */
export async function countApply(publicationId: number): Promise<void> {
  try {
    await supabaseAdmin().rpc('bump_apply_count', { publication_id: publicationId })
  } catch (err) {
    console.error('bump_apply_count failed', err)
  }
}
