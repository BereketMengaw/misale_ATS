import { InlineKeyboard, type Context } from 'grammy'
import { getBot } from '@/lib/bot/bot'
import { getSession, saveSession, clearFlow } from '@/lib/bot/session'
import { backKeyboard } from '@/lib/bot/keyboards'
import { copy } from '@/lib/bot/copy'
import { logMessage } from '@/lib/bot/log'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  checkAccount, checkBankName, COMMON_BANKS, destinationLabel, PAYOUT_PROVIDERS,
  type PayoutProvider,
} from '@/lib/candidates/payout-details'
import {
  askPayoutAccount, askPayoutBank, askPayoutBankTyped, askPayoutName, askPayoutProvider,
  payoutAccountProblem, payoutBankProblem, payoutSaved,
} from '@/lib/prepayments/messages'

/**
 * Where a tutor wants to be paid, asked once, at the hire.
 *
 * Three steps: provider (buttons), account number (typed), name on the account
 * (typed). The two typed steps are not a conversation — `checkAccount` decides
 * whether the number is usable and nobody reads either answer to interpret it,
 * the same reasoning that already lets a tutor type their phone number rather
 * than share a contact card. Nothing here is queued for a human.
 *
 * Asked at the hire rather than during registration on purpose: every applicant
 * would otherwise hand over bank details for a job they may not get, and the
 * agency would be holding hundreds of accounts it has no use for.
 */

export const PAYOUT_FLOW = 'payout'

type Step = 'provider' | 'bank' | 'account' | 'name'

type Draft = {
  provider?: PayoutProvider
  /** Only for 'other' — the bank's own name, so the operator knows where to send it. */
  bank?: string
  account?: string
}

function providerKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  for (const p of PAYOUT_PROVIDERS) kb.text(p.label, `payout:${p.value}`).row()
  return kb
}

/** The common banks, two to a row, plus a way out for one that is not listed. */
function bankKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  COMMON_BANKS.forEach((bank, i) => {
    // The index is the callback payload: a bank name would blow the 64-byte
    // callback_data limit and cannot be trusted back from the client anyway.
    kb.text(bank, `payout:bank:${i}`)
    if ((i + 1) % 2 === 0) kb.row()
  })
  return kb.row().text('Another one', 'payout:bank:type').row().text(copy.buttons.back, 'menu:payout')
}

/** Start it from the server — at a hire there is no ctx to reply into. */
export async function askForPayoutDetails(telegramId: number, chatId: number): Promise<boolean> {
  try {
    const bot = await getBot()
    await saveSession(telegramId, chatId, {
      flow: PAYOUT_FLOW,
      step: 'provider' satisfies Step,
      data: { payout: {} },
    })
    await bot.api.sendMessage(chatId, askPayoutProvider, { reply_markup: providerKeyboard() })
    await logMessage({ direction: 'out', chatId, kind: 'payout-details', payload: { text: askPayoutProvider } })
    return true
  } catch (err) {
    // A tutor who blocked the bot must not break a hire. The operator can
    // still type the account into the dashboard.
    console.error('could not ask for payout details', err)
    return false
  }
}

/**
 * The menu entry for a hired tutor.
 *
 * Shows what is on file, and re-sends the pre-payment notice if one is still
 * owing — the knowledge base tells tutors this is where a lost account number
 * comes back, and an answer that points at a button which does nothing is
 * worse than no answer.
 */
export async function showPayoutDetails(ctx: Context, candidateId: number): Promise<void> {
  const db = supabaseAdmin()

  const { data: owing } = await db
    .from('prepayments')
    .select('id')
    .eq('candidate_id', candidateId)
    .eq('status', 'due')
    .order('due_on')
    .limit(1)
    .maybeSingle()

  if (owing) {
    const { notifyPrepayment } = await import('@/lib/prepayments/service')
    await notifyPrepayment(owing.id)
  }

  const { data: c } = await db
    .from('candidates')
    .select('payout_provider, payout_account, payout_name, payout_bank')
    .eq('id', candidateId)
    .maybeSingle()

  if (!c?.payout_account) {
    await beginPayoutDetails(ctx)
    return
  }

  await ctx.reply(
    [
      'You are paid into:',
      '',
      `  ${destinationLabel(c.payout_provider as PayoutProvider, c.payout_bank)} ${c.payout_account}`,
      `  ${c.payout_name ?? ''}`.trimEnd(),
    ].join('\n'),
    { reply_markup: new InlineKeyboard().text('Change this', 'payout:change') },
  )
}

/** The same flow, reached from the menu by a tutor changing their account. */
export async function beginPayoutDetails(ctx: Context): Promise<void> {
  await saveSession(ctx.from!.id, ctx.chat!.id, {
    flow: PAYOUT_FLOW,
    step: 'provider' satisfies Step,
    data: { payout: {} },
  })
  await ctx.reply(askPayoutProvider, { reply_markup: providerKeyboard() })
}

function draftOf(data: Record<string, unknown>): Draft {
  return (data.payout as Draft | undefined) ?? {}
}

export async function handlePayoutCallback(ctx: Context, value: string): Promise<boolean> {
  // "Change this" arrives from a message sent outside any flow, so it is
  // handled before the flow check rather than rejected as a stale tap.
  if (value === 'change') {
    await ctx.answerCallbackQuery()
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {})
    await beginPayoutDetails(ctx)
    return true
  }

  const session = await getSession(ctx.from!.id)
  if (session?.flow !== PAYOUT_FLOW) return false

  const provider = PAYOUT_PROVIDERS.find((p) => p.value === value)
  if (!provider) {
    await ctx.answerCallbackQuery()
    return true
  }

  const draft: Draft = { ...draftOf(session.data), provider: provider.value }
  await saveSession(ctx.from!.id, ctx.chat!.id, { step: 'account' satisfies Step, data: { payout: draft } })

  await ctx.answerCallbackQuery()
  // The buttons come off, so an old message cannot rewrite a finished answer.
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {})
  await ctx.reply(askPayoutAccount(provider.label), { reply_markup: backKeyboard() })
  return true
}

export async function handlePayoutMessage(ctx: Context): Promise<boolean> {
  const session = await getSession(ctx.from!.id)
  if (session?.flow !== PAYOUT_FLOW) return false

  const text = ctx.message?.text?.trim()
  if (!text) return false

  const step = session.step as Step
  const draft = draftOf(session.data)

  if (step === 'bank') {
    const checked = checkBankName(text)
    if (!checked.ok) {
      await ctx.reply(payoutBankProblem[checked.reason], { reply_markup: backKeyboard() })
      return true
    }
    await saveSession(ctx.from!.id, ctx.chat!.id, {
      step: 'account' satisfies Step,
      data: { payout: { ...draft, bank: checked.bank } },
    })
    await ctx.reply(askPayoutAccount(checked.bank), { reply_markup: backKeyboard() })
    return true
  }

  if (step === 'account') {
    const checked = checkAccount(text)
    if (!checked.ok) {
      await ctx.reply(payoutAccountProblem[checked.reason], { reply_markup: backKeyboard() })
      return true
    }
    await saveSession(ctx.from!.id, ctx.chat!.id, {
      step: 'name' satisfies Step,
      data: { payout: { ...draft, account: checked.account } },
    })
    await ctx.reply(askPayoutName, { reply_markup: backKeyboard() })
    return true
  }

  if (step === 'name') {
    const name = text.slice(0, 80)
    if (name.length < 3) {
      await ctx.reply('That is too short to be the name on an account. Send it again.')
      return true
    }
    // "Another bank" with no bank named is not a destination.
    if (!draft.provider || !draft.account || (draft.provider === 'other' && !draft.bank)) {
      // Session lost its middle. Start over rather than save half a destination.
      await beginPayoutDetails(ctx)
      return true
    }

    await supabaseAdmin()
      .from('candidates')
      .update({
        payout_provider: draft.provider,
        payout_account: draft.account,
        payout_name: name,
        payout_bank: draft.provider === 'other' ? draft.bank : null,
        payout_set_at: new Date().toISOString(),
      })
      .eq('telegram_id', ctx.from!.id)

    await clearFlow(ctx.from!.id, ctx.chat!.id)
    await ctx.reply(
      payoutSaved(destinationLabel(draft.provider, draft.bank ?? null), draft.account, name),
    )
    return true
  }

  return false
}
