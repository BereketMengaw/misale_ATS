/**
 * Registers the webhook with Telegram. Run after every deploy to a new URL:
 *   npm run bot:set-webhook
 */
import { Bot } from 'grammy'

const token = process.env.TELEGRAM_BOT_TOKEN
const secret = process.env.TELEGRAM_WEBHOOK_SECRET
const appUrl = process.env.NEXT_PUBLIC_APP_URL

if (!token || !secret || !appUrl) {
  console.error('Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and NEXT_PUBLIC_APP_URL first.')
  process.exit(1)
}

const url = `${appUrl.replace(/\/$/, '')}/api/telegram/webhook`
const bot = new Bot(token)

await bot.api.setWebhook(url, {
  secret_token: secret,
  drop_pending_updates: true,
  allowed_updates: ['message', 'callback_query', 'my_chat_member', 'channel_post'],
})

const info = await bot.api.getWebhookInfo()
console.log('Webhook set:', info.url)
console.log('Pending updates:', info.pending_update_count)
if (info.last_error_message) console.log('Last error:', info.last_error_message)
