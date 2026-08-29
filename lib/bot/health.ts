import { getBot } from './bot'

export type BotHealth =
  | { ok: true; username: string; webhookUrl: string; pending: number; lastError?: string }
  | { ok: false; error: string }

/** What the dashboard needs to tell the operator whether the bot is live. */
export async function botHealth(): Promise<BotHealth> {
  try {
    const bot = await getBot()
    const info = await bot.api.getWebhookInfo()
    return {
      ok: true,
      username: bot.botInfo.username,
      webhookUrl: info.url || '(not set)',
      pending: info.pending_update_count,
      lastError: info.last_error_message,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
