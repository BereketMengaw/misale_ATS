import { supabaseAdmin } from '@/lib/supabase/admin'

export type OpenJob = {
  id: number
  subject: string
  grade: string
  area: string
  body: string
  status: string
  expires_at: string | null
}

const COLUMNS = 'id, subject, grade, area, body, status, expires_at'

/** Open, and not past its expiry window. */
export function isLive(job: OpenJob): boolean {
  if (job.status !== 'open') return false
  return !job.expires_at || new Date(job.expires_at) > new Date()
}

export async function getJob(jobId: number): Promise<OpenJob | null> {
  const { data } = await supabaseAdmin()
    .from('job_posts')
    .select(COLUMNS)
    .eq('id', jobId)
    .maybeSingle<OpenJob>()
  return data ?? null
}

/** Live jobs, for the buttons a dead link falls back to. */
export async function listOpenJobs(limit = 5): Promise<OpenJob[]> {
  const { data } = await supabaseAdmin()
    .from('job_posts')
    .select(COLUMNS)
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

/** Counted without a read first: two taps can land on two instances at once. */
export async function countApply(publicationId: number): Promise<void> {
  try {
    await supabaseAdmin().rpc('bump_apply_count', { publication_id: publicationId })
  } catch (err) {
    console.error('bump_apply_count failed', err)
  }
}
