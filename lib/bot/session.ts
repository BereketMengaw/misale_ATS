import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Lang } from './copy'

/**
 * Bot conversation state. Postgres, never memory — the webhook is stateless
 * and may run on any instance.
 */
export type SessionData = {
  lang?: Lang
  /** Deep-link payload the user arrived with, e.g. job_12. */
  entry?: string
  [key: string]: unknown
}

export type Session = {
  telegram_id: number
  chat_id: number
  flow: string | null
  step: string | null
  data: SessionData
}

export async function getSession(telegramId: number): Promise<Session | null> {
  const { data, error } = await supabaseAdmin()
    .from('bot_sessions')
    .select('telegram_id, chat_id, flow, step, data')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  if (error) throw error
  return (data as Session) ?? null
}

export async function saveSession(
  telegramId: number,
  chatId: number,
  patch: { flow?: string | null; step?: string | null; data?: SessionData },
): Promise<Session> {
  const current = await getSession(telegramId)

  const next = {
    telegram_id: telegramId,
    chat_id: chatId,
    flow: patch.flow !== undefined ? patch.flow : (current?.flow ?? null),
    step: patch.step !== undefined ? patch.step : (current?.step ?? null),
    data: { ...(current?.data ?? {}), ...(patch.data ?? {}) },
  }

  const { data, error } = await supabaseAdmin()
    .from('bot_sessions')
    .upsert(next, { onConflict: 'telegram_id' })
    .select('telegram_id, chat_id, flow, step, data')
    .single()

  if (error) throw error
  return data as Session
}

/** End the current flow but keep what we know about the person (language, etc.). */
export async function clearFlow(telegramId: number, chatId: number): Promise<void> {
  await saveSession(telegramId, chatId, { flow: null, step: null })
}
