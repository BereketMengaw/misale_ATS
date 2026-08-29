import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isOverdue } from '@/lib/money/invoice'
import { formatEtb } from '@/lib/money/commission'
import { offerTerms } from '@/lib/ui/labels'

/**
 * What is waiting on the operator, gathered from wherever it happens to live.
 *
 * Before this, every one of these sat inside a record you had to open to find:
 * a tutor who accepted was three clicks deep in a job, and a message waiting
 * to be sent was below the fold on the money page. The work is the same; the
 * finding of it is what changed.
 */

export type Sendable = {
  id: number
  recipient: string
  phone: string | null
  body: string
  purpose: string
  /** Set when the message is a chase, so the row can say how late it is. */
  lateBy: number | null
}

export type Decision =
  | { kind: 'hire'; key: string; title: string; detail: string; jobId: number; applicationId: number; firstName: string }
  | { kind: 'present'; key: string; title: string; detail: string; jobId: number; size: number; terms: string }
  | { kind: 'publish'; key: string; title: string; detail: string; jobId: number }
  | { kind: 'chase'; key: string; title: string; detail: string; invoiceId: number; late: boolean }

export type Today = {
  sendables: Sendable[]
  decisions: Decision[]
  /** The quiet line: what is running while nothing needs doing. */
  running: { liveJobs: number; poolSize: number; placements: number }
  error: string | null
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

/**
 * Cached per request so the nav badge and the page itself cost one round of
 * queries between them, not two.
 */
export const loadToday = cache(async function loadToday(): Promise<Today> {
  const db = supabaseAdmin()
  const now = new Date()

  try {
    const [
      { data: outbox },
      { data: accepted },
      { data: openJobs },
      { data: approvedDrafts },
      { data: unpaid },
      { count: poolSize },
      { count: placements },
    ] = await Promise.all([
      db.from('outbox').select('*').eq('status', 'pending').order('created_at', { ascending: true }),
      db
        .from('applications')
        .select('id, job_post_id, candidates(full_name), job_posts(id, subject, grade, area, status)')
        .eq('status', 'commission_agreed'),
      db
        .from('job_posts')
        .select('id, subject, grade, area, created_at, rate_amount, rate_period, commission_percent')
        .eq('status', 'open'),
      db
        .from('job_posts')
        .select('id, subject, grade, area, approved_at')
        .eq('status', 'draft')
        .not('approved_at', 'is', null),
      db
        .from('invoices')
        .select('id, reference, due_on, paid_at, status, gross_cents, clients(full_name)')
        .in('status', ['draft', 'sent']),
      db.from('candidates').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      db.from('placements').select('id', { count: 'exact', head: true }).in('status', ['scheduled', 'active']),
    ])

    const decisions: Decision[] = []

    // 1. Someone accepted the commission. Nothing moves until he hires them.
    for (const a of accepted ?? []) {
      const job = a.job_posts as unknown as { id: number; subject: string; grade: string; area: string; status: string } | null
      const cand = a.candidates as unknown as { full_name: string | null } | null
      if (!job || job.status !== 'open') continue
      const name = cand?.full_name ?? 'A tutor'
      decisions.push({
        kind: 'hire',
        key: `hire-${a.id}`,
        title: `${name} accepted the commission`,
        detail: `${job.subject} · ${job.grade} · ${job.area}`,
        jobId: job.id,
        applicationId: a.id,
        firstName: name.split(' ')[0],
      })
    }

    // 2. Applicants nobody has been asked about.
    const openIds = (openJobs ?? []).map((j) => j.id)
    if (openIds.length > 0) {
      const { data: apps } = await db
        .from('applications')
        .select('id, job_post_id, status')
        .in('job_post_id', openIds)

      const byJob = new Map<number, { total: number; asked: number }>()
      for (const app of apps ?? []) {
        const bucket = byJob.get(app.job_post_id) ?? { total: 0, asked: 0 }
        bucket.total += 1
        if (['shortlisted', 'presented', 'commission_agreed', 'hired'].includes(app.status)) bucket.asked += 1
        byJob.set(app.job_post_id, bucket)
      }

      for (const job of openJobs ?? []) {
        const bucket = byJob.get(job.id)
        if (!bucket || bucket.total === 0 || bucket.asked > 0) continue
        const age = daysBetween(new Date(job.created_at), now)
        decisions.push({
          kind: 'present',
          key: `present-${job.id}`,
          title: `${bucket.total} applicant${bucket.total === 1 ? '' : 's'}, nobody asked yet`,
          detail: `${job.subject} · ${job.grade} · ${job.area} · posted ${age} day${age === 1 ? '' : 's'} ago`,
          jobId: job.id,
          size: Math.min(3, bucket.total),
          terms: offerTerms(Number(job.rate_amount), job.rate_period, Number(job.commission_percent)).sentence,
        })
      }
    }

    // 3. Approved, and then forgotten. A post nobody can see hires nobody.
    for (const job of approvedDrafts ?? []) {
      const age = job.approved_at ? daysBetween(new Date(job.approved_at), now) : 0
      decisions.push({
        kind: 'publish',
        key: `publish-${job.id}`,
        title: age > 0 ? `Approved ${age} day${age === 1 ? '' : 's'} ago, still not published` : 'Approved, not published yet',
        detail: `${job.subject} · ${job.grade} · ${job.area}`,
        jobId: job.id,
      })
    }

    // 4. Money that has not arrived. A chase already queued is not a decision.
    const queuedChases = new Set(
      (outbox ?? []).filter((m) => m.invoice_id).map((m) => Number(m.invoice_id)),
    )
    for (const inv of unpaid ?? []) {
      if (queuedChases.has(Number(inv.id))) continue
      const due = new Date(`${inv.due_on}T00:00:00Z`)
      const late = isOverdue(due, inv.paid_at ? new Date(inv.paid_at) : null, now)
      if (!late && inv.status !== 'draft') continue
      const client = inv.clients as unknown as { full_name: string } | null
      const lateBy = daysBetween(due, now)
      decisions.push({
        kind: 'chase',
        key: `chase-${inv.id}`,
        title: late
          ? `${inv.reference} went past its due date`
          : `${inv.reference} has not been sent`,
        detail: `${client?.full_name ?? 'Parent'} · ${formatEtb(Number(inv.gross_cents))} ETB${late ? ` · ${lateBy} day${lateBy === 1 ? '' : 's'} late` : ` · due ${inv.due_on}`}`,
        invoiceId: inv.id,
        late,
      })
    }

    const invoiceById = new Map((unpaid ?? []).map((i) => [Number(i.id), i]))

    const sendables: Sendable[] = (outbox ?? []).map((m) => {
      const inv = m.invoice_id ? invoiceById.get(Number(m.invoice_id)) : undefined
      const lateBy =
        inv && m.purpose === 'overdue' ? daysBetween(new Date(`${inv.due_on}T00:00:00Z`), now) : null
      return {
        id: m.id,
        recipient: m.recipient,
        phone: m.phone,
        body: m.body,
        purpose: m.purpose,
        lateBy: lateBy && lateBy > 0 ? lateBy : null,
      }
    })

    return {
      sendables,
      decisions,
      running: {
        liveJobs: (openJobs ?? []).length,
        poolSize: poolSize ?? 0,
        placements: placements ?? 0,
      },
      error: null,
    }
  } catch (err) {
    return {
      sendables: [],
      decisions: [],
      running: { liveJobs: 0, poolSize: 0, placements: 0 },
      error: err instanceof Error ? err.message : String(err),
    }
  }
})

/** What the nav badge counts: everything on Today. */
export async function todayCount(): Promise<number> {
  const today = await loadToday()
  return today.sendables.length + today.decisions.length
}
