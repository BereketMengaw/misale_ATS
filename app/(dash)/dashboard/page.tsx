import { loadToday, type Decision, type Sendable } from '@/lib/dashboard/today'
import { smsCost } from '@/lib/messaging/sms'
import { outboxPurposeLabel } from '@/lib/ui/labels'
import { SendCard } from '@/components/send-card'
import { Button } from '@/components/ui/button'
import { ActionForm, Badge, Card, CardHead, ErrorNote, LinkButton, PageHeader, PageShell, Row, Rows } from '@/components/ui'
import { markSent, markQuitNoticeHandled } from './actions'
import { hire, presentTop } from './jobs/actions'
import { queueMessage } from './money/actions'

export const dynamic = 'force-dynamic'

/**
 * The inbox this dashboard never had.
 *
 * Two queues and nothing else: messages only he can send, and decisions that
 * are one tap each. Bot health and the raw message log moved to Settings —
 * they are how you debug the bot, not how you run the agency.
 */
export default async function TodayPage() {
  const { sendables, decisions, running, error } = await loadToday()
  const nothing = sendables.length === 0 && decisions.length === 0

  return (
    <PageShell>
      <PageHeader title="Today" subtitle="Everything waiting on you, in the order it matters." />

      {error && <ErrorNote>{error}</ErrorNote>}

      {sendables.length > 0 && (
        <Card tone="attention" className="space-y-3 p-4">
          <CardHead
            tone="attention"
            title={`To send · ${sendables.length}`}
            aside={<span className="text-amber-800">Nothing here sends itself &mdash; you tap send, from your own number.</span>}
          />
          {sendables.map((m, i) => (
            <SendRow key={m.id} message={m} open={i === 0} />
          ))}
        </Card>
      )}

      {decisions.length > 0 && (
        <Card>
          <CardHead
            title={`Waiting on you · ${decisions.length}`}
            aside="One tap each. Nothing here is a conversation."
            className="p-4 pb-3"
          />
          <Rows>
            {decisions.map((d) => (
              <Row key={d.key}>
                <div className="min-w-0 grow">
                  <p className="text-sm font-medium">{d.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">{d.detail}</p>
                  {d.kind === 'present' && (
                    <p className="mt-1 text-xs text-neutral-500">
                      <span className="font-medium text-neutral-700">They will be told:</span> {d.terms}
                    </p>
                  )}
                  {d.kind === 'quit' && (
                    <>
                      {/* Their own words: "next month" and "I stopped
                          yesterday" are the same row otherwise. */}
                      <p className="mt-1 text-xs text-neutral-500">
                        <span className="font-medium text-neutral-700">They said:</span> “{d.said}”
                      </p>
                      {d.phone && (
                        <p className="mt-0.5 text-xs text-neutral-500">
                          <a className="underline" href={`tel:${d.phone}`}>{d.phone}</a>
                        </p>
                      )}
                    </>
                  )}
                </div>
                <DecisionAction decision={d} />
              </Row>
            ))}
          </Rows>
        </Card>
      )}

      {nothing && !error && (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">Nothing needs you right now.</p>
          <p className="mt-1 text-sm text-neutral-500">
            Applicants, accepted tutors and unpaid invoices all surface here on their own.
          </p>
        </Card>
      )}

      <p className="text-xs text-neutral-400">
        {running.liveJobs} job{running.liveJobs === 1 ? '' : 's'} live · {running.poolSize} tutor
        {running.poolSize === 1 ? '' : 's'} in the pool · {running.placements} placement
        {running.placements === 1 ? '' : 's'} running
      </p>
    </PageShell>
  )
}

/**
 * One queued message. The first is open with everything needed to send it;
 * the rest stay one line each, because three QR codes stacked up is not a
 * queue, it is a wall.
 */
function SendRow({ message, open }: { message: Sendable; open: boolean }) {
  const cost = smsCost(message.body)
  const script = cost.encoding === 'UCS-2' ? 'Amharic' : 'English'

  return (
    <details open={open} className="rounded-md border border-amber-200 bg-white p-3">
      <summary className="flex cursor-pointer flex-wrap items-center gap-3">
        <span className="text-sm font-medium">{message.recipient}</span>
        {message.phone && <span className="text-xs text-neutral-500">{message.phone}</span>}
        <span className="text-xs text-neutral-500">{outboxPurposeLabel(message.purpose)}</span>
        {message.lateBy !== null && <Badge tone="red">{message.lateBy} days late</Badge>}
        <span className="text-xs text-neutral-400">
          {cost.segments} SMS · {script}
        </span>
      </summary>

      <SendCard phone={message.phone} body={message.body} recipient={message.recipient} />

      <form action={markSent} className="mt-3">
        <input type="hidden" name="outboxId" value={message.id} />
        <Button variant="secondary" size="sm" pendingLabel="Saving…">
          Mark sent
        </Button>
      </form>
    </details>
  )
}

/** Each decision carries exactly one button, and it is the obvious one. */
function DecisionAction({ decision }: { decision: Decision }) {
  switch (decision.kind) {
    case 'quit':
      // A plain form, like Mark sent: this records that it is handled rather
      // than driving a step of the pipeline, so there is no state to return.
      return (
        <form action={markQuitNoticeHandled}>
          <input type="hidden" name="noticeId" value={decision.noticeId} />
          <Button variant="primary" size="sm" pendingLabel="Marking…">
            I have dealt with it
          </Button>
        </form>
      )
    case 'hire':
      return (
        <ActionForm action={hire} fields={{ id: decision.jobId, applicationId: decision.applicationId }}>
          <Button variant="success" size="sm" pendingLabel="Hiring…">
            Hire {decision.firstName}
          </Button>
        </ActionForm>
      )
    case 'present':
      return (
        <ActionForm action={presentTop} fields={{ id: decision.jobId, size: decision.size }}>
          <Button
            variant="primary"
            size="sm"
            pendingLabel="Asking…"
            confirm={`Message ${decision.size} tutor(s) with these terms? ${decision.terms} This cannot be unsent.`}
          >
            Ask top {decision.size}
          </Button>
        </ActionForm>
      )
    case 'blocked':
      // Nothing to offer: the only way forward is changing the job itself.
      return (
        <LinkButton href={`/dashboard/jobs/${decision.jobId}`} variant="secondary" size="sm">
          Open the job
        </LinkButton>
      )
    case 'publish':
      // Which channels is a real choice, so this goes to the job rather than
      // guessing on his behalf.
      return (
        <LinkButton href={`/dashboard/jobs/${decision.jobId}#publishing`} variant="primary" size="sm">
          Publish
        </LinkButton>
      )
    case 'chase':
      return (
        <form action={queueMessage}>
          <input type="hidden" name="invoiceId" value={decision.invoiceId} />
          <input type="hidden" name="chase" value={decision.late ? '1' : '0'} />
          <Button variant="secondary" size="sm" pendingLabel="Queueing…">
            {decision.late ? 'Queue chase' : 'Queue invoice'}
          </Button>
        </form>
      )
  }
}
