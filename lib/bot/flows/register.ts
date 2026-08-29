import { InlineKeyboard, Keyboard, type Context } from 'grammy'
import { copy } from '../copy'
import { getSession, saveSession } from '../session'
import { logMessage } from '../log'
import { getJob } from '../jobs'
import { nextStep, progress, type RegisterStep } from './steps'
import {
  DAYS, DEFAULT_AREAS, DEFAULT_SUBJECTS, EDUCATION, EXPERIENCE,
  GENDERS, GRADE_BANDS, RATE_BANDS, SLOTS, type Option,
} from '@/lib/candidates/options'
import { applyToJob, saveCandidate, storeCv, type Draft } from '@/lib/candidates/store'
import { normalizePhone, phoneProblem } from '@/lib/candidates/phone'
import { markTalentApplied } from '@/lib/talent/service'
import { env } from '@/lib/env'

const MAX_CV_BYTES = 10 * 1024 * 1024
const CV_MIME = /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats|image\/(jpeg|png|webp))/

type Sess = { draft: Draft; jobId?: number; publicationId?: number | null }

function sessionOf(data: Record<string, unknown>): Sess {
  return {
    draft: (data.draft as Draft) ?? {},
    jobId: data.jobId as number | undefined,
    publicationId: (data.publicationId as number | null | undefined) ?? null,
  }
}

/** Multi-select buttons carry their own state: a tick means it is chosen. */
function multiSelect(options: Option[], chosen: string[], prefix: string, perRow = 2): InlineKeyboard {
  const kb = new InlineKeyboard()
  options.forEach((o, i) => {
    const mark = chosen.includes(o.value) ? '✅ ' : ''
    kb.text(`${mark}${o.label}`, `${prefix}:${o.value}`)
    if ((i + 1) % perRow === 0) kb.row()
  })
  return kb.row().text(copy.buttons.done, `${prefix}:__done`)
}

function singleSelect(options: Option[], prefix: string, perRow = 2): InlineKeyboard {
  const kb = new InlineKeyboard()
  options.forEach((o, i) => {
    kb.text(o.label, `${prefix}:${o.value}`)
    if ((i + 1) % perRow === 0) kb.row()
  })
  return kb
}

async function say(ctx: Context, text: string, keyboard?: InlineKeyboard | Keyboard) {
  await ctx.reply(text, keyboard ? { reply_markup: keyboard } : undefined)
  await logMessage({
    direction: 'out',
    telegramId: ctx.from?.id,
    chatId: ctx.chat?.id,
    kind: 'register',
    payload: { text },
  })
}

/** Ask one step. Every prompt carries "Step n of 13" so the end is visible. */
export async function askStep(ctx: Context, step: RegisterStep, draft: Draft) {
  const head = `${progress(step)}\n\n`

  switch (step) {
    case 'consent':
      return say(ctx, head + copy.reg.consent, new InlineKeyboard()
        .text(copy.buttons.agree, 'reg:consent:yes').row()
        .text(copy.buttons.decline, 'reg:consent:no'))

    case 'name': {
      const guess = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ').trim()
      if (!guess) return say(ctx, head + copy.reg.nameTypeIt)
      return say(ctx, head + copy.reg.name(guess), new InlineKeyboard()
        .text(copy.buttons.nameYes, 'reg:name:keep').row()
        .text(copy.buttons.nameNo, 'reg:name:type'))
    }

    case 'phone':
      // request_contact only exists on a reply keyboard, never inline.
      return say(ctx, head + copy.reg.phone,
        new Keyboard().requestContact(copy.buttons.sharePhone).resized().oneTime())

    case 'gender':
      return say(ctx, head + copy.reg.gender, singleSelect(GENDERS, 'reg:gender'))

    case 'area':
      return say(ctx, head + copy.reg.area, singleSelect(
        [...DEFAULT_AREAS.map((a) => ({ value: a, label: a })), { value: '__other', label: copy.buttons.other }],
        'reg:area',
      ))

    case 'education':
      return say(ctx, head + copy.reg.education, singleSelect(EDUCATION, 'reg:education'))

    case 'subjects':
      return say(ctx, head + copy.reg.subjects, multiSelect(
        DEFAULT_SUBJECTS.map((s) => ({ value: s, label: s })), draft.subjects ?? [], 'reg:subject',
      ))

    case 'grades':
      return say(ctx, head + copy.reg.grades, multiSelect(GRADE_BANDS, draft.grades ?? [], 'reg:grade'))

    case 'days':
      return say(ctx, head + copy.reg.days, multiSelect(DAYS, draft.days ?? [], 'reg:day', 4))

    case 'times':
      return say(ctx, head + copy.reg.times, multiSelect(SLOTS, draft.times ?? [], 'reg:time', 3))

    case 'experience':
      return say(ctx, head + copy.reg.experience, singleSelect(EXPERIENCE, 'reg:experience', 1))

    case 'rate':
      return say(ctx, head + copy.reg.rate, singleSelect(RATE_BANDS, 'reg:rate', 1))

    case 'cv':
      return say(ctx, head + copy.reg.cv, new InlineKeyboard().text(copy.buttons.skip, 'reg:cv:skip'))
  }
}

/** Move to the next step, or finish. */
async function advance(ctx: Context, step: RegisterStep, sess: Sess) {
  const telegramId = ctx.from!.id
  const chatId = ctx.chat!.id
  const next = nextStep(step)

  if (!next) return finish(ctx, sess)

  await saveSession(telegramId, chatId, { flow: 'register', step: next, data: { draft: sess.draft } })
  await askStep(ctx, next, sess.draft)
}

async function finish(ctx: Context, sess: Sess) {
  const telegramId = ctx.from!.id
  const chatId = ctx.chat!.id

  const saved = await saveCandidate(telegramId, chatId, sess.draft)
  if (!saved) {
    await say(ctx, 'Something went wrong saving your profile. Send /start and we will try again.')
    return
  }

  let appliedTo: string | null = null
  if (sess.jobId) {
    const job = await getJob(sess.jobId)
    const outcome = await applyToJob(saved.id, sess.jobId, sess.publicationId ?? null)
    if (outcome === 'created') await markTalentApplied(sess.jobId, saved.id)
    if (job && outcome !== 'failed') appliedTo = `${job.subject} · ${job.grade} · ${job.area}`
  }

  await saveSession(telegramId, chatId, { flow: null, step: null, data: { draft: {} } })
  await say(ctx, copy.reg.done(appliedTo))
}

/** Entry point — the Apply button, and the "Register as a tutor" menu item. */
export async function beginRegistration(ctx: Context, jobId?: number, publicationId?: number | null) {
  const telegramId = ctx.from!.id
  const chatId = ctx.chat!.id

  await saveSession(telegramId, chatId, {
    flow: 'register',
    step: 'consent',
    data: { draft: {}, ...(jobId ? { jobId, publicationId: publicationId ?? null } : {}) },
  })
  await askStep(ctx, 'consent', {})
}

// ---------------------------------------------------------------------------
// Button taps
// ---------------------------------------------------------------------------

export async function handleRegisterCallback(ctx: Context, field: string, value: string): Promise<boolean> {
  const session = await getSession(ctx.from!.id)
  if (session?.flow !== 'register') return false

  const sess = sessionOf(session.data)
  const step = session.step as RegisterStep
  const draft = sess.draft

  const stay = async (message?: string) => {
    await ctx.answerCallbackQuery(message ? { text: message } : undefined)
  }
  const save = async () => {
    await saveSession(ctx.from!.id, ctx.chat!.id, { data: { draft } })
  }

  switch (field) {
    case 'consent':
      if (value === 'no') {
        await ctx.answerCallbackQuery()
        await saveSession(ctx.from!.id, ctx.chat!.id, { flow: null, step: null })
        await say(ctx, copy.reg.consentDeclined)
        return true
      }
      await ctx.answerCallbackQuery()
      await advance(ctx, 'consent', sess)
      return true

    case 'name':
      if (value === 'type') {
        await ctx.answerCallbackQuery()
        await saveSession(ctx.from!.id, ctx.chat!.id, { step: 'name', data: { awaitingName: true } })
        await say(ctx, copy.reg.nameTypeIt)
        return true
      }
      draft.fullName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ').trim()
      await save()
      await ctx.answerCallbackQuery()
      await advance(ctx, 'name', sess)
      return true

    // ---- single-choice fields ----
    case 'gender':
    case 'education':
    case 'experience': {
      draft[field === 'gender' ? 'gender' : field === 'education' ? 'education' : 'experience'] = value
      await save()
      await ctx.answerCallbackQuery()
      await advance(ctx, step, sess)
      return true
    }

    case 'area':
      draft.area = value === '__other' ? 'Other' : value
      await save()
      await ctx.answerCallbackQuery()
      await advance(ctx, 'area', sess)
      return true

    case 'rate':
      draft.expectedRate = Number(value)
      await save()
      await ctx.answerCallbackQuery()
      await advance(ctx, 'rate', sess)
      return true

    // ---- multi-choice fields: tap to toggle, Done to move on ----
    case 'subject':
    case 'grade':
    case 'day':
    case 'time': {
      const key = ({ subject: 'subjects', grade: 'grades', day: 'days', time: 'times' } as const)[field]
      const chosen = new Set(draft[key] ?? [])

      if (value === '__done') {
        if (chosen.size === 0) {
          const nothing = {
            subject: copy.reg.subjectsNone, grade: copy.reg.gradesNone,
            day: copy.reg.daysNone, time: copy.reg.timesNone,
          }[field]
          await stay(nothing)
          return true
        }
        await ctx.answerCallbackQuery()
        await advance(ctx, step, sess)
      return true
      }

      chosen.has(value) ? chosen.delete(value) : chosen.add(value)
      draft[key] = [...chosen]
      await save()
      await ctx.answerCallbackQuery()

      // Redraw in place so the ticks move without a new message.
      const options =
        field === 'subject' ? DEFAULT_SUBJECTS.map((s) => ({ value: s, label: s }))
        : field === 'grade' ? GRADE_BANDS
        : field === 'day' ? DAYS
        : SLOTS
      const perRow = field === 'day' ? 4 : field === 'time' ? 3 : 2
      await ctx.editMessageReplyMarkup({
        reply_markup: multiSelect(options, draft[key] ?? [], `reg:${field}`, perRow),
      })
      return true
    }

    case 'cv':
      if (value === 'skip') {
        await ctx.answerCallbackQuery()
        await finish(ctx, sess)
        return true
      }
      return false
  }

  return false
}

// ---------------------------------------------------------------------------
// Things that arrive as messages: the shared contact, a typed name, the CV
// ---------------------------------------------------------------------------

export async function handleRegisterMessage(ctx: Context): Promise<boolean> {
  const session = await getSession(ctx.from!.id)
  if (session?.flow !== 'register') return false

  const sess = sessionOf(session.data)
  const step = session.step as RegisterStep
  const draft = sess.draft
  const msg = ctx.message
  if (!msg) return false

  // --- phone: the shared contact, or a typed number ---
  if (step === 'phone') {
    if (msg.contact) {
      if (msg.contact.user_id && msg.contact.user_id !== ctx.from!.id) {
        await say(ctx, copy.reg.phoneWrongPerson)
        return true
      }
      // Telegram gives the number in whatever shape the owner saved it.
      const shared = normalizePhone(msg.contact.phone_number)
      draft.phone = shared.ok ? shared.e164 : msg.contact.phone_number
      await saveSession(ctx.from!.id, ctx.chat!.id, { data: { draft } })
      // Take the reply keyboard away; everything after this is inline buttons.
      await ctx.reply('Thanks.', { reply_markup: { remove_keyboard: true } })
      await advance(ctx, 'phone', sess)
      return true
    }

    // The reply keyboard is easy to miss on Telegram Desktop. A typed number is
    // machine-validated, so it needs no human to interpret it — and nobody gets
    // stuck repeating a step they cannot see the button for.
    if (msg.text) {
      const parsed = normalizePhone(msg.text)
      if (!parsed.ok) {
        await say(ctx, phoneProblem(parsed.reason))
        return true
      }
      draft.phone = parsed.e164
      await saveSession(ctx.from!.id, ctx.chat!.id, { data: { draft } })
      await ctx.reply(copy.reg.phoneConfirmed(parsed.national), { reply_markup: { remove_keyboard: true } })
      await advance(ctx, 'phone', sess)
      return true
    }

    await say(ctx, copy.reg.phone)
    return true
  }

  // --- typed name ---
  if (step === 'name' && msg.text) {
    const name = msg.text.trim()
    if (name.length < 3) {
      await say(ctx, copy.reg.nameTooShort)
      return true
    }
    draft.fullName = name.slice(0, 80)
    await saveSession(ctx.from!.id, ctx.chat!.id, { data: { draft } })
    await advance(ctx, 'name', sess)
    return true
  }

  // --- CV ---
  if (step === 'cv') {
    const doc = msg.document
    const photo = msg.photo?.[msg.photo.length - 1]
    if (!doc && !photo) {
      await say(ctx, copy.reg.cvBadType)
      return true
    }

    const size = doc?.file_size ?? photo?.file_size ?? 0
    if (size > MAX_CV_BYTES) {
      await say(ctx, copy.reg.cvTooBig)
      return true
    }
    const mime = doc?.mime_type ?? 'image/jpeg'
    if (doc && !CV_MIME.test(mime)) {
      await say(ctx, copy.reg.cvBadType)
      return true
    }

    const fileId = doc?.file_id ?? photo!.file_id
    const name = doc?.file_name ?? `cv-${Date.now()}.jpg`

    try {
      const file = await ctx.api.getFile(fileId)
      const res = await fetch(`https://api.telegram.org/file/bot${env.telegramBotToken}/${file.file_path}`)
      const bytes = await res.arrayBuffer()

      const path = await storeCv(ctx.from!.id, name, mime, bytes)
      if (path) {
        draft.cvPath = path
        draft.cvName = name
        draft.cvMime = mime
        await saveSession(ctx.from!.id, ctx.chat!.id, { data: { draft } })
        await say(ctx, copy.reg.cvSaved)
      }
    } catch (err) {
      console.error('cv upload failed', err)
      // A failed CV must never cost someone their registration.
    }

    await finish(ctx, sess)
    return true
  }

  return false
}
