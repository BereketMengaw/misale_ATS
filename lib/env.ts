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

  // --- AI. All optional: unset means no model, and everything still works. ---

  /** Which provider in lib/ai/provider.ts is live. 'template' calls no model. */
  get aiProvider() {
    return process.env.AI_PROVIDER?.trim() || 'template'
  },
  /** Google AI Studio. Empty means the Gemini provider stays unavailable. */
  get geminiApiKey() {
    return process.env.GEMINI_API_KEY?.trim() || ''
  },
  /**
   * Pinned on purpose. The `-latest` alias was consistently the slowest of the
   * flash-lite models and its behaviour moves under you; a pinned name is
   * eventually retired instead (`gemini-2.0-flash` and `gemini-2.5-flash-lite`
   * both 404 on a working key), which `npm run doctor` reports and the
   * answerer survives by sending the matched fact.
   */
  get geminiModel() {
    return process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite'
  },
}
