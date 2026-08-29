import { supabaseAdmin } from '@/lib/supabase/admin'
import { ChannelForm } from './channel-form'
import { discoveredChats } from '@/lib/telegram/discovered'
import { addDiscoveredChannel, recheckChannel, setChannelActive } from './actions'

export const dynamic = 'force-dynamic'

export default async function ChannelsPage() {
  const [{ data: channels, error }, discovered] = await Promise.all([
    supabaseAdmin().from('channels').select('*').order('created_at', { ascending: true }),
    discoveredChats(),
  ])

  const known = new Set((channels ?? []).map((c) => c.chat_id))
  const available = discovered.filter((d) => !known.has(d.chatId))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Channels</h1>
        <p className="text-sm text-neutral-500">
          Where jobs get posted. The bot posts automatically where it is an admin; everywhere else
          you get a copy pack.
        </p>
      </div>

      {available.length > 0 && (
        <section className="rounded-md border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-medium">The bot has been added to these</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Telegram told us the moment you made it an admin. One click, no ID to copy.
          </p>
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
                  <button className="rounded-md bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white">
                    Add
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="rounded-md border border-neutral-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Add one by hand (a channel you do not own)
        </summary>
        <div className="mt-3">
          <ChannelForm />
        </div>
      </details>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {(channels?.length ?? 0) === 0 && !error && (
        <p className="rounded-md border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
          No channels yet. Start with a private test channel.
        </p>
      )}

      <ul className="space-y-2">
        {channels?.map((c) => (
          <li key={c.id} className="rounded-md border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {c.title}
                  {!c.active && <span className="ml-2 text-xs text-neutral-400">(paused)</span>}
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
              <div className="flex gap-2">
                <form action={recheckChannel}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700">
                    Re-check
                  </button>
                </form>
                <form action={setChannelActive}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="active" value={c.active ? '0' : '1'} />
                  <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700">
                    {c.active ? 'Pause' : 'Resume'}
                  </button>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
