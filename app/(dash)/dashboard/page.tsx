import { supabaseAdmin } from '@/lib/supabase/admin'
import { botHealth } from '@/lib/bot/health'

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

export default async function DashboardPage() {
  const [health, messages] = await Promise.all([botHealth(), recentMessages()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-sm text-neutral-500">
          Step 1 — foundations. Jobs, candidates and money arrive with later steps.
        </p>
      </div>

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
