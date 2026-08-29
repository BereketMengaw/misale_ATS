import type { PostLanguage } from './types'

/** Telegram caps a text message at 4096 characters. */
export const TELEGRAM_TEXT_LIMIT = 4096

const SEPARATOR = '\n\n— — —\n\n'

/**
 * The text that actually goes into a channel, per that channel's language
 * setting. Pure, so the "does it still fit" question is a unit test rather
 * than a failed send.
 */
export function channelBody(
  post: { am: string; en: string },
  language: PostLanguage,
): string {
  if (language === 'am') return post.am.trim()
  if (language === 'en') return post.en.trim()
  return `${post.am.trim()}${SEPARATOR}${post.en.trim()}`
}

export function fitsTelegram(body: string): boolean {
  return body.length <= TELEGRAM_TEXT_LIMIT
}

/**
 * The pack for a channel the bot cannot post to. The operator copies this,
 * pastes it, and the link inside is the same tracked deep link the button uses —
 * so a manual post is attributed exactly like an automatic one.
 */
export function manualPack(body: string, applyUrl: string, language: PostLanguage): string {
  const cta =
    language === 'am'
      ? `ለማመልከት፡ ${applyUrl}`
      : language === 'en'
        ? `To apply: ${applyUrl}`
        : `ለማመልከት / To apply: ${applyUrl}`
  return `${body}\n\n${cta}`
}
