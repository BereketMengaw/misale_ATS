import { InlineKeyboard } from 'grammy'
import { copy, type Lang } from './copy'
import { jobLabel, type OpenJob } from './jobs'

export function languageKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(copy.buttons.amharic, 'lang:am')
    .text(copy.buttons.english, 'lang:en')
}

/**
 * The main menu. Every destination is a button — there is no free-text branch,
 * and there is deliberately no "talk to a human".
 */
export function mainMenu(lang: Lang): InlineKeyboard {
  const b = copy.buttons
  return new InlineKeyboard()
    .text(b.openJobs[lang], 'menu:jobs')
    .row()
    .text(b.register[lang], 'menu:register')
    .row()
    .text(b.myProfile[lang], 'menu:profile')
    .text(b.faq[lang], 'menu:faq')
}

/** After arriving on a job deep link. One button forward, one back. */
export function applyKeyboard(jobId: number, lang: Lang): InlineKeyboard {
  return new InlineKeyboard()
    .text(copy.buttons.applyNow[lang], `apply:${jobId}`)
    .row()
    .text(copy.buttons.backToMenu[lang], 'menu:main')
}

/** What a filled, expired or unknown link falls back to: the live jobs. */
export function openJobsKeyboard(jobs: OpenJob[], lang: Lang): InlineKeyboard {
  const kb = new InlineKeyboard()
  for (const job of jobs) {
    kb.text(jobLabel(job), `job:${job.id}`).row()
  }
  return kb.text(copy.buttons.backToMenu[lang], 'menu:main')
}
