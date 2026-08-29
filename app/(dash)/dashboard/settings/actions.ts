'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkChannel, type ChannelCheck } from '@/lib/telegram/publish'

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
  const fallbackTitle = String(formData.get('title') ?? '').trim()

  if (!target && !fallbackTitle) return { error: 'Give a @username, a chat id, or a name.' }

  // Nothing past here may throw: a server action that throws shows the operator
  // a blank failure instead of a reason.
  try {
    const check: ChannelCheck = target
      ? await checkChannel(target)
      : { ok: false, detail: 'Added by name only — the bot was never asked about it.' }

    // A failed lookup with no name to fall back on is a typo, not a manual
    // channel. Saving it would leave an unusable row and hide the mistake.
    if (!check.ok && !fallbackTitle) {
      return { error: `Telegram could not find that: ${check.detail}` }
    }

    const { error } = await supabaseAdmin()
      .from('channels')
      .insert({
        title: check.title || fallbackTitle || target,
        chat_id: check.chatId ?? null,
        username: check.username ?? (target.startsWith('@') ? target.slice(1) : null),
        kind: check.ok ? 'bot_admin' : 'manual',
        last_check_at: new Date().toISOString(),
        last_check_ok: check.ok,
        last_check_detail: check.detail,
      })

    if (error) return { error: `Could not save it: ${error.message}` }

    revalidatePath('/dashboard/settings')
    return {
      ok: check.ok
        ? `Added. ${check.detail}`
        : `Added, but you will have to post by hand — ${check.detail}`,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
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

  revalidatePath('/dashboard/settings')
}

export async function setChannelActive(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'))
  const active = formData.get('active') === '1'
  if (!id) return

  await supabaseAdmin().from('channels').update({ active }).eq('id', id)
  revalidatePath('/dashboard/settings')
}

/** One click from the "recently added the bot to these" list. No id to copy. */
export async function addDiscoveredChannel(formData: FormData): Promise<void> {
  const chatId = Number(formData.get('chatId'))
  if (!Number.isFinite(chatId)) return

  const check = await checkChannel(String(chatId))

  await supabaseAdmin()
    .from('channels')
    .upsert(
      {
        title: check.title || String(formData.get('title') || chatId),
        chat_id: chatId,
        username: check.username ?? null,
        kind: check.ok ? 'bot_admin' : 'manual',
        last_check_at: new Date().toISOString(),
        last_check_ok: check.ok,
        last_check_detail: check.detail,
      },
      { onConflict: 'chat_id' },
    )

  revalidatePath('/dashboard/settings')
}
