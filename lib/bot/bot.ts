import { Bot, type Context, type InlineKeyboard } from 'grammy'
import { env } from '@/lib/env'
import { copy, t, type Lang } from './copy'
import { languageKeyboard, mainMenu } from './keyboards'
import { getSession, saveSession } from './session'
import { logMessage } from './log'

let cached: Bot | null = null

/**
 * One bot instance per warm lambda. grammY needs init() before handling an
 * update outside of long polling, so callers await getBot().
 */
export async function getBot(): Promise<Bot> {
  if (cached) return cached

  const bot = new Bot(env.telegramBotToken)
  register(bot)
  await bot.init()
  cached = bot
  return bot
}

function register(bot: Bot) {
  bot.use(async (ctx, next) => {
    await logMessage({
      direction: 'in',
      telegramId: ctx.from?.id,
      chatId: ctx.chat?.id,
      kind: ctx.update.message ? 'message' : ctx.update.callback_query ? 'callback' : 'other',
      payload: ctx.update,
    })
    await next()
  })

  bot.command('start', async (ctx) => {
    const from = ctx.from
    const chatId = ctx.chat.id
    if (!from) return

    // Deep-link payload, e.g. t.me/<bot>?start=job_12. Step 3 gives it meaning;
    // for now we record where the applicant came from.
    const payload = ctx.match?.toString().trim() || undefined

    const session = await saveSession(from.id, chatId, {
      flow: null,
      step: null,
      data: payload ? { entry: payload } : {},
    })

    const lang = session.data.lang as Lang | undefined

    if (!lang) {
      await reply(ctx, `${t(copy.welcome)}\n\n${t(copy.chooseLanguage)}`, languageKeyboard())
      return
    }

    await reply(ctx, `${t(copy.welcome, lang)}\n\n${t(copy.menu, lang)}`, mainMenu(lang))
  })

  bot.callbackQuery(/^lang:(am|en)$/, async (ctx) => {
    const lang = ctx.match[1] as Lang
    const from = ctx.from
    const chatId = ctx.chat?.id
    if (!from || chatId === undefined) return

    await saveSession(from.id, chatId, { data: { lang } })
    await ctx.answerCallbackQuery()
    await ctx.editMessageText(`${t(copy.languageSet, lang)}\n\n${t(copy.menu, lang)}`, {
      reply_markup: mainMenu(lang),
    })
    await logMessage({ direction: 'out', telegramId: from.id, chatId, kind: 'language_set' })
  })

  bot.callbackQuery(/^menu:(.+)$/, async (ctx) => {
    const from = ctx.from
    const chatId = ctx.chat?.id
    if (!from || chatId === undefined) return

    const session = await getSession(from.id)
    const lang = (session?.data.lang as Lang | undefined) ?? 'en'

    // Steps 3–8 fill these in. Until then the button answers honestly rather
    // than dropping the user into a dead end.
    await ctx.answerCallbackQuery({ text: copy.notReadyYet[lang] })
  })

  // Anything else: no free-text branch exists, so point back at the buttons.
  bot.on('message', async (ctx) => {
    const from = ctx.from
    const session = await getSession(from.id)
    const lang = (session?.data.lang as Lang | undefined) ?? undefined

    if (!lang) {
      await reply(ctx, `${t(copy.welcome)}\n\n${t(copy.chooseLanguage)}`, languageKeyboard())
      return
    }
    await reply(ctx, t(copy.menu, lang), mainMenu(lang))
  })

  bot.catch((err) => {
    console.error('bot error', err.error)
  })
}

async function reply(ctx: Context, text: string, keyboard?: InlineKeyboard) {
  await ctx.reply(text, keyboard ? { reply_markup: keyboard } : undefined)
  await logMessage({
    direction: 'out',
    telegramId: ctx.from?.id,
    chatId: ctx.chat?.id,
    kind: 'reply',
    payload: { text },
  })
}
