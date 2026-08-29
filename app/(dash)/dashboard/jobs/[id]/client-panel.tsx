import { supabaseAdmin } from '@/lib/supabase/admin'
import { introductionAm } from '@/lib/messaging/parent'
import { describeCost } from '@/lib/messaging/sms'
import { parentConnectLink } from '@/lib/messaging/connect'
import { getBot } from '@/lib/bot/bot'
import { setClient } from '../actions'
import { CopyBox } from './copy-box'

const input =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none'

/**
 * The parent paying for the lessons. Needed before a hire can be introduced to
 * anyone, and needed again at step 10 to send an invoice.
 */
export async function ClientPanel({ jobId }: { jobId: number }) {
  const db = supabaseAdmin()

  const { data: job } = await db
    .from('job_posts')
    .select('id, subject, grade, area, days_per_week, rate_amount, rate_period, status, client_id, hired_application_id, clients(id, full_name, phone, telegram_id)')
    .eq('id', jobId)
    .maybeSingle()
  if (!job) return null

  const client = job.clients as unknown as {
    id: number; full_name: string; phone: string | null; telegram_id: number | null
  } | null

  // One tap by the parent, and every message after it is automatic and free.
  let connectLink: string | null = null
  if (client && !client.telegram_id) {
    try {
      const bot = await getBot()
      connectLink = parentConnectLink(bot.botInfo.username, client.id)
    } catch {
      connectLink = null
    }
  }

  // Once hired, this panel's job is to hand over the introduction to send.
  let intro: string | null = null
  let tutorName: string | null = null

  if (job.status === 'closed_filled' && job.hired_application_id) {
    const [{ data: app }, { data: setting }] = await Promise.all([
      db.from('applications').select('candidates(full_name, phone)').eq('id', job.hired_application_id).maybeSingle(),
      db.from('settings').select('value').eq('key', 'contact_release').maybeSingle(),
    ])
    const tutor = app?.candidates as unknown as { full_name: string | null; phone: string | null } | null
    const rule = (setting?.value as { rule?: string } | null)?.rule
    const release = rule === 'on_hire' || rule === 'never' ? rule : 'after_first_payment'

    if (tutor) {
      tutorName = tutor.full_name
      intro = introductionAm(
        tutor.full_name ?? 'አስተማሪዎ',
        tutor.phone,
        { subject: job.subject, grade: job.grade, area: job.area, daysPerWeek: job.days_per_week },
        release === 'on_hire',
      )
    }
  }

  return (
    <section className="space-y-3 rounded-md border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-medium">Parent</h2>

      {client ? (
        <>
          <p className="text-sm text-neutral-600">
            {client.full_name}
            {client.phone && ` · ${client.phone}`}
            {client.telegram_id ? (
              <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                on Telegram
              </span>
            ) : (
              <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                SMS only
              </span>
            )}
          </p>

          {connectLink && (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-sm font-medium">Put them on Telegram</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                Send this link once. After they tap it, every invoice and receipt reaches them
                automatically &mdash; no SMS to send, and no 70-character limit.
              </p>
              <CopyBox text={connectLink} />
              {client.phone && (
                <a
                  href={`sms:${client.phone}?body=${encodeURIComponent(
                    `ሚሳሌ፦ መልእክቶችን በቴሌግራም ለመቀበል ይህን ይጫኑ፦ ${connectLink}`,
                  )}`}
                  className="mt-2 inline-block rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
                >
                  Open in Messages
                </a>
              )}
            </div>
          )}
        </>
      ) : (
        <form action={setClient} className="space-y-2">
          <p className="text-xs text-neutral-500">
            Add the parent before hiring — the introduction has to go to somebody.
          </p>
          <input type="hidden" name="id" value={jobId} />
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="clientName" className={input} placeholder="Parent's name" required />
            <input name="clientPhone" className={input} placeholder="09…" />
          </div>
          <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700">
            Save parent
          </button>
        </form>
      )}

      {intro && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-medium text-green-900">
            Send this to {client?.full_name ?? 'the parent'}
          </p>
          <p className="mt-0.5 text-xs text-green-800">
            {tutorName} has already been told. This is the half only you can send.
          </p>
          <CopyBox text={intro} />
          <p className="mt-1 text-xs text-green-700">{describeCost(intro)}</p>
          {client?.phone && (
            <a
              href={`sms:${client.phone}?body=${encodeURIComponent(intro)}`}
              className="mt-2 inline-block rounded-md bg-green-700 px-4 py-1.5 text-xs font-medium text-white"
            >
              Open in Messages
            </a>
          )}
        </div>
      )}
    </section>
  )
}
