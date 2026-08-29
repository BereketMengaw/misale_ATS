import { Bot, type Context, type InlineKeyboard } from 'grammy'
import { env } from '@/lib/env'
import { copy } from './copy'
import { applyKeyboard, mainMenu, openJobsKeyboard } from './keyboards'
import { getSession, saveSession } from './session'
import { logMessage } from './log'
import { countApply, getJob, isLive, listOpenJobs } from './jobs'
import { parseApplyPayload } from '@/lib/jobs/apply-link'
import { beginRegistration, handleRegisterCallback, handleRegisterMessage } from './flows/register'
import { applyToJob, findCandidate } from '@/lib/candidates/store'

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

    await saveSession(from.id, chatId, {
      flow: null,
      step: null,
      data: {
        ...(payload ? { entry: payload } : {}),
        ...(parsed ? { jobId: parsed.jobId, publicationId: parsed.publicationId } : {}),
      },
    })

    if (parsed) {
      await showJob(ctx, parsed.jobId)
      return
    }

    await reply(ctx, `${copy.welcome}\n\n${copy.menu}`, mainMenu())
  })

  // Wizard buttons: reg:<field>:<value>. Registered first so the generic
  // handlers below never swallow a step mid-flow.
  bot.callbackQuery(/^reg:([a-z]+):(.+)$/, async (ctx) => {
    const handled = await handleRegisterCallback(ctx, ctx.match[1], ctx.match[2])
    if (!handled) await ctx.answerCallbackQuery({ text: copy.notReadyYet })
  })

  // Tapping one of the "here is what's open now" buttons.
  bot.callbackQuery(/^job:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery()
    await showJob(ctx, Number(ctx.match[1]))
  })

  bot.callbackQuery(/^apply:(\d+)$/, async (ctx) => {
    const jobId = Number(ctx.match[1])
    await ctx.answerCallbackQuery()

    const session = await getSession(ctx.from.id)
    const publicationId = (session?.data.publicationId as number | null) ?? null

    // Someone already registered should not be walked through it again.
    const existing = await findCandidate(ctx.from.id)
    if (existing && existing.completeness > 0) {
      await applyAsExisting(ctx, existing.id, jobId, publicationId)
      return
    }

    await beginRegistration(ctx, jobId, publicationId)
  })

  bot.callbackQuery('menu:register', async (ctx) => {
    await ctx.answerCallbackQuery()
    await beginRegistration(ctx)
  })

  bot.callbackQuery('menu:main', async (ctx) => {
    await ctx.answerCallbackQuery()
    await reply(ctx, copy.menu, mainMenu())
  })

  bot.callbackQuery(/^menu:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: copy.notReadyYet })
  })

  // Shared contacts, typed names and CV files belong to the wizard.
  // Anything else has no free-text branch, so it goes back to the buttons.
  bot.on('message', async (ctx) => {
    if (await handleRegisterMessage(ctx)) return
    await reply(ctx, copy.menu, mainMenu())
  })

  bot.catch((err) => {
    console.error('bot error', err.error)
  })
}

/**
 * A job link, live or dead. A forwarded post or a screenshot from three weeks
 * ago must not dead-end: a filled link becomes a new applicant.
 */
/** An existing candidate applying to another job: no wizard, one tap. */
async function applyAsExisting(
  ctx: Context,
  candidateId: number,
  jobId: number,
  publicationId: number | null,
) {
  const job = await getJob(jobId)
  const label = job ? `${job.subject} · ${job.grade} · ${job.area}` : 'that job'
  const outcome = await applyToJob(candidateId, jobId, publicationId)

  await reply(
    ctx,
    outcome === 'already' ? copy.reg.alreadyApplied(label) : copy.reg.done(label),
    mainMenu(),
  )
}

async function showJob(ctx: Context, jobId: number) {
  const job = await getJob(jobId)

  if (!job || !isLive(job)) {
    const open = await listOpenJobs()

    if (open.length === 0) {
      await reply(ctx, copy.noOpenJobs, mainMenu())
      return
    }
    await reply(ctx, job ? copy.jobFilled : copy.jobNotFound, openJobsKeyboard(open))
    return
  }

  await reply(ctx, `${copy.applyingFor}\n\n${job.body}\n\n${copy.applyNext}`, applyKeyboard(job.id))
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
