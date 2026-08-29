import { GrammyError } from 'grammy'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getBot } from '@/lib/bot/bot'
import { logMessage } from '@/lib/bot/log'

/**
 * notify(client, message) — the one function that picks the channel.
 *
 * A parent who has tapped the connect link is on Telegram: the message goes
 * automatically, free, and Amharic length stops mattering. A parent who has
 * not is queued in the outbox for the operator to send by SMS.
 *
 * Parents drop off the queue as they connect, so it shrinks over time
 * (docs/04-messaging.md).
 */

export type NotifyPurpose = 'introduction' | 'invoice' | 'overdue' | 'receipt' | 'other'

export type NotifyResult = { via: 'telegram' } | { via: 'queue' } | { via: 'nowhere' }

export async function notifyClient(
  clientId: number,
  body: string,
  purpose: NotifyPurpose,
  invoiceId?: number | null,
): Promise<NotifyResult> {
  const db = supabaseAdmin()

  const { data: client } = await db
    .from('clients')
    .select('id, full_name, phone, telegram_id')
    .eq('id', clientId)
    .maybeSingle()

  if (!client) return { via: 'nowhere' }

  if (client.telegram_id) {
    try {
      const bot = await getBot()
      await bot.api.sendMessage(Number(client.telegram_id), body)
      await logMessage({
        direction: 'out',
        telegramId: Number(client.telegram_id),
        chatId: Number(client.telegram_id),
        kind: `parent_${purpose}`,
        payload: { text: body },
      })
      return { via: 'telegram' }
    } catch (err) {
      // Blocked the bot, or deleted the chat. Fall through to the queue rather
      // than losing the message.
      console.error('parent telegram send failed, queueing instead',
        err instanceof GrammyError ? err.description : err)
    }
  }

  const { error } = await db.from('outbox').insert({
    purpose,
    recipient: client.full_name,
    phone: client.phone,
    body,
    client_id: client.id,
    invoice_id: invoiceId ?? null,
  })

  return error ? { via: 'nowhere' } : { via: 'queue' }
}

/** Links a Telegram account to a client, when they tap the connect link. */
export async function connectParent(clientId: number, telegramId: number): Promise<'connected' | 'already' | 'unknown'> {
  const db = supabaseAdmin()

  const { data: client } = await db
    .from('clients').select('id, telegram_id').eq('id', clientId).maybeSingle()
  if (!client) return 'unknown'

  if (client.telegram_id && Number(client.telegram_id) === telegramId) return 'already'

  const { error } = await db
    .from('clients').update({ telegram_id: telegramId }).eq('id', clientId)

  return error ? 'unknown' : 'connected'
}
