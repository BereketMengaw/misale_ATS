'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkChannel } from '@/lib/telegram/publish'

export type ChannelFormState = { error?: string; ok?: string }

/**
 * Adding a channel checks it immediately. A channel the bot cannot post to is
 * still worth keeping — it becomes a manual one, with a copy pack.
 */
export async function addChannel(
  _prev: ChannelFormState,
  formData: FormData,
): Promise<ChannelFormState> {
  const target = String(formData.get('target') ?? '').trim()
  const language = String(formData.get('language') ?? 'both')
  const fallbackTitle = String(formData.get('title') ?? '').trim()

  if (!target && !fallbackTitle) return { error: 'Give a @username, a chat id, or a name.' }

  const check = target ? await checkChannel(target) : { ok: false, detail: 'Manual channel.' }

  const { error } = await supabaseAdmin()
    .from('channels')
    .insert({
      title: check.title ?? fallbackTitle ?? target,
      chat_id: check.chatId ?? null,
      username: check.username ?? (target.startsWith('@') ? target.slice(1) : null),
      kind: check.ok ? 'bot_admin' : 'manual',
      language,
      last_check_at: new Date().toISOString(),
      last_check_ok: check.ok,
      last_check_detail: check.detail,
    })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/channels')
  return {
    ok: check.ok
      ? 'Added. The bot can post here automatically.'
      : `Added as a manual channel — ${check.detail}`,
  }
}

/** Re-ask Telegram. Admin rights get revoked without telling anyone. */
export async function recheckChannel(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'))
  const db = supabaseAdmin()

  const { data: channel } = await db
    .from('channels')
    .select('id, chat_id, username')
    .eq('id', id)
    .maybeSingle()
  if (!channel) return

  const target = channel.chat_id ? String(channel.chat_id) : (channel.username ?? '')
  if (!target) return

  const check = await checkChannel(target)

  await db
    .from('channels')
    .update({
      kind: check.ok ? 'bot_admin' : 'manual',
      chat_id: check.chatId ?? channel.chat_id,
      title: check.title ?? undefined,
      last_check_at: new Date().toISOString(),
      last_check_ok: check.ok,
      last_check_detail: check.detail,
    })
    .eq('id', id)

  revalidatePath('/dashboard/channels')
}

export async function setChannelActive(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'))
  const active = formData.get('active') === '1'
  if (!id) return

  await supabaseAdmin().from('channels').update({ active }).eq('id', id)
  revalidatePath('/dashboard/channels')
}
