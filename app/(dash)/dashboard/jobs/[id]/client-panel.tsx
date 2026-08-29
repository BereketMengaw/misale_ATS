import { supabaseAdmin } from '@/lib/supabase/admin'
import { introductionAm } from '@/lib/messaging/parent'
import { parentConnectLink } from '@/lib/messaging/connect'
import { getBot } from '@/lib/bot/bot'
import { setClient } from '../actions'
import { SendCard } from '@/components/send-card'
import { Badge, Field, TextInput } from '@/components/ui'
import { Button } from '@/components/ui/button'

export type JobForIntro = {
  id: number
  subject: string
  grade: string
  area: string
  days_per_week: number
  status: string
  hired_application_id: number | null
}

export type Client = {
  id: number
  full_name: string
  phone: string | null
  telegram_id: number | null
} | null

/**
 * The parent paying for the lessons. Needed before a hire can be introduced to
 * anyone, and needed again for an invoice.
 */
export async function ClientPanel({ job, client }: { job: JobForIntro; client: Client }) {
  const db = supabaseAdmin()

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
    <div className="space-y-3">
      {client ? (
        <>
          <p className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
            <span className="font-medium text-neutral-900">{client.full_name}</span>
            {client.phone && <span>{client.phone}</span>}
            {client.telegram_id ? <Badge tone="green">On Telegram</Badge> : <Badge>SMS only</Badge>}
          </p>

          {connectLink && (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-sm font-medium">Put them on Telegram</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                Send this link once. After they tap it, every invoice and receipt reaches them
                automatically &mdash; no SMS to send, and no 70-character limit.
              </p>
              <SendCard
                phone={client.phone}
                recipient={client.full_name}
                body={`ሚሳሌ፦ መልእክቶችን በቴሌግራም ለመቀበል ይህን ይጫኑ፦ ${connectLink}`}
              />
            </div>
          )}
        </>
      ) : (
        <form action={setClient} className="space-y-3">
          <p className="text-xs text-neutral-500">
            Add the parent before hiring &mdash; the introduction has to go to somebody.
          </p>
          <input type="hidden" name="id" value={job.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Parent's name">
              <TextInput name="clientName" placeholder="Full name" required />
            </Field>
            <Field label="Phone">
              <TextInput name="clientPhone" placeholder="09…" inputMode="tel" />
            </Field>
          </div>
          <Button variant="secondary" size="sm" pendingLabel="Saving…">
            Save parent
          </Button>
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
          <SendCard phone={client?.phone ?? null} body={intro} recipient={client?.full_name ?? 'the parent'} />
        </div>
      )}
    </div>
  )
}
