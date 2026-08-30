import { InlineKeyboard } from 'grammy'
import { copy } from './copy'
import { jobLabel, type OpenJob } from './jobs'
import type { KnowledgeEntry } from './answers/knowledge'

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
    .text(copy.buttons.registerAgain, 'menu:register')
    .row()
    .text(copy.buttons.openJobs, 'menu:jobs')
    .text(copy.buttons.backToMenu, 'menu:main')
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

/**
 * Under an answered question. The nearest topics, so a question the bot got
 * only half right still leads somewhere — and, deliberately, no way to escalate
 * to a person, because there is no person.
 */
export function answerKeyboard(related: KnowledgeEntry[]): InlineKeyboard {
  const kb = new InlineKeyboard()
  for (const entry of related) {
    kb.text(entry.topic, `ask:${entry.id}`).row()
  }
  return kb.text(copy.buttons.backToMenu, 'menu:main')
}
