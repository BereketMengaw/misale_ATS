import { Bot, InlineKeyboard, type Context } from 'grammy'
import { env } from '@/lib/env'
import { copy, pick } from './copy'
import { applyKeyboard, backKeyboard, editMenuKeyboard, mainMenu, openJobsKeyboard, profileKeyboard, registerKeyboard } from './keyboards'
import { clearFlow, getSession, saveSession } from './session'
import { logMessage } from './log'
import { countApply, getJob, isLive, listOpenJobs } from './jobs'
import { parseApplyPayload } from '@/lib/jobs/apply-link'
import { parseAdminPayload, parseParentPayload } from '@/lib/messaging/connect'
import { connectParent } from '@/lib/messaging/notify'
import { parentBotCopy } from '@/lib/messaging/parent-bot'
import { beginEdit, beginRegistration, handleRegisterCallback, handleRegisterMessage } from './flows/register'
import { handlePayoutCallback, handlePayoutMessage, PAYOUT_FLOW, showPayoutDetails } from './flows/payout'
import { applyToJob, candidateProfile, findCandidate } from '@/lib/candidates/store'
import { DAYS, EDUCATION, EXPERIENCE, labelFor, SLOTS } from '@/lib/candidates/options'
import { missingFields } from '@/lib/candidates/completeness'
import type { Availability } from '@/lib/candidates/availability'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { recordCommissionDecision } from '@/lib/hiring/service'
import { markTalentApplied } from '@/lib/talent/service'
import { isEditable } from './flows/steps'
import { entryById } from './answers/knowledge'
import { answerFor, looksLikeAQuestion } from './answers/service'
import { detectIntent, isLeavingNotice } from './answers/intent'
import { readSmallTalk, type SmallTalk } from './smalltalk'
import { standingOf } from './answers/standing'
import { fileQuitNoticeFor, recordQuitNotice } from '@/lib/notices/service'
import { attachFile } from '@/lib/candidates/store'
import { ACCEPTED_MIME, MAX_UPLOAD_BYTES } from '@/lib/candidates/files'

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

    // A parent connecting is a different person from a tutor applying, and the
    // two deep links share this one handler.
    const parentId = parseParentPayload(payload)
    if (parentId !== null) {
      await handleParentConnect(ctx, parentId)
      return
    }

    const operatorId = parseAdminPayload(payload)
    if (operatorId) {
      await handleAdminConnect(ctx, operatorId)
      return
    }

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

  bot.command('menu', async (ctx) => {
    await reply(ctx, copy.menu, mainMenu())
  })

  bot.command('help', async (ctx) => {
    await reply(ctx, copy.faq, backKeyboard(), 'HTML')
  })

  // Wizard buttons: reg:<field>:<value>. Registered first so the generic
  // handlers below never swallow a step mid-flow.
  bot.callbackQuery(/^reg:([a-z]+):(.+)$/, async (ctx) => {
    const handled = await handleRegisterCallback(ctx, ctx.match[1], ctx.match[2])
    if (!handled) await ctx.answerCallbackQuery({ text: copy.notReadyYet })
  })

  // Accept or decline the commission. There is no third button on purpose:
  // a counter-offer is a negotiation, and a negotiation is a conversation.
  bot.callbackQuery(/^comm:(\d+):(yes|no)$/, async (ctx) => {
    const applicationId = Number(ctx.match[1])
    const accepted = ctx.match[2] === 'yes'
    await ctx.answerCallbackQuery()

    const reply_ = await recordCommissionDecision(applicationId, accepted)
    // Take the buttons off so it cannot be answered twice.
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {})

    if (reply_) await reply(ctx, reply_)
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
    // Leaving a half-answered flow has to actually leave it. Without this the
    // next thing typed is still read as an account number.
    const session = await getSession(ctx.from.id)
    if (session?.flow === PAYOUT_FLOW) await clearFlow(ctx.from.id, ctx.chat!.id)
    await reply(ctx, copy.menu, mainMenu())
  })

  bot.callbackQuery('menu:jobs', async (ctx) => {
    await ctx.answerCallbackQuery()
    await showOpenJobs(ctx)
  })

  /**
   * Change one thing on a saved profile.
   *
   * Before this, the only way to fix a wrong answer was Register again — all
   * fourteen steps, for one phone number. Each button below re-asks the
   * wizard's own question for that one field.
   */
  bot.callbackQuery('menu:edit', async (ctx) => {
    await ctx.answerCallbackQuery()

    const existing = await findCandidate(ctx.from.id)
    if (!existing) {
      await reply(ctx, copy.edit.none, registerKeyboard())
      return
    }
    await reply(ctx, copy.edit.title, editMenuKeyboard())
  })

  bot.callbackQuery(/^edit:([a-z]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery()
    const step = ctx.match![1]

    if (!isEditable(step)) {
      await reply(ctx, copy.notReadyYet, backKeyboard())
      return
    }
    // A profile that vanished between the menu and the tap.
    if (!(await beginEdit(ctx, step))) {
      await reply(ctx, copy.edit.none, registerKeyboard())
    }
  })

  bot.callbackQuery('menu:profile', async (ctx) => {
    await ctx.answerCallbackQuery()
    await showProfile(ctx)
  })

  // Where a hired tutor is paid. Everyone else is told there is nothing to set
  // yet — better than storing bank details for a job that does not exist.
  bot.callbackQuery('menu:payout', async (ctx) => {
    await ctx.answerCallbackQuery()

    const candidate = await findCandidate(ctx.from.id)
    if (!candidate) {
      await reply(ctx, copy.payout.notRegistered, registerKeyboard())
      return
    }

    // Open to anyone registered, not only to anyone hired.
    //
    // This was gated on having a placement, so that the agency was not holding
    // bank details for hundreds of applicants who never get a job. The gate
    // cost more than it saved: a tutor who wants to enter their account early
    // was told to wait, with no way to act on a thing they came here to do, and
    // the operator could not point them at anything either. The hire still asks
    // on its own for anybody who has not got round to it.
    await showPayoutDetails(ctx, candidate.id)
  })

  bot.callbackQuery(/^payout:(.+)$/, async (ctx) => {
    if (await handlePayoutCallback(ctx, ctx.match![1])) return
    await ctx.answerCallbackQuery({ text: copy.reg.staleTap })
  })

  bot.callbackQuery('menu:faq', async (ctx) => {
    await ctx.answerCallbackQuery()
    await reply(ctx, copy.faq, backKeyboard(), 'HTML')
  })

  // A follow-up topic tapped under an answer. Sent verbatim from the knowledge
  // base — a tap is not a question, so it costs no model call.
  bot.callbackQuery(/^ask:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery()
    const entry = entryById(ctx.match![1])
    if (!entry) {
      await reply(ctx, pick(copy.answers.uncovered, ctx.callbackQuery.id.length))
      return
    }
    await reply(ctx, entry.answer)
  })

  // Which placement they are giving notice on. The id is checked against
  // their own live placements before anything is written — a button is not a
  // permission, and the id in one is whatever the update says it is.
  bot.callbackQuery(/^quit:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery()

    const session = await getSession(ctx.from.id)
    const pending = session?.data?.pendingQuit as { message?: string } | undefined
    const outcome = await fileQuitNoticeFor(
      ctx.from.id,
      Number(ctx.match![1]),
      pending?.message ?? 'They tapped which placement they are stopping.',
    )

    if (outcome.kind === 'filed') {
      await saveSession(ctx.from.id, ctx.chat!.id, { data: { pendingQuit: null } })
      await reply(ctx, copy.leaving.filed(outcome.job))
      return
    }
    if (outcome.kind === 'already') {
      await reply(ctx, copy.leaving.already(outcome.job))
      return
    }
    await reply(ctx, copy.leaving.gone, mainMenu())
  })

  // Anything else under menu: is a button that no longer exists.
  bot.callbackQuery(/^menu:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: copy.notReadyYet })
  })

  // Shared contacts, typed names and CV files belong to the wizard. Anything
  // else typed is a question, and the bot answers it itself — no human is ever
  // asked to interpret it, which is the rule that matters.
  bot.on('message', async (ctx) => {
    if (await handleRegisterMessage(ctx)) return
    // An account number is digits, not a question. Checked before the answerer
    // so it is never sent to a model or met with "I can't answer that".
    if (await handlePayoutMessage(ctx)) return

    // A parent gets Amharic. The answerer is English and tutor-facing, so a
    // parent still gets the fixed line rather than an answer in the wrong
    // language about the wrong side of the business.
    const { data: client } = await supabaseAdmin()
      .from('clients').select('id').eq('telegram_id', ctx.from.id).maybeSingle()
    if (client) {
      await reply(ctx, parentBotCopy.nothingToReply)
      return
    }

    // A CV or a transcript from somebody who registered weeks ago. Eleven
    // people in the real history sent one and got the main menu back.
    if (ctx.message.document || ctx.message.photo) {
      await keepTheFile(ctx)
      return
    }

    const text = ctx.message.text?.trim()
    if (!text) {
      await reply(ctx, copy.menu, mainMenu())
      return
    }

    // Most of what arrives is not a question. Answering it out of the
    // knowledge base told 58% of everyone who ever wrote in that we had no
    // answer for them — when what they said was "I want to apply".

    // Which of several wordings goes out. Climbs by at least one per message,
    // so nobody gets the same sentence twice running.
    const seed = ctx.message.message_id

    // Somebody saying they are stopping. Answered from what the database
    // already knows rather than from the knowledge base: the bot filed the
    // notice, so the bot can say it filed it. Only a hypothetical — somebody
    // with nothing live to leave — falls through to the FAQ entry, which is
    // written for exactly that person.
    if (isLeavingNotice(text) && (await handleLeavingNotice(ctx, text, seed))) return

    // Intent first: "thanks, I want to apply" is somebody applying, not
    // somebody thanking us.
    if (await handleIntent(ctx, text)) return

    // Then what they actually said. Hello, sorry, goodbye, "I'll get back to
    // you", "I'm a physics teacher" — none of it is a question and none of it
    // deserves a menu, which is what all of it used to get.
    if (await handleSmallTalk(ctx, text, seed)) return

    if (!looksLikeAQuestion(text)) {
      await reply(ctx, pick(copy.notSure, seed), mainMenu())
      return
    }

    // Asked mid-registration: answer, then point back at the step they are on
    // rather than leaving them looking at a wall of buttons they scrolled past.
    const session = await getSession(ctx.from.id)
    const midRegistration = session?.flow === 'register'

    const answered = await answerFor(ctx.from.id, ctx.chat.id, text)

    // A question that was answered gets the answer and nothing else. Buttons
    // under a reply read like a phone tree — nobody hands you a menu after
    // every sentence — and the whole point of answering is that it reads like
    // an answer. The escape hatches are still there: /start, and the menu.
    //
    // The exception is an answer that IS an instruction. "Open My profile and
    // tap Change something" is a worse version of the button itself: it asks
    // somebody to go and find a thing we are holding. One button then, the one
    // the answer named, and never a menu.
    if (answered.covered) {
      const action = answered.action
      await reply(
        ctx,
        answered.text,
        action ? new InlineKeyboard().text(action.label, action.callback) : undefined,
      )
      if (midRegistration) await reply(ctx, copy.answers.backToRegistration)
      return
    }

    // "I don't know" is the one reply that has to offer a way on.
    //
    // This used to send no buttons, on the same reasoning as an answer: a menu
    // under a reply reads as a phone tree. But the message itself recited four
    // topics in prose — it was already a menu, just one nobody could tap, and
    // it asked somebody who had already failed to find the words to find
    // better ones. The topics nearest to what they actually asked, as buttons,
    // and each is sent verbatim from the knowledge base so a tap costs no
    // model call.
    const nearest = new InlineKeyboard()
    for (const entry of answered.related.slice(0, 3)) {
      nearest.text(entry.topic, `ask:${entry.id}`).row()
    }

    await reply(ctx, pick(copy.answers.uncovered, seed), nearest)
    if (midRegistration) await reply(ctx, copy.answers.backToRegistration)
  })

  bot.catch((err) => {
    console.error('bot error', err.error)
  })
}

/**
 * A job link, live or dead. A forwarded post or a screenshot from three weeks
 * ago must not dead-end: a filled link becomes a new applicant.
 */
/** The operator linking their own Telegram, so the dashboard can reach their phone. */
async function handleAdminConnect(ctx: Context, operatorId: string) {
  const { error } = await supabaseAdmin()
    .from('operators')
    .update({ telegram_id: ctx.from!.id })
    .eq('id', operatorId)

  await reply(
    ctx,
    error
      ? 'That link did not work. Open it again from the dashboard.'
      : [
          'Your phone is linked.',
          '',
          'From the dashboard you can now push any message here in one click, and send it from this phone.',
        ].join('\n'),
  )
}

/**
 * The parent's one tap. After this the bot may message them, which is what
 * makes invoices and receipts automatic and free.
 */
async function handleParentConnect(ctx: Context, clientId: number) {
  const db = supabaseAdmin()
  const outcome = await connectParent(clientId, ctx.from!.id)

  if (outcome === 'unknown') {
    await reply(ctx, parentBotCopy.notFound)
    return
  }
  if (outcome === 'already') {
    await reply(ctx, parentBotCopy.alreadyConnected)
    return
  }

  const { data: client } = await db
    .from('clients').select('full_name').eq('id', clientId).maybeSingle()

  await reply(ctx, parentBotCopy.connected(client?.full_name ?? ''))
}

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
  // If they came from a talent DM, record that it converted.
  if (outcome === 'created') await markTalentApplied(jobId, candidateId)

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

/** The live jobs, or an honest empty state that still offers a way forward. */
async function showOpenJobs(ctx: Context) {
  const open = await listOpenJobs()
  if (open.length === 0) {
    await reply(ctx, copy.noOpenJobs, registerKeyboard())
    return
  }
  await reply(ctx, copy.menu, openJobsKeyboard(open))
}

/**
 * What we hold on them, in their own words. Read-only: the wizard is the only
 * way to change it, so there is no field here that invites a typed answer.
 */
async function showProfile(ctx: Context) {
  const c = await candidateProfile(ctx.from!.id)
  if (!c) {
    await reply(ctx, copy.profile.none, registerKeyboard())
    return
  }

  const availability = (c.availability ?? {}) as Availability
  const days = DAYS.filter((d) => availability[d.value]?.length)
  const slots = [...new Set(Object.values(availability).flat())]

  const gaps = missingFields({
    fullName: c.full_name, phone: c.phone, area: c.area, education: c.education,
    subjects: c.subjects, grades: c.grades, availability, experience: c.experience,
    expectedRate: c.expected_rate, cvPath: c.cv_path,
  })

  const lines = [
    copy.profile.title,
    '',
    `Name — ${c.full_name ?? '—'}`,
    `Phone — ${c.phone ?? '—'}`,
    `Area — ${c.area ?? '—'}`,
    `Education — ${labelFor(EDUCATION, c.education)}`,
    `Experience — ${labelFor(EXPERIENCE, c.experience)}`,
    `Subjects — ${(c.subjects ?? []).join(', ') || '—'}`,
    `Grades — ${(c.grades ?? []).join(', ') || '—'}`,
    `Days — ${days.map((d) => d.label).join(', ') || '—'}`,
    `Times — ${slots.map((v) => labelFor(SLOTS, v)).join(', ') || '—'}`,
    `CV — ${c.cv_path ? copy.profile.cvYes : copy.profile.cvNo}`,
    '',
    `Profile ${c.completeness}% complete`,
    gaps.length > 0 ? copy.profile.gaps(gaps.join(', ')) : copy.profile.complete,
    copy.profile.fix,
  ]

  await reply(ctx, lines.join('\n'), profileKeyboard())
}

async function reply(ctx: Context, text: string, keyboard?: InlineKeyboard, parseMode?: 'HTML') {
  await ctx.reply(text, {
    ...(keyboard ? { reply_markup: keyboard } : {}),
    ...(parseMode ? { parse_mode: parseMode } : {}),
  })
  await logMessage({
    direction: 'out',
    telegramId: ctx.from?.id,
    chatId: ctx.chat?.id,
    kind: 'reply',
    payload: { text },
  })
}


/**
 * Acts on what someone meant, when they were not asking a question. Returns
 * false when it was a question after all, and the answerer takes it.
 */
async function handleIntent(ctx: Context, text: string): Promise<boolean> {
  const intent = detectIntent(text)
  if (!intent) return false

  // Saying you want to apply is not applying. Hand over the thing that is.
  if (intent === 'apply' || intent === 'job-status') {
    const jobs = await listOpenJobs()
    if (jobs.length === 0) {
      await reply(
        ctx,
        intent === 'apply' ? copy.answers.wantsToApplyNothingOpen : copy.answers.stillOpenNothing,
        registerKeyboard(),
      )
      return true
    }
    await reply(
      ctx,
      intent === 'apply' ? copy.answers.wantsToApply : copy.answers.stillOpen,
      openJobsKeyboard(jobs),
    )
    return true
  }

  // Asked for the menu. Hand over the menu, rather than sending the words to a
  // model and telling them nobody wrote that down.
  if (intent === 'wants-the-menu') {
    await reply(ctx, copy.menu, mainMenu())
    return true
  }

  // "The first one" — a reply to a list the bot did not send and cannot see.
  if (intent === 'picks-from-a-list') {
    const jobs = await listOpenJobs()
    await reply(ctx, copy.answers.picksFromAList, jobs.length ? openJobsKeyboard(jobs) : mainMenu())
    return true
  }

  // 'courtesy' deliberately falls through. It is the bucket the miner counts,
  // but it is far too coarse to reply from: hello, thank you, sorry and
  // goodbye are all in it. handleSmallTalk() picks the words.
  return false
}

/**
 * Somebody saying they are stopping.
 *
 * Returns false only where there is nothing live to leave — a hypothetical, or
 * somebody who never started — and the FAQ entry is then the right answer, so
 * the answerer takes it.
 *
 * Nothing here routes to a person. It says what was recorded, which is what
 * the FAQ entry always said in the abstract, said now about their own job.
 */
async function handleLeavingNotice(ctx: Context, text: string, seed: number): Promise<boolean> {
  const outcome = await recordQuitNotice(ctx.from!.id, text)

  if (outcome.kind === 'filed') {
    await reply(ctx, copy.leaving.filed(outcome.job))
    return true
  }

  if (outcome.kind === 'already') {
    await reply(ctx, copy.leaving.already(outcome.job))
    return true
  }

  // Two live placements and no way to tell which they mean. The one question
  // in this whole path that has to be asked, and it is asked with buttons.
  //
  // What they typed is kept on the session, not in the callback: a callback
  // payload is 64 bytes, and the wording is the part the operator judges the
  // urgency from.
  if (outcome.kind === 'which') {
    await saveSession(ctx.from!.id, ctx.chat!.id, {
      data: { pendingQuit: { message: text.slice(0, 1000), at: new Date().toISOString() } },
    })
    const kb = new InlineKeyboard()
    for (const p of outcome.placements) kb.text(p.job, `quit:${p.id}`).row()
    await reply(ctx, copy.leaving.which, kb)
    return true
  }

  // 'failed' — the record was lost, but the tutor must still get a real
  // answer, and the FAQ entry is one. Better a policy than a shrug.
  return false
}

/**
 * A reply to something that was not a question — and not a menu.
 *
 * Everything here is written copy chosen by message id. No model runs on this
 * path, which matters twice over: it is the path a stranger can hit fastest,
 * and a greeting is not worth a token.
 */
async function handleSmallTalk(ctx: Context, text: string, seed: number): Promise<boolean> {
  const kind: SmallTalk | null = readSmallTalk(text)

  // Matched no kind, but the intent layer still called it a courtesy — some
  // stacked politeness the finer matchers did not name. A short acknowledgement
  // beats a menu.
  if (!kind) {
    if (detectIntent(text) !== 'courtesy') return false
    await reply(ctx, pick(copy.answers.courtesy, seed))
    return true
  }

  const s = copy.smalltalk

  // A greeting is the one place worth a query. The bot knows whether this is a
  // stranger, somebody waiting to hear, or somebody who has been teaching for a
  // month — and greeting all three identically is the tell.
  if (kind === 'greeting') {
    const standing = await standingOf(ctx.from!.id)
    const key = standing?.key ?? 'new'
    const lines =
      key === 'placed' ? s.greeting.teaching
      : key === 'new' ? s.greeting.stranger
      : s.greeting.known
    await reply(ctx, pick(lines, seed), key === 'new' ? mainMenu() : undefined)
    return true
  }

  // Annoyed, and the nearest topics are the only useful thing to offer:
  // another menu is what annoyed them.
  if (kind === 'frustrated') {
    await reply(ctx, pick(s.frustrated, seed), mainMenu())
    return true
  }

  // Told the bot their qualifications. The profile is where that counts, so
  // hand over the way to put it there rather than describing it.
  if (kind === 'introduces-themselves') {
    const registered = Boolean(await findCandidate(ctx.from!.id))
    await reply(
      ctx,
      pick(s.introduces, seed),
      registered
        ? new InlineKeyboard().text(copy.buttons.editProfile, 'menu:edit')
        : registerKeyboard(),
    )
    return true
  }

  const said: Record<Exclude<SmallTalk, 'greeting' | 'frustrated' | 'introduces-themselves'>, readonly string[]> = {
    'how-are-you': s.howAreYou,
    thanks: s.thanks,
    affirm: s.affirm,
    apology: s.apology,
    later: s.later,
    farewell: s.farewell,
    praise: s.praise,
  }

  await reply(ctx, pick(said[kind], seed))
  return true
}

/**
 * A file sent outside the wizard. Kept against the profile rather than
 * answered with a menu — and refused politely when there is no profile to
 * keep it on, since a file with nobody attached is a file nobody finds again.
 */
async function keepTheFile(ctx: Context) {
  const msg = ctx.message!
  const doc = msg.document
  const photo = msg.photo?.[msg.photo.length - 1]

  const size = doc?.file_size ?? photo?.file_size ?? 0
  if (size > MAX_UPLOAD_BYTES) {
    await reply(ctx, copy.files.tooBig)
    return
  }

  const mime = doc?.mime_type ?? 'image/jpeg'
  if (doc && !ACCEPTED_MIME.test(mime)) {
    await reply(ctx, copy.files.badType)
    return
  }

  const name = doc?.file_name ?? `document-${Date.now()}.jpg`

  try {
    const file = await ctx.api.getFile(doc?.file_id ?? photo!.file_id)
    const res = await fetch(`https://api.telegram.org/file/bot${env.telegramBotToken}/${file.file_path}`)
    const outcome = await attachFile(ctx.from!.id, name, mime, await res.arrayBuffer())

    if (outcome === 'not-registered') {
      await reply(ctx, copy.files.notRegistered, registerKeyboard())
      return
    }
    await reply(
      ctx,
      outcome === 'cv' ? copy.files.savedAsCv
      : outcome === 'document' ? copy.files.savedAsDocument
      : copy.files.failed,
    )
  } catch (err) {
    console.error('could not keep a file sent outside the wizard', err)
    await reply(ctx, copy.files.failed)
  }
}
