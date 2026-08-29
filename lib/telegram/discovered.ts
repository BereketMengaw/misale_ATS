import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Channels and groups the bot has been added to.
 *
 * Telegram sends a `my_chat_member` update the moment someone makes the bot an
 * admin, and the webhook logs every update. So the system already knows every
 * place it can post — the operator should never have to hunt for a chat id.
 */
export type Discovered = {
  chatId: number
  title: string
  type: string
  status: string
  username: string | null
  seenAt: string
}

type LogRow = { payload: unknown; created_at: string }

export async function discoveredChats(): Promise<Discovered[]> {
  const { data } = await supabaseAdmin()
    .from('message_log')
    .select('payload, created_at')
    .eq('kind', 'other')
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<LogRow[]>()

  const found = new Map<number, Discovered>()

  for (const row of data ?? []) {
    const update = row.payload as { my_chat_member?: Record<string, any> } | null
    const event = update?.my_chat_member
    if (!event?.chat || !event.new_chat_member) continue

    const chat = event.chat
    if (chat.type !== 'channel' && chat.type !== 'group' && chat.type !== 'supergroup') continue

    // Newest first, so the first sighting of a chat is its current state.
    if (found.has(chat.id)) continue

    found.set(chat.id, {
      chatId: chat.id,
      title: chat.title ?? 'Untitled',
      type: chat.type,
      status: event.new_chat_member.status,
      username: chat.username ?? null,
      seenAt: row.created_at,
    })
  }

  // A bot that has since been removed is not somewhere we can post.
  return [...found.values()].filter((c) => c.status !== 'left' && c.status !== 'kicked')
}
