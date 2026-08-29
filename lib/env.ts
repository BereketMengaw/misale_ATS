/**
 * Environment access. Read through here, never process.env at the call site,
 * so a missing variable fails with a name instead of `undefined` three frames later.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

export const env = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL')
  },
  get supabasePublishableKey() {
    return required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  },
  /** Secret key — bypasses row-level security. Server only, never a client component. */
  get supabaseSecretKey() {
    return required('SUPABASE_SECRET_KEY')
  },
  get telegramBotToken() {
    return required('TELEGRAM_BOT_TOKEN')
  },
  /** Shared secret Telegram echoes back in X-Telegram-Bot-Api-Secret-Token. */
  get telegramWebhookSecret() {
    return required('TELEGRAM_WEBHOOK_SECRET')
  },
  get appUrl() {
    return required('NEXT_PUBLIC_APP_URL')
  },
}
