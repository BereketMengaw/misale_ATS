import { supabaseAdmin } from '@/lib/supabase/admin'

type LogEntry = {
  direction: 'in' | 'out'
  telegramId?: number | null
  chatId?: number | null
  kind?: string | null
  payload?: unknown
  /** Set only when a person typed it. Everything the bot generates leaves it null. */
  operatorId?: string | null
}

/**
 * Best-effort. A logging failure must never cost us a reply to the user,
 * so this swallows its own errors.
 */
export async function logMessage(entry: LogEntry): Promise<void> {
  try {
    await supabaseAdmin().from('message_log').insert({
      direction: entry.direction,
      telegram_id: entry.telegramId ?? null,
      chat_id: entry.chatId ?? null,
      kind: entry.kind ?? null,
      payload: entry.payload ?? null,
      operator_id: entry.operatorId ?? null,
    })
  } catch (err) {
    console.error('message_log insert failed', err)
  }
}
