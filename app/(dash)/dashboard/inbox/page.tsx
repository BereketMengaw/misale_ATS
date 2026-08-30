import Link from 'next/link'
import { listThreads, PAGE } from '@/lib/conversations/service'
import { ago } from '@/lib/conversations/transcript'
import { Badge, Card, EmptyState, ErrorNote, LinkRow, PageHeader, PageShell, Rows } from '@/components/ui'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

/**
 * Every conversation the bot has had, in one place.
 *
 * Read the note at the top of supabase/migrations/0019_conversations.sql before
 * adding anything here. There is no unread count, nothing feeds the Today
 * badge, and no row on this page is work: the bot answered every one of these
 * people at the time. This is a record he can look at, and — when he chooses —
 * speak into. It is not a queue, and the day it becomes one the rule in
 * CLAUDE.md has been broken.
 */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; who?: string; spoke?: string; page?: string }>
}) {
  const { q = '', who = 'all', spoke = '', page = '0' } = await searchParams
  const pageNumber = Math.max(0, Number(page) || 0)
  const theySpokeLast = spoke === 'them'

  const { threads, total, error } = await listThreads({
    q,
    who,
    theySpokeLast,
    page: pageNumber,
  })

  const query = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams()
    const merged = { q, who, spoke, page: pageNumber, ...patch }
    for (const [key, value] of Object.entries(merged)) {
      const v = String(value ?? '')
      if (v && v !== '0' && !(key === 'who' && v === 'all')) params.set(key, v)
    }
    const s = params.toString()
    return `/dashboard/inbox${s ? `?${s}` : ''}`
  }

  const filtered = Boolean(q || who !== 'all' || theySpokeLast)
  const lastPage = Math.max(0, Math.ceil(total / PAGE) - 1)

  return (
    <PageShell>
      <PageHeader
        title="Inbox"
        subtitle="Everything the bot and a person have said to each other. Nobody here is waiting on you — the bot answered them at the time. Open one to read it, or to say something yourself."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Tab href={query({ who: 'all', page: 0 })} active={who === 'all'}>
            Everyone
          </Tab>
          <Tab href={query({ who: 'tutor', page: 0 })} active={who === 'tutor'}>
            Tutors
          </Tab>
          <Tab href={query({ who: 'parent', page: 0 })} active={who === 'parent'}>
            Parents
          </Tab>
        </div>

        {/* One GET form, so every view is a URL that can be bookmarked. */}
        <form className="flex flex-wrap items-center gap-2">
          {who !== 'all' && <input type="hidden" name="who" value={who} />}
          <input
            name="q"
            defaultValue={q}
            aria-label="Search conversations"
            placeholder="Search name, phone or Telegram id"
            className="w-64 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
          />
          <select
            name="spoke"
            defaultValue={spoke}
            aria-label="Who spoke last"
            className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm focus:border-neutral-900 focus:outline-none"
          >
            <option value="">Anyone spoke last</option>
            <option value="them">They spoke last</option>
          </select>
          <Button variant="secondary" size="sm">Apply</Button>
          {filtered && (
            <Link href="/dashboard/inbox" className="text-xs text-neutral-500 underline underline-offset-2">
              Clear
            </Link>
          )}
        </form>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {!error && threads.length === 0 && (
        <EmptyState
          action={
            filtered ? (
              <Link href="/dashboard/inbox" className="text-sm underline underline-offset-2">
                Clear the filters
              </Link>
            ) : undefined
          }
        >
          {filtered
            ? 'No conversation matches that.'
            : 'Nothing yet. A thread appears the moment somebody opens the bot.'}
        </EmptyState>
      )}

      {!error && threads.length > 0 && (
        <Card>
          <Rows>
            {threads.map((t) => (
              <LinkRow key={t.telegramId} href={`/dashboard/inbox/${t.telegramId}`}>
                <div className="min-w-0 grow">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {t.name}
                    {t.who === 'tutor' && <Badge>Tutor</Badge>}
                    {t.who === 'parent' && <Badge tone="blue">Parent</Badge>}
                    {t.who === 'unknown' && <Badge tone="faded">Not in the system</Badge>}
                    {t.lastOperatorAt && (
                      <span className="text-xs font-normal text-neutral-400">
                        you wrote {ago(t.lastOperatorAt)}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">
                    <span className="text-neutral-400">
                      {t.lastDirection === 'in' ? 'Them: ' : 'Bot: '}
                    </span>
                    {t.lastText || <span className="italic text-neutral-400">no words — a tap or a file</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {t.inboundCount + t.outboundCount} messages
                    {t.phone ? ` · ${t.phone}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-neutral-400">{ago(t.lastAt)}</span>
              </LinkRow>
            ))}
          </Rows>
        </Card>
      )}

      {total > PAGE && (
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>
            {pageNumber * PAGE + 1}–{pageNumber * PAGE + threads.length} of {total}
          </span>
          <span className="flex gap-3">
            {pageNumber > 0 && (
              <Link href={query({ page: pageNumber - 1 })} className="underline underline-offset-2">
                Newer
              </Link>
            )}
            {pageNumber < lastPage && (
              <Link href={query({ page: pageNumber + 1 })} className="underline underline-offset-2">
                Older
              </Link>
            )}
          </span>
        </div>
      )}
    </PageShell>
  )
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
        active
          ? 'bg-neutral-900 font-medium text-white'
          : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
      }`}
    >
      {children}
    </Link>
  )
}
