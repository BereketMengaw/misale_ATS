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

  applyingFor: {
    am: 'እያመለከቱ ያሉት ለዚህ ስራ ነው፦',
    en: "You're applying for:",
  },

  applyNext: {
    am: 'ለመቀጠል ከታች ያለውን ይጫኑ። ምዝገባው በአዝራር ብቻ ነው።',
    en: 'Tap below to continue. The whole registration is buttons.',
  },

  jobFilled: {
    am: 'ይቅርታ፣ ይህ ቦታ ተይዟል። አሁን ክፍት የሆኑት ከታች ናቸው።',
    en: 'Sorry — this position has been filled. Here is what is open now.',
  },

  jobNotFound: {
    am: 'ይህ ማስታወቂያ አልተገኘም። አሁን ክፍት የሆኑት ከታች ናቸው።',
    en: 'That posting could not be found. Here is what is open now.',
  },

  noOpenJobs: {
    am: 'በአሁኑ ጊዜ ክፍት ስራ የለም። ይመዝገቡ — አዲስ ሲወጣ እናሳውቅዎታለን።',
    en: 'Nothing is open right now. Register, and we will message you when something fits.',
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
    applyNow: { am: 'ለዚህ ስራ አመልክት', en: 'Apply for this job' },
    backToMenu: { am: 'ወደ ዋና ገጽ', en: 'Main menu' },
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
