import { GrammyError } from 'grammy'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getBot } from '@/lib/bot/bot'
import { logMessage } from '@/lib/bot/log'
import { smsUri } from './qr'

/**
 * Push a message to the operator's own Telegram.
 *
 * The dashboard runs on a laptop; the SMS has to leave from a phone. Rather
 * than retyping or emailing it across, the bot sends it to the operator, who
 * copies it there. The sms: link is included as plain text so it can be tapped
 * on the phone — Telegram will not accept sms: on an inline button, but it
 * makes a tappable link out of one in the body.
 */
export type PushResult = { ok: true } | { ok: false; error: string }

export async function pushToOperator(
  operatorId: string,
  body: string,
  phone: string | null,
  recipient: string,
): Promise<PushResult> {
  const { data: operator } = await supabaseAdmin()
    .from('operators')
    .select('telegram_id')
    .eq('id', operatorId)
    .maybeSingle()

  if (!operator?.telegram_id) {
    return { ok: false, error: 'Your Telegram is not linked yet — use the link on this page first.' }
  }

  const text = [
    `📤 To send to ${recipient}${phone ? ` · ${phone}` : ''}`,
    '',
    body,
    ...(phone ? ['', `Tap to open Messages: ${smsUri(phone, body)}`] : []),
  ].join('\n')

  try {
    const bot = await getBot()
    await bot.api.sendMessage(Number(operator.telegram_id), text, {
      link_preview_options: { is_disabled: true },
    })
    await logMessage({
      direction: 'out',
      telegramId: Number(operator.telegram_id),
      kind: 'push_to_operator',
      payload: { recipient },
    })
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof GrammyError ? err.description : String(err),
    }
  }
}
