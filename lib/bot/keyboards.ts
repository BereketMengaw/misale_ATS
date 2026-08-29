import { InlineKeyboard } from 'grammy'
import { copy, type Lang } from './copy'

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
