import { InlineKeyboard } from 'grammy'
import { copy } from './copy'
import { jobLabel, type OpenJob } from './jobs'

/**
 * The main menu. Every destination is a button — there is no free-text branch,
 * and there is deliberately no "talk to a human".
 */
export function mainMenu(): InlineKeyboard {
  const b = copy.buttons
  return new InlineKeyboard()
    .text(b.openJobs, 'menu:jobs')
    .row()
    .text(b.register, 'menu:register')
    .row()
    .text(b.myProfile, 'menu:profile')
    .text(b.faq, 'menu:faq')
}

/** After arriving on a job deep link. One button forward, one back. */
export function applyKeyboard(jobId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text(copy.buttons.applyNow, `apply:${jobId}`)
    .row()
    .text(copy.buttons.backToMenu, 'menu:main')
}

/** What a filled, expired or unknown link falls back to: the live jobs. */
export function openJobsKeyboard(jobs: OpenJob[]): InlineKeyboard {
  const kb = new InlineKeyboard()
  for (const job of jobs) {
    kb.text(jobLabel(job), `job:${job.id}`).row()
  }
  return kb.text(copy.buttons.backToMenu, 'menu:main')
}
