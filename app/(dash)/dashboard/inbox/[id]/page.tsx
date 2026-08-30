import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadThread } from '@/lib/conversations/service'
import type { TranscriptLine } from '@/lib/conversations/transcript'
import { Badge, Card, ErrorNote, PageHeader, PageShell } from '@/components/ui'
import { Composer } from './composer'

export const dynamic = 'force-dynamic'

/**
 * One conversation, whole.
 *
 * The bot's words and the operator's are drawn differently on purpose. Once a
 * person has typed into a thread, "did we tell them that or did I?" is a
 * question with real consequences — it is the difference between a fact from
 * knowledge.ts and a promise somebody made at nine at night — and the log is
 * the only place the answer survives.
 */
export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const telegramId = Number(id)
  if (!Number.isFinite(telegramId) || telegramId === 0) notFound()

  const { person, lines, truncated, error } = await loadThread(telegramId)

  const record =
    person.who === 'tutor' && person.personId
      ? { href: `/dashboard/people/${person.personId}`, label: 'Open their profile' }
      : person.who === 'parent' && person.personId
        ? { href: `/dashboard/people?tab=parents`, label: 'Parents' }
        : null

  return (
    <PageShell width="narrow">
      <PageHeader
        back={{ href: '/dashboard/inbox', label: 'Inbox' }}
        title={person.name}
        aside={
          person.who === 'tutor' ? (
            <Badge>Tutor</Badge>
          ) : person.who === 'parent' ? (
            <Badge tone="blue">Parent</Badge>
          ) : (
            <Badge tone="faded">Not in the system</Badge>
          )
        }
        subtitle={
          [person.phone, `Telegram ${person.telegramId}`].filter(Boolean).join(' · ')
        }
        action={
          record ? (
            <Link
              href={record.href}
              className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
            >
              {record.label}
            </Link>
          ) : undefined
        }
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      {truncated && (
        <p className="text-xs text-neutral-400">
          Showing the most recent part of a long conversation — scroll up for the rest of it.
          Everything older than that is still in the log.
        </p>
      )}

      <Card className="p-4">
        {lines.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">
            Nothing readable in this thread yet.
          </p>
        ) : (
          /*
           * Opens on the newest message, the way every chat anybody has ever
           * used does. `flex-col-reverse` is what does it: it makes scrollTop 0
           * mean the BOTTOM, so the browser lands there on its own — no effect,
           * no scrolling after paint, and it stays pinned when a sent message
           * appears. The list inside keeps its natural oldest-first order, so
           * reading order and copy-paste are unaffected.
           *
           * max-h caps without setting a height, so a four-line thread is still
           * four lines rather than a short conversation stranded at the bottom
           * of a tall empty box.
           */
          <div className="flex max-h-[60vh] flex-col-reverse overflow-y-auto">
            <ol className="space-y-3">
              {lines.map((line) => (
                <Line key={`${line.via}-${line.id}`} line={line} />
              ))}
            </ol>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <p className="mb-2 text-xs text-neutral-500">
          Your own words, sent from the bot they already know. The bot keeps answering their
          questions either way — sending this puts nobody on hold.
        </p>
        <Composer telegramId={person.telegramId} audience={person.who} name={person.name} />
      </Card>
    </PageShell>
  )
}

const SIDE = {
  them: {
    row: 'items-start',
    bubble: 'bg-neutral-100 text-neutral-900',
    who: 'Them',
  },
  bot: {
    row: 'items-end flex-row-reverse',
    bubble: 'bg-white border border-neutral-200 text-neutral-700',
    who: 'Bot',
  },
  operator: {
    row: 'items-end flex-row-reverse',
    bubble: 'bg-neutral-900 text-white',
    who: 'You',
  },
} as const

function Line({ line }: { line: TranscriptLine }) {
  const style = SIDE[line.side]

  return (
    <li className={`flex gap-3 ${style.row}`}>
      <div className="max-w-[80%] min-w-0">
        <p
          className={`flex items-baseline gap-2 text-[11px] text-neutral-400 ${
            line.side === 'them' ? '' : 'justify-end'
          }`}
        >
          <span>{style.who}</span>
          {line.via === 'sms' && <span className="text-neutral-400">· by SMS</span>}
          <time dateTime={line.at}>{when(line.at)}</time>
        </p>

        {line.event && (
          <p
            className={`mt-0.5 text-xs italic text-neutral-500 ${
              line.side === 'them' ? '' : 'text-right'
            }`}
          >
            {line.event}
          </p>
        )}

        {line.text && (
          <p className={`mt-1 whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${style.bubble}`}>
            {line.text}
          </p>
        )}
      </div>
    </li>
  )
}

function when(at: string): string {
  const d = new Date(at)
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
