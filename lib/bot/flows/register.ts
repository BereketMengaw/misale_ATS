import { InlineKeyboard, Keyboard, type Context } from 'grammy'
import { copy } from '../copy'
import { getSession, saveSession } from '../session'
import { logMessage } from '../log'
import { getJob } from '../jobs'
import { nextStep, ownsStep, prevStep, progress, STEP_LABEL, type RegisterStep } from './steps'
import {
  DAYS, DEFAULT_AREAS, ALL_SUBJECTS, SUBJECT_CHOICES, EDUCATION, EXPERIENCE,
  GENDERS, GRADE_BANDS, labelFor, RATE_BANDS, SLOTS, type Option,
} from '@/lib/candidates/options'
import { applyToJob, saveCandidate, saveDocuments, storeCv, storeDocument, type Draft } from '@/lib/candidates/store'
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

/** A step's prompt: the words, and whichever kind of keyboard it needs. */
type Prompt = { text: string; inline?: InlineKeyboard; reply?: Keyboard }

/** Every step that has somewhere to go back to gets a way back. */
function withBack(kb: InlineKeyboard, step: RegisterStep): InlineKeyboard {
  return prevStep(step) ? kb.row().text(copy.buttons.back, 'reg:nav:back') : kb
}

function promptFor(ctx: Context, step: RegisterStep, draft: Draft): Prompt {
  const head = `${progress(step)}\n\n`

  switch (step) {
    case 'consent':
      return {
        text: head + copy.reg.consent,
        inline: new InlineKeyboard()
          .text(copy.buttons.agree, 'reg:consent:yes').row()
          .text(copy.buttons.decline, 'reg:consent:no'),
      }

    case 'name': {
      const guess = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ').trim()
      if (!guess) return { text: head + copy.reg.nameTypeIt, inline: withBack(new InlineKeyboard(), 'name') }
      return {
        text: head + copy.reg.name(guess),
        inline: withBack(
          new InlineKeyboard()
            .text(copy.buttons.nameYes, 'reg:name:keep').row()
            .text(copy.buttons.nameNo, 'reg:name:type'),
          'name',
        ),
      }
    }

    case 'phone':
      // request_contact only exists on a reply keyboard, never inline.
      return {
        text: head + copy.reg.phone,
        reply: new Keyboard().requestContact(copy.buttons.sharePhone).resized().oneTime(),
      }

    case 'gender':
      return { text: head + copy.reg.gender, inline: withBack(singleSelect(GENDERS, 'reg:gender'), step) }

    case 'area':
      return {
        text: head + copy.reg.area,
        inline: withBack(singleSelect(
          [...DEFAULT_AREAS.map((a) => ({ value: a, label: a })), { value: '__other', label: copy.buttons.other }],
          'reg:area',
        ), step),
      }

    case 'education':
      return { text: head + copy.reg.education, inline: withBack(singleSelect(EDUCATION, 'reg:education'), step) }

    case 'subjects':
      return {
        text: head + copy.reg.subjects,
        inline: withBack(multiSelect(
          SUBJECT_CHOICES.map((x) => ({ value: x, label: x })), draft.subjects ?? [], 'reg:subject',
        ), step),
      }

    case 'grades':
      return { text: head + copy.reg.grades, inline: withBack(multiSelect(GRADE_BANDS, draft.grades ?? [], 'reg:grade'), step) }

    case 'days':
      return { text: head + copy.reg.days, inline: withBack(multiSelect(DAYS, draft.days ?? [], 'reg:day', 4), step) }

    case 'times':
      return { text: head + copy.reg.times, inline: withBack(multiSelect(SLOTS, draft.times ?? [], 'reg:time', 3), step) }

    case 'experience':
      return { text: head + copy.reg.experience, inline: withBack(singleSelect(EXPERIENCE, 'reg:experience', 1), step) }

    case 'rate':
      return { text: head + copy.reg.rate, inline: withBack(singleSelect(RATE_BANDS, 'reg:rate', 1), step) }

    case 'cv':
      return {
        text: head + copy.reg.cv,
        inline: withBack(new InlineKeyboard().text(copy.buttons.skip, 'reg:cv:skip'), step),
      }

    case 'documents':
      return {
        text: head + copy.reg.documents,
        inline: withBack(
          new InlineKeyboard()
            .text(copy.buttons.done, 'reg:document:__done')
            .text(copy.buttons.skip, 'reg:document:skip'),
          step,
        ),
      }
  }
}

/** Ask one step. Every prompt carries "Step n of 13" so the end is visible. */
export async function askStep(ctx: Context, step: RegisterStep, draft: Draft) {
  const prompt = promptFor(ctx, step, draft)
  return say(ctx, prompt.text, prompt.inline ?? prompt.reply)
}

/** Re-draw the tapped message instead of adding another one below it. */
async function askStepInPlace(ctx: Context, step: RegisterStep, draft: Draft) {
  const prompt = promptFor(ctx, step, draft)
  // A reply keyboard cannot be edited into an existing message.
  if (!prompt.inline) return askStep(ctx, step, draft)
  try {
    await ctx.editMessageText(prompt.text, { reply_markup: prompt.inline })
  } catch {
    await askStep(ctx, step, draft)
  }
}

/** What an answered step is worth once it is answered. */
function answerLine(step: RegisterStep, draft: Draft): string {
  const label = STEP_LABEL[step]
  const list = (values: string[] | undefined, options?: Option[]) =>
    (values ?? []).map((v) => (options ? labelFor(options, v) : v)).join(', ')

  switch (step) {
    case 'consent': return copy.reg.answeredConsent
    case 'name': return copy.reg.answered(label, draft.fullName ?? '—')
    case 'phone': return copy.reg.answered(label, draft.phone ?? '—')
    case 'gender': return copy.reg.answered(label, labelFor(GENDERS, draft.gender))
    case 'area': return copy.reg.answered(label, draft.area ?? '—')
    case 'education': return copy.reg.answered(label, labelFor(EDUCATION, draft.education))
    case 'subjects': return copy.reg.answered(label, list(draft.subjects))
    case 'grades': return copy.reg.answered(label, list(draft.grades, GRADE_BANDS))
    case 'days': return copy.reg.answered(label, list(draft.days, DAYS))
    case 'times': return copy.reg.answered(label, list(draft.times, SLOTS))
    case 'experience': return copy.reg.answered(label, labelFor(EXPERIENCE, draft.experience))
    case 'rate': return copy.reg.answered(label, labelFor(RATE_BANDS, String(draft.expectedRate ?? '')))
    case 'cv': return draft.cvPath ? copy.reg.answeredCvSaved : copy.reg.answeredCvSkipped
    case 'documents': return copy.reg.answeredDocuments(draft.documents?.length ?? 0)
  }
}

/**
 * Collapse the step that was just answered into one line with no live buttons.
 *
 * Thirteen steps used to leave thirteen open forms in the chat. What is left
 * now is a record of the answers, and only the current question can be tapped.
 */
async function settle(ctx: Context, step: RegisterStep, draft: Draft) {
  if (!ctx.callbackQuery) return
  await ctx.editMessageText(answerLine(step, draft)).catch(() => {})
}

/** Move to the next step, or finish. */
async function advance(ctx: Context, step: RegisterStep, sess: Sess) {
  await settle(ctx, step, sess.draft)
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

  await saveDocuments(saved.id, sess.draft.documents ?? [])

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

  // One step back, redrawn in place.
  if (field === 'nav') {
    await ctx.answerCallbackQuery()
    const back = prevStep(step)
    if (!back) return true
    await saveSession(ctx.from!.id, ctx.chat!.id, { flow: 'register', step: back, data: { draft } })
    await askStepInPlace(ctx, back, draft)
    return true
  }

  // A button from a step already answered must not write its value and then
  // advance from wherever the wizard is now — that skipped the step on screen.
  if (!ownsStep(step, field)) {
    await ctx.answerCallbackQuery({ text: copy.reg.staleTap })
    return true
  }

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

    // ---- educational documents: several files, then Done ----
    case 'document':
      if (value === 'skip') {
        draft.documents = []
        await save()
        await ctx.answerCallbackQuery()
        await say(ctx, copy.reg.documentsSkipped)
        await advance(ctx, 'documents', sess)
        return true
      }
      await ctx.answerCallbackQuery()
      await advance(ctx, 'documents', sess)
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

      // "All subjects" and a list of subjects are two answers to the same
      // question, so the last tap wins rather than leaving both ticked.
      if (field === 'subject' && chosen.has(ALL_SUBJECTS)) {
        if (value === ALL_SUBJECTS) chosen.clear(), chosen.add(ALL_SUBJECTS)
        else chosen.delete(ALL_SUBJECTS)
      }

      draft[key] = [...chosen]
      await save()
      await ctx.answerCallbackQuery()

      // Redraw in place so the ticks move without a new message.
      const options =
        field === 'subject' ? SUBJECT_CHOICES.map((s) => ({ value: s, label: s }))
        : field === 'grade' ? GRADE_BANDS
        : field === 'day' ? DAYS
        : SLOTS
      const perRow = field === 'day' ? 4 : field === 'time' ? 3 : 2
      await ctx.editMessageReplyMarkup({
        reply_markup: withBack(multiSelect(options, draft[key] ?? [], `reg:${field}`, perRow), step),
      })
      return true
    }

    case 'cv':
      if (value === 'skip') {
        await ctx.answerCallbackQuery()
        // Through advance, so the step collapses like every other one.
        await advance(ctx, 'cv', sess)
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
      await ctx.reply(copy.reg.phoneShared, { reply_markup: { remove_keyboard: true } })
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

  // --- educational documents: as many as they have, then Done ---
  if (step === 'documents') {
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

    const name = doc?.file_name ?? `document-${Date.now()}.jpg`
    try {
      const file = await ctx.api.getFile(doc?.file_id ?? photo!.file_id)
      const res = await fetch(`https://api.telegram.org/file/bot${env.telegramBotToken}/${file.file_path}`)
      const path = await storeDocument(ctx.from!.id, name, mime, await res.arrayBuffer())
      if (path) {
        draft.documents = [...(draft.documents ?? []), { path, name, mime }]
        await saveSession(ctx.from!.id, ctx.chat!.id, { data: { draft } })
      }
    } catch (err) {
      // One failed upload must not end a registration.
      console.error('document upload failed', err)
    }

    // Stay on the step: they said "documents", plural, and usually mean it.
    await say(ctx, copy.reg.documentSaved(draft.documents?.length ?? 0))
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
