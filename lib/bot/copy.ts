/**
 * User-facing copy. English only — see CLAUDE.md.
 * Kept in one file so the wording is edited in one place, not hunted through handlers.
 */

export const copy = {
  welcome: [
    'Welcome 👋',
    '',
    'This is the Misale tutors bot. Open tutoring jobs come through here.',
    'Everything is buttons — you never have to type.',
  ].join('\n'),

  menu: 'What would you like to do?',

  applyingFor: "You're applying for:",
  applyNext: 'Tap below to continue. The whole registration is buttons.',

  jobFilled: 'Sorry — this position has been filled. Here is what is open now.',
  jobNotFound: 'That posting could not be found. Here is what is open now.',
  noOpenJobs: 'Nothing is open right now. Register, and we will message you when something fits.',

  notReadyYet: "This part isn't ready yet. Check back soon.",

  buttons: {
    openJobs: 'Open jobs',
    register: 'Register as a tutor',
    myProfile: 'My profile',
    faq: 'FAQ',
    applyNow: 'Apply for this job',
    backToMenu: 'Main menu',
  },
} as const
