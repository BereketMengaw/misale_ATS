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

/**
 * When the two sides get each other's number.
 *
 * It lived only in the settings table, so changing it meant writing SQL — the
 * same wall as a job's fields. The rule decides what a parent is told at the
 * hire, so it belongs where it can be read and changed.
 */
export async function setContactRelease(formData: FormData): Promise<void> {
  const rule = String(formData.get('rule') ?? '')
  if (!['on_hire', 'after_first_payment', 'never'].includes(rule)) return

  await supabaseAdmin()
    .from('settings')
    .upsert({ key: 'contact_release', value: { rule } }, { onConflict: 'key' })

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/jobs')
}

/**
 * The agency's own account — where families send invoices and tutors send
 * their pre-payment.
 *
 * docs/07-setup-checklist.md has carried this as an unchecked box since before
 * step 10 and nothing ever read it, so every invoice went out naming an amount
 * and no payee. There is nothing to validate against without a bank API the
 * project deliberately does not have, so this stores what it is given and the
 * Money page warns loudly while it is empty.
 */
export async function savePayIn(
  _prev: ChannelFormState,
  formData: FormData,
): Promise<ChannelFormState> {
  const accountName = String(formData.get('accountName') ?? '').trim()
  const cbeAccount = String(formData.get('cbeAccount') ?? '').replace(/[\s-]/g, '')
  const telebirr = String(formData.get('telebirr') ?? '').replace(/[\s-]/g, '')

  if (!accountName) return { error: 'Give the name on the account — a family checks it before sending.' }
  if (!cbeAccount && !telebirr) return { error: 'Give at least one account number.' }
  for (const [label, value] of [['CBE', cbeAccount], ['Telebirr', telebirr]] as const) {
    if (value && !/^\d{9,20}$/.test(value)) {
      return { error: `That ${label} number does not look right — digits only, 9 to 20 of them.` }
    }
  }

  const { savePaymentDetails } = await import('@/lib/settings/payment-details')
  await savePaymentDetails({ accountName, cbeAccount, telebirr })

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/money')
  return { ok: 'Saved. Invoices and pre-payment requests will carry it from now on.' }
}
