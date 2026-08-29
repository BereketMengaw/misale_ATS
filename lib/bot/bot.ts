import { Bot, type Context, type InlineKeyboard } from 'grammy'
import { env } from '@/lib/env'
import { copy, t, type Lang } from './copy'
import { applyKeyboard, languageKeyboard, mainMenu, openJobsKeyboard } from './keyboards'
import { getSession, saveSession } from './session'
import { logMessage } from './log'
import { countApply, getJob, isLive, jobBody, listOpenJobs } from './jobs'
import { parseApplyPayload } from '@/lib/jobs/apply-link'

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

    // t.me/<bot>?start=job_12_3 — job 12, publication 3. The publication is
    // what tells us which channel this applicant came from.
    const payload = ctx.match?.toString().trim() || undefined
    const parsed = parseApplyPayload(payload)

    if (parsed?.publicationId) await countApply(parsed.publicationId)

    const session = await saveSession(from.id, chatId, {
      flow: null,
      step: null,
      data: {
        ...(payload ? { entry: payload } : {}),
        ...(parsed ? { jobId: parsed.jobId, publicationId: parsed.publicationId } : {}),
      },
    })

    const lang = session.data.lang as Lang | undefined

    // Language first — everything after it is written in one language, not two.
    if (!lang) {
      await reply(ctx, `${t(copy.welcome)}\n\n${t(copy.chooseLanguage)}`, languageKeyboard())
      return
    }

    if (parsed) {
      await showJob(ctx, parsed.jobId, lang)
      return
    }

    await reply(ctx, `${t(copy.welcome, lang)}\n\n${t(copy.menu, lang)}`, mainMenu(lang))
  })

  bot.callbackQuery(/^lang:(am|en)$/, async (ctx) => {
    const lang = ctx.match[1] as Lang
    const from = ctx.from
    const chatId = ctx.chat?.id
    if (!from || chatId === undefined) return

    const session = await saveSession(from.id, chatId, { data: { lang } })
    await ctx.answerCallbackQuery()

    // Someone who arrived on a job link came for that job, not for a menu.
    const jobId = session.data.jobId as number | undefined
    if (jobId) {
      await ctx.editMessageText(t(copy.languageSet, lang))
      await showJob(ctx, jobId, lang)
      return
    }

    await ctx.editMessageText(`${t(copy.languageSet, lang)}\n\n${t(copy.menu, lang)}`, {
      reply_markup: mainMenu(lang),
    })
  })

  // Tapping one of the "here is what's open now" buttons.
  bot.callbackQuery(/^job:(\d+)$/, async (ctx) => {
    const lang = await langOf(ctx)
    await ctx.answerCallbackQuery()
    await showJob(ctx, Number(ctx.match[1]), lang)
  })

  // Step 4 turns this into the registration wizard.
  bot.callbackQuery(/^apply:(\d+)$/, async (ctx) => {
    const lang = await langOf(ctx)
    await ctx.answerCallbackQuery({ text: copy.notReadyYet[lang] })
  })

  bot.callbackQuery('menu:main', async (ctx) => {
    const lang = await langOf(ctx)
    await ctx.answerCallbackQuery()
    await reply(ctx, t(copy.menu, lang), mainMenu(lang))
  })

  bot.callbackQuery(/^menu:(.+)$/, async (ctx) => {
    const lang = await langOf(ctx)
    await ctx.answerCallbackQuery({ text: copy.notReadyYet[lang] })
  })

  // No free-text branch exists, so anything typed goes back to the buttons.
  bot.on('message', async (ctx) => {
    const session = await getSession(ctx.from.id)
    const lang = session?.data.lang as Lang | undefined

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

/**
 * A job link, live or dead. A forwarded post or a screenshot from three weeks
 * ago must not dead-end: a filled link becomes a new applicant.
 */
async function showJob(ctx: Context, jobId: number, lang: Lang) {
  const job = await getJob(jobId)

  if (!job || !isLive(job)) {
    const open = await listOpenJobs()
    const message = !job ? copy.jobNotFound[lang] : copy.jobFilled[lang]

    if (open.length === 0) {
      await reply(ctx, copy.noOpenJobs[lang], mainMenu(lang))
      return
    }
    await reply(ctx, message, openJobsKeyboard(open, lang))
    return
  }

  await reply(
    ctx,
    `${copy.applyingFor[lang]}\n\n${jobBody(job, lang)}\n\n${copy.applyNext[lang]}`,
    applyKeyboard(job.id, lang),
  )
}

async function langOf(ctx: Context): Promise<Lang> {
  if (!ctx.from) return 'en'
  const session = await getSession(ctx.from.id)
  return (session?.data.lang as Lang | undefined) ?? 'en'
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
