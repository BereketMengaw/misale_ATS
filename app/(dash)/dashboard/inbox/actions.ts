'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { sendManual } from '@/lib/conversations/service'
import type { ActionState } from '@/components/ui'

/**
 * The operator's own words, sent to one person.
 *
 * This is the only write the inbox has. There is nothing to mark read, nothing
 * to assign and nothing to close, because a thread was never a task.
 */
export async function sendManualMessage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const telegramId = Number(formData.get('telegramId'))
  const text = String(formData.get('text') ?? '')

  if (!Number.isFinite(telegramId) || telegramId === 0) {
    return { error: 'That thread has no Telegram account behind it.' }
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Log in again — that session has expired.' }

  const result = await sendManual({ operatorId: user.id, telegramId, text })
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/inbox/${telegramId}`)
  revalidatePath('/dashboard/inbox')
  return { ok: 'Sent.' }
}
