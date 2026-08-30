'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { pushToOperator } from '@/lib/messaging/push'
import { markOutboxSent } from '@/lib/invoices/service'

/**
 * The two actions the send queue needs. They live here rather than under
 * money/ because the queue itself now lives on Today.
 */

/** Send a pending message to the operator's own Telegram, to send from there. */
export async function pushToMyPhone(formData: FormData): Promise<void> {
  const body = String(formData.get('body') ?? '')
  const phone = String(formData.get('phone') ?? '') || null
  const recipient = String(formData.get('recipient') ?? 'them')
  if (!body) return

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await pushToOperator(user.id, body, phone, recipient)
  revalidatePath('/dashboard')
}

/** He sent it from his own number. Take it off the queue. */
export async function markSent(formData: FormData): Promise<void> {
  const outboxId = Number(formData.get('outboxId'))
  if (outboxId) await markOutboxSent(outboxId)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/money')
}

/**
 * The operator has spoken to the tutor and started finding a replacement.
 * Takes the notice off Today; the row stays, so the history is intact.
 */
export async function markQuitNoticeHandled(formData: FormData): Promise<void> {
  const id = Number(formData.get('noticeId'))
  if (!Number.isFinite(id)) return

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('quit_notices')
    .update({ handled_at: new Date().toISOString(), handled_by: user.id })
    .eq('id', id)

  revalidatePath('/dashboard')
}
