/** Telegram caps a text message at 4096 characters. */
export const TELEGRAM_TEXT_LIMIT = 4096

export function fitsTelegram(body: string): boolean {
  return body.length <= TELEGRAM_TEXT_LIMIT
}

/**
 * The pack for a channel the bot cannot post to. The operator copies this,
 * pastes it, and the link inside is the same tracked deep link the button uses —
 * so a manual post is attributed exactly like an automatic one.
 */
export function manualPack(body: string, applyUrl: string): string {
  return `${body.trim()}\n\nTo apply: ${applyUrl}`
}
