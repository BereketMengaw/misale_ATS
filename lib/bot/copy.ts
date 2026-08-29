/**
 * User-facing copy. Amharic first, English second — each written natively,
 * not one translated through the other's sentence structure.
 */

export const copy = {
  welcome: {
    am: [
      'እንኳን ደህና መጡ 👋',
      '',
      'ይህ የሚሳሌ አስተማሪዎች ቦት ነው። ክፍት የማስተማር ስራዎችን እዚህ ያገኛሉ።',
      'ሁሉም ነገር በአዝራር ነው — መጻፍ አያስፈልግም።',
    ].join('\n'),
    en: [
      'Welcome 👋',
      '',
      'This is the Misale tutors bot. Open tutoring jobs come through here.',
      'Everything is buttons — you never have to type.',
    ].join('\n'),
  },

  chooseLanguage: {
    am: 'ቋንቋ ይምረጡ',
    en: 'Choose a language',
  },

  languageSet: {
    am: 'ቋንቋዎ አማርኛ ሆኗል።',
    en: 'Your language is set to English.',
  },

  menu: {
    am: 'ምን ማድረግ ይፈልጋሉ?',
    en: 'What would you like to do?',
  },

  notReadyYet: {
    am: 'ይህ ክፍል ገና እየተዘጋጀ ነው። በቅርቡ ይመለሱ።',
    en: "This part isn't ready yet. Check back soon.",
  },

  buttons: {
    openJobs: { am: 'ክፍት ስራዎች', en: 'Open jobs' },
    register: { am: 'እንደ አስተማሪ ይመዝገቡ', en: 'Register as a tutor' },
    myProfile: { am: 'የእኔ መገለጫ', en: 'My profile' },
    faq: { am: 'ተደጋጋሚ ጥያቄዎች', en: 'FAQ' },
    amharic: 'አማርኛ',
    english: 'English',
  },
} as const

export type Lang = 'am' | 'en'

/** Pick one language, or show both stacked when we don't know yet. */
export function t(entry: { am: string; en: string }, lang?: Lang): string {
  if (lang === 'am') return entry.am
  if (lang === 'en') return entry.en
  return `${entry.am}\n\n— — —\n\n${entry.en}`
}
