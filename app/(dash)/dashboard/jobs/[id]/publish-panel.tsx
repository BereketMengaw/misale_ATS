import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { manualPackFor } from '@/lib/telegram/publish'
import { markManualPosted, publishToChannels } from '../actions'
import { CopyBox } from './copy-box'

type Props = { jobId: number; approved: boolean }

export async function PublishPanel({ jobId, approved }: Props) {
  const db = supabaseAdmin()

  const [{ data: channels }, { data: publications }] = await Promise.all([
    db.from('channels').select('id, title, kind, language, active').eq('active', true).order('id'),
    db
      .from('post_publications')
      .select('id, channel_id, method, message_id, posted_at, apply_count, error, channels(title)')
      .eq('job_post_id', jobId),
  ])

  const publishedTo = new Set((publications ?? []).map((p) => p.channel_id))
  const available = (channels ?? []).filter((c) => !publishedTo.has(c.id))

  // Only manual publications that are still unposted need their pack rendering.
  const packs = new Map<number, string>()
  for (const p of publications ?? []) {
    if (p.method === 'manual' && !p.posted_at) {
      const pack = await manualPackFor(p.id)
      if (pack) packs.set(p.id, pack)
    }
  }

  return (
    <section className="space-y-4 rounded-md border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-medium">Publishing</h2>

      {(publications?.length ?? 0) > 0 && (
        <ul className="space-y-3">
          {publications!.map((p) => {
            const title = (p.channels as unknown as { title: string } | null)?.title ?? 'Channel'
            const pack = packs.get(p.id)
            return (
              <li key={p.id} className="rounded-md border border-neutral-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-neutral-500">
                      {p.posted_at
                        ? `Posted ${new Date(p.posted_at).toLocaleString()}`
                        : p.method === 'manual'
                          ? 'Waiting to be posted by hand'
                          : 'Not sent'}
                      {' · '}
                      {p.apply_count} {p.apply_count === 1 ? 'apply tap' : 'apply taps'}
                    </p>
                    {p.error && <p className="mt-1 text-xs text-red-600">{p.error}</p>}
                  </div>
                  {p.method === 'manual' && !p.posted_at && (
                    <form action={markManualPosted}>
                      <input type="hidden" name="id" value={jobId} />
                      <input type="hidden" name="publicationId" value={p.id} />
                      <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700">
                        Mark posted
                      </button>
                    </form>
                  )}
                </div>
                {pack && <CopyBox text={pack} />}
              </li>
            )
          })}
        </ul>
      )}

      {!approved && (
        <p className="text-sm text-neutral-500">Approve the post before publishing it.</p>
      )}

      {approved && available.length === 0 && (
        <p className="text-sm text-neutral-500">
          {(channels?.length ?? 0) === 0 ? (
            <>
              No active channels yet —{' '}
              <Link href="/dashboard/channels" className="underline underline-offset-2">
                add one
              </Link>
              .
            </>
          ) : (
            'Published to every active channel.'
          )}
        </p>
      )}

      {approved && available.length > 0 && (
        <form action={publishToChannels} className="space-y-3">
          <input type="hidden" name="id" value={jobId} />
          <ul className="space-y-1">
            {available.map((c) => (
              <li key={c.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="channelIds" value={c.id} defaultChecked />
                  <span>{c.title}</span>
                  <span className="text-xs text-neutral-400">
                    {c.kind === 'bot_admin' ? 'auto' : 'copy pack'}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
            Publish
          </button>
        </form>
      )}
    </section>
  )
}
