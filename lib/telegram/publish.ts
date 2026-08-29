import { InlineKeyboard, GrammyError } from 'grammy'
import { getBot } from '@/lib/bot/bot'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { applyLink } from '@/lib/jobs/apply-link'
import { fitsTelegram, manualPack } from '@/lib/jobs/post-body'

export function applyButton(url: string): InlineKeyboard {
  return new InlineKeyboard().url('Apply', url)
}

export type ChannelCheck = {
  ok: boolean
  detail: string
  chatId?: number
  title?: string
  username?: string | null
}

/**
 * Can the bot actually post here? Asked before the first publish rather than
 * discovered by a failed send, and re-asked from the channels page.
 */
export async function checkChannel(target: string): Promise<ChannelCheck> {
  const bot = await getBot()
  const chatRef = /^-?\d+$/.test(target.trim())
    ? Number(target.trim())
    : `@${target.trim().replace(/^@/, '')}`

  try {
    const chat = await bot.api.getChat(chatRef)
    if (chat.type !== 'channel' && chat.type !== 'supergroup') {
      return { ok: false, detail: `That is a ${chat.type}, not a channel.` }
    }

    const member = await bot.api.getChatMember(chat.id, bot.botInfo.id)
    if (member.status !== 'administrator') {
      return {
        ok: false,
        chatId: chat.id,
        title: chat.title,
        detail: `The bot is "${member.status}" here, not an administrator.`,
      }
    }
    if (member.can_post_messages === false) {
      return {
        ok: false,
        chatId: chat.id,
        title: chat.title,
        detail: 'Admin, but without "Post messages" permission.',
      }
    }

    return {
      ok: true,
      chatId: chat.id,
      title: chat.title,
      username: 'username' in chat ? (chat.username ?? null) : null,
      detail: 'Bot is an admin and can post.',
    }
  } catch (err) {
    const message =
      err instanceof GrammyError ? err.description : err instanceof Error ? err.message : String(err)
    return { ok: false, detail: message }
  }
}

type JobRow = { id: number; body: string }
type ChannelRow = { id: number; title: string; chat_id: number | null; kind: string }

export type PublishOutcome = {
  channelId: number
  channelTitle: string
  ok: boolean
  method: 'bot' | 'manual'
  detail: string
}

/**
 * Publish one job to the given channels.
 *
 * The publication row is created BEFORE the send, because its id goes into the
 * Apply link — that is what attributes an applicant to a channel. A failed send
 * leaves the row with an `error` and no message_id, so retrying reuses the same
 * link rather than orphaning it.
 */
export async function publishJob(
  jobId: number,
  channelIds: number[],
  operatorId: string | null,
): Promise<PublishOutcome[]> {
  const db = supabaseAdmin()

  const { data: job } = await db
    .from('job_posts')
    .select('id, body')
    .eq('id', jobId)
    .maybeSingle<JobRow>()
  if (!job) return []

  const { data: channels } = await db
    .from('channels')
    .select('id, title, chat_id, kind')
    .in('id', channelIds)
    .returns<ChannelRow[]>()
  if (!channels?.length) return []

  const bot = await getBot()
  const outcomes: PublishOutcome[] = []

  for (const channel of channels) {
    const method = channel.kind === 'bot_admin' && channel.chat_id ? 'bot' : 'manual'

    const { data: publication, error: rowError } = await db
      .from('post_publications')
      .upsert(
        { job_post_id: job.id, channel_id: channel.id, method, posted_by: operatorId },
        { onConflict: 'job_post_id,channel_id' },
      )
      .select('id, message_id')
      .single()

    if (rowError || !publication) {
      outcomes.push({
        channelId: channel.id,
        channelTitle: channel.title,
        ok: false,
        method,
        detail: rowError?.message ?? 'Could not record the publication.',
      })
      continue
    }

    if (method === 'manual') {
      outcomes.push({
        channelId: channel.id,
        channelTitle: channel.title,
        ok: true,
        method,
        detail: 'Copy pack ready — post it by hand, then mark it posted.',
      })
      continue
    }

    if (publication.message_id) {
      outcomes.push({
        channelId: channel.id,
        channelTitle: channel.title,
        ok: true,
        method,
        detail: 'Already posted.',
      })
      continue
    }

    if (!fitsTelegram(job.body)) {
      const detail = `Too long for Telegram (${job.body.length}/4096). Shorten the post.`
      await db.from('post_publications').update({ error: detail }).eq('id', publication.id)
      outcomes.push({ channelId: channel.id, channelTitle: channel.title, ok: false, method, detail })
      continue
    }

    try {
      const url = applyLink(bot.botInfo.username, job.id, publication.id)
      const sent = await bot.api.sendMessage(channel.chat_id!, job.body, {
        reply_markup: applyButton(url),
      })

      await db
        .from('post_publications')
        .update({ message_id: sent.message_id, posted_at: new Date().toISOString(), error: null })
        .eq('id', publication.id)

      outcomes.push({
        channelId: channel.id,
        channelTitle: channel.title,
        ok: true,
        method,
        detail: 'Posted.',
      })
    } catch (err) {
      const detail =
        err instanceof GrammyError ? err.description : err instanceof Error ? err.message : String(err)
      await db.from('post_publications').update({ error: detail }).eq('id', publication.id)
      outcomes.push({ channelId: channel.id, channelTitle: channel.title, ok: false, method, detail })
    }
  }

  // A job is open once it is live anywhere.
  if (outcomes.some((o) => o.ok && o.method === 'bot')) {
    await db.from('job_posts').update({ status: 'open' }).eq('id', jobId).eq('status', 'draft')
  }

  return outcomes
}

/** The text the operator pastes into a channel the bot cannot post to. */
export async function manualPackFor(publicationId: number): Promise<string | null> {
  const db = supabaseAdmin()

  const { data } = await db
    .from('post_publications')
    .select('id, job_post_id, job_posts(body)')
    .eq('id', publicationId)
    .maybeSingle()

  if (!data) return null

  const job = data.job_posts as unknown as { body: string } | null
  if (!job) return null

  const bot = await getBot()
  const url = applyLink(bot.botInfo.username, data.job_post_id, data.id)
  return manualPack(job.body, url)
}
