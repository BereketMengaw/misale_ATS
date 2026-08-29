import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'
import { botHealth } from '@/lib/bot/health'
import { adminConnectLink } from '@/lib/messaging/connect'
import { getBot } from '@/lib/bot/bot'
import { CopyBox } from './jobs/[id]/copy-box'

export const dynamic = 'force-dynamic'

async function recentMessages() {
  const { data, error } = await supabaseAdmin()
    .from('message_log')
    .select('id, direction, telegram_id, kind, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return { rows: [], error: error.message }
  return { rows: data ?? [], error: null as string | null }
}

/**
 * The operator's own Telegram link. The dashboard runs on a laptop but SMS
 * leaves from a phone, so this is what lets a message be pushed across.
 */
async function myPhoneLink() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: operator } = await supabaseAdmin()
    .from('operators').select('telegram_id').eq('id', user.id).maybeSingle()
  if (operator?.telegram_id) return { linked: true as const, link: null }

  try {
    const bot = await getBot()
    return { linked: false as const, link: adminConnectLink(bot.botInfo.username, user.id) }
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const [health, messages, myPhone] = await Promise.all([
    botHealth(),
    recentMessages(),
    myPhoneLink(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-sm text-neutral-500">
          Step 1 — foundations. Jobs, candidates and money arrive with later steps.
        </p>
      </div>

      {myPhone && (
        <section className="rounded-md border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-medium">Your phone</h2>
          {myPhone.linked ? (
            <p className="mt-1 text-sm text-green-700">
              Linked. Any message can be pushed to your Telegram in one click.
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-xs text-neutral-500">
                Tap this once on your phone. After that, any message you need to send can be pushed
                to your Telegram and sent from there &mdash; no retyping between devices.
              </p>
              <CopyBox text={myPhone.link!} label="Copy the link" />
              <a
                href={myPhone.link!}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
              >
                Open in Telegram
              </a>
            </>
          )}
        </section>
      )}

      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-medium">Bot</h2>
        {health.ok ? (
          <dl className="mt-2 space-y-1 text-sm text-neutral-600">
            <Row label="Username" value={`@${health.username}`} />
            <Row label="Webhook" value={health.webhookUrl} />
            <Row label="Pending updates" value={String(health.pending)} />
            {health.lastError && <Row label="Last error" value={health.lastError} />}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-red-600">{health.error}</p>
        )}
      </section>

      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-medium">Recent messages</h2>
        {messages.error && <p className="mt-2 text-sm text-red-600">{messages.error}</p>}
        {!messages.error && messages.rows.length === 0 && (
          <p className="mt-2 text-sm text-neutral-500">
            Nothing yet. Send <code>/start</code> to the bot and refresh.
          </p>
        )}
        {messages.rows.length > 0 && (
          <ul className="mt-2 divide-y divide-neutral-100 text-sm">
            {messages.rows.map((m) => (
              <li key={m.id} className="flex justify-between gap-4 py-1.5">
                <span className="text-neutral-500">
                  {m.direction === 'in' ? '←' : '→'} {m.kind ?? 'update'}
                </span>
                <span className="text-neutral-400">
                  {new Date(m.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="truncate font-mono text-xs">{value}</dd>
    </div>
  )
}
