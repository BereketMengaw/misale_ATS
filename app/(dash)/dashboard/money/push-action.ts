'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { pushToOperator } from '@/lib/messaging/push'

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
  revalidatePath('/dashboard/money')
}
