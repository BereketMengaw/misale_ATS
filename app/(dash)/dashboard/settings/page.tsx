import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'
import { botHealth } from '@/lib/bot/health'
import { getBot } from '@/lib/bot/bot'
import { adminConnectLink } from '@/lib/messaging/connect'
import { discoveredChats } from '@/lib/telegram/discovered'
import { Badge, Card, CardHead, EmptyState, ErrorNote, PageHeader, PageShell, Row, Rows } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { buttonClass } from '@/components/ui/styles'
import { CopyBox } from '@/components/ui/copy-box'
import { ChannelForm } from './channel-form'
import { addDiscoveredChannel, recheckChannel, setChannelActive, setContactRelease } from './actions'

export const dynamic = 'force-dynamic'

/**
 * Setup and diagnostics. None of this is daily work, which is why it stopped
 * being the home page: the old dashboard opened on webhook status and a raw
 * message log.
 */
export default async function SettingsPage() {
  const db = supabaseAdmin()

  const [{ data: channels, error }, discovered, health, myPhone, messages, { data: release }] = await Promise.all([
    db.from('channels').select('*').order('created_at', { ascending: true }),
    discoveredChats(),
    botHealth(),
    myPhoneLink(),
    db
      .from('message_log')
      .select('id, direction, kind, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    db.from('settings').select('value').eq('key', 'contact_release').maybeSingle(),
  ])

  const rule = (release?.value as { rule?: string } | null)?.rule ?? 'after_first_payment'

  const known = new Set((channels ?? []).map((c) => c.chat_id))
  const available = discovered.filter((d) => !known.has(d.chatId))

  return (
    <PageShell width="narrow">
      <PageHeader title="Settings" subtitle="Where jobs get posted, and whether the bot is alive." />

      {myPhone && (
        <Card className="p-4">
          <CardHead title="Your phone" />
          {myPhone.linked ? (
            <p className="mt-1 text-sm text-green-700">
              Linked. Any message can be pushed to your Telegram in one click.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-neutral-500">
                Tap this once on your phone. After that, any message you need to send can be pushed
                to your Telegram and sent from there &mdash; no retyping between devices.
              </p>
              <CopyBox text={myPhone.link} label="Copy the link" />
              <a
                href={myPhone.link}
                target="_blank"
                rel="noreferrer"
                className={`mt-2 ${buttonClass('primary', 'sm')}`}
              >
                Open in Telegram
              </a>
            </>
          )}
        </Card>
      )}

      {available.length > 0 && (
        <Card className="p-4">
          <CardHead
            title="The bot has been added to these"
            aside="Telegram told us the moment you made it an admin"
          />
          <ul className="mt-3 space-y-2">
            {available.map((d) => (
              <li
                key={d.chatId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-200 p-3"
              >
                <div>
                  <p className="text-sm font-medium">{d.title}</p>
                  <p className="text-xs text-neutral-500">
                    {d.type} · bot is {d.status}
                    {d.username && ` · @${d.username}`}
                  </p>
                </div>
                <form action={addDiscoveredChannel}>
                  <input type="hidden" name="chatId" value={d.chatId} />
                  <input type="hidden" name="title" value={d.title} />
                  <Button variant="primary" size="sm" pendingLabel="Adding…">
                    Add
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="space-y-2">
        <CardHead title="Channels" aside="The bot posts where it is an admin; elsewhere you get a copy pack" />

        {error && <ErrorNote>{error.message}</ErrorNote>}

        {(channels?.length ?? 0) === 0 && !error ? (
          <EmptyState>No channels yet. Start with a private test channel.</EmptyState>
        ) : (
          <Card>
            <Rows>
              {channels?.map((c) => (
                <Row key={c.id}>
                  <div className="min-w-0 grow">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {c.title}
                      {!c.active && <Badge tone="faded">Paused</Badge>}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {c.kind === 'bot_admin' ? 'Bot posts automatically' : 'Post by hand'}
                      {c.username && ` · @${c.username}`}
                    </p>
                    {c.last_check_detail && (
                      <p className={`mt-1 text-xs ${c.last_check_ok ? 'text-green-700' : 'text-amber-700'}`}>
                        {c.last_check_detail}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <form action={recheckChannel}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button variant="secondary" size="sm" pendingLabel="Checking…">
                        Re-check
                      </Button>
                    </form>
                    <form action={setChannelActive}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="active" value={c.active ? '0' : '1'} />
                      <Button variant="secondary" size="sm" pendingLabel="Saving…">
                        {c.active ? 'Pause' : 'Resume'}
                      </Button>
                    </form>
                  </div>
                </Row>
              ))}
            </Rows>
          </Card>
        )}

        <details className="rounded-md border border-neutral-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Add one by hand (a channel you do not own)
          </summary>
          <div className="mt-3">
            <ChannelForm />
          </div>
        </details>
      </div>

      <Card className="p-4">
        <CardHead
          title="When each side gets the other's number"
          aside="Decides what the parent is told at the hire"
        />
        <div className="mt-3 flex flex-col gap-2">
          {CONTACT_RULES.map((option) => (
            <form action={setContactRelease} key={option.value}>
              <input type="hidden" name="rule" value={option.value} />
              <button
                className={`flex w-full flex-col gap-0.5 rounded-md border p-3 text-left transition-colors ${
                  rule === option.value
                    ? 'border-neutral-900 bg-neutral-50'
                    : 'border-neutral-200 bg-white hover:bg-neutral-50'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {option.label}
                  {rule === option.value && <Badge tone="green">In use</Badge>}
                </span>
                <span className="text-xs text-neutral-500">{option.detail}</span>
              </button>
            </form>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <CardHead title="Bot" />
        {health.ok ? (
          <dl className="mt-2 space-y-1 text-sm text-neutral-600">
            <HealthRow label="Username" value={`@${health.username}`} />
            <HealthRow label="Webhook" value={health.webhookUrl} />
            <HealthRow label="Pending updates" value={String(health.pending)} />
            {health.lastError && <HealthRow label="Last error" value={health.lastError} />}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-red-600">{health.error}</p>
        )}
      </Card>

      <Card className="p-4">
        <CardHead title="Recent bot traffic" aside="The last ten updates" />
        {(messages.data?.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Nothing yet. Send <code>/start</code> to the bot and refresh.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100 text-sm">
            {messages.data!.map((m) => (
              <li key={m.id} className="flex justify-between gap-4 py-1.5">
                <span className="text-neutral-500">
                  {m.direction === 'in' ? '←' : '→'} {m.kind ?? 'update'}
                </span>
                <span className="text-neutral-400">{new Date(m.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  )
}

const CONTACT_RULES = [
  {
    value: 'on_hire',
    label: 'At the hire',
    detail:
      "The introduction carries the tutor's number, and the tutor is given the parent's. Fastest for everyone, and it trusts both sides not to cut you out of next month.",
  },
  {
    value: 'after_first_payment',
    label: 'After the first payment',
    detail:
      'Both sides wait until the first invoice is paid. Covers the month of highest exposure; until then the bot is the only channel.',
  },
  {
    value: 'never',
    label: 'Never',
    detail: 'First names and area only. The bot stays the way lessons are arranged, permanently.',
  },
]

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="truncate font-mono text-xs">{value}</dd>
    </div>
  )
}

/**
 * The operator's own Telegram link. The dashboard runs on a laptop but SMS
 * leaves from a phone, so this is what lets a message be pushed across.
 */
async function myPhoneLink(): Promise<{ linked: true; link: null } | { linked: false; link: string } | null> {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: operator } = await supabaseAdmin()
    .from('operators')
    .select('telegram_id')
    .eq('id', user.id)
    .maybeSingle()
  if (operator?.telegram_id) return { linked: true, link: null }

  try {
    const bot = await getBot()
    return { linked: false, link: adminConnectLink(bot.botInfo.username, user.id) }
  } catch {
    return null
  }
}
