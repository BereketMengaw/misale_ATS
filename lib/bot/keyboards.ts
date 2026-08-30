import { InlineKeyboard } from 'grammy'
import { copy } from './copy'
import { EDIT_LABEL, EDITABLE_STEPS } from './flows/steps'
import { jobLabel, type OpenJob } from './jobs'

/**
 * The main menu. Every destination is a button. A typed question is answered
 * by the bot itself, and there is deliberately no "talk to a human" — nothing
 * here routes a message to a person expecting a reply.
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
    .row()
    // Where a hired tutor is paid. Harmless for everyone else: the flow says
    // so and stops, rather than storing an account for a job nobody has.
    .text(b.payoutDetails, 'menu:payout')
}

/** Anywhere that has nothing to do but go back. */
export function backKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text(copy.buttons.backToMenu, 'menu:main')
}

/** No profile yet: the only useful thing is to start one. */
export function registerKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(copy.buttons.register, 'menu:register')
    .row()
    .text(copy.buttons.backToMenu, 'menu:main')
}

/** A profile that exists: read it, or replace it. */
export function profileKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    // Editing comes first, and Register again is gone: it was the only way to
    // fix a wrong answer, and it meant re-doing all fourteen steps.
    .text(copy.buttons.editProfile, 'menu:edit')
    .row()
    .text(copy.buttons.payoutDetails, 'menu:payout')
    .row()
    .text(copy.buttons.openJobs, 'menu:jobs')
    .text(copy.buttons.backToMenu, 'menu:main')
}

/**
 * One button per changeable field, two to a row.
 *
 * Every one of them re-asks the wizard's own question, so a tutor changing
 * their area sees exactly the buttons they saw when they registered.
 */
export function editMenuKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  EDITABLE_STEPS.forEach((step, i) => {
    kb.text(EDIT_LABEL[step], `edit:${step}`)
    if ((i + 1) % 2 === 0) kb.row()
  })
  return kb.row().text(copy.buttons.doneEditing, 'menu:profile')
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
