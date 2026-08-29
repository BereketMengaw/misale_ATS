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

  applyingFor: 'This job:',
  applyNext: 'Tap below to continue. The whole registration is buttons.',

  jobFilled: 'Sorry — this position has been filled. Here is what is open now.',
  jobNotFound: 'That posting could not be found. Here is what is open now.',
  noOpenJobs: 'Nothing is open right now. Register, and we will message you when something fits.',

  notReadyYet: "This part isn't ready yet. Check back soon.",

  // ---- registration wizard ----
  reg: {
    consent: [
      'Before we start.',
      '',
      'We keep your profile and CV so we can match you to tutoring jobs, and we may message you here when a new one suits you. You can ask us to delete it at any time.',
    ].join('\n'),
    consentDeclined: 'No problem. Nothing has been saved. The open jobs are still here whenever you want them.',

    name: (name: string) => `Is your name ${name}?`,
    nameTypeIt: 'Send me your full name as one message.',
    nameTooShort: 'That looks too short. Send your full name as one message.',

    phone: [
      'Your phone number, please. Parents never see it until you are hired.',
      '',
      'Tap "Share my number" below — it is one tap and nothing to mistype.',
      "Can't see the button? Just type your number instead, like 0911234567.",
    ].join('\n'),
    phoneConfirmed: (national: string) => `Got it — ${national}.`,
    phoneShared: 'Thanks.',
    phoneWrongPerson: 'That is someone else\'s contact. Tap the button to share your own.',

    gender: 'Some families ask for a female or male tutor. Which are you?',
    area: 'Which part of Addis are you in? Pick the closest.',
    education: 'What is your highest level of education?',

    subjects: 'Which subjects can you teach? Tap all that apply, then Done.',
    subjectsNone: 'Pick at least one subject.',
    grades: 'Which grades? Tap all that apply, then Done.',
    gradesNone: 'Pick at least one.',

    days: 'Which days can you teach? Tap all that apply, then Done.',
    daysNone: 'Pick at least one day.',
    times: 'And roughly what times on those days?',
    timesNone: 'Pick at least one.',

    experience: 'How long have you been tutoring?',
    rate: 'What do you expect to be paid?',

    cv: 'Last step — send your CV as a file or a photo. It helps a lot, but you can skip it.',
    cvTooBig: 'That file is over 10 MB. Send a smaller one, or skip this step.',
    cvBadType: 'Send a PDF, a Word document, or a photo of your CV.',
    cvSaved: 'Got your CV.',

    done: (applied: string | null) =>
      applied
        ? `You're registered, and your application for ${applied} is in.\n\nWe will message you here if you are shortlisted. You do not need to do anything else.`
        : "You're registered.\n\nWe will message you here when a job suits you. You do not need to do anything else.",

    staleTap: 'You already answered that one.',

    /** An answered step collapses to this, so the chat reads as a record. */
    answered: (label: string, value: string) => `✓ ${label} — ${value}`,
    answeredConsent: '✓ Agreed — we may keep your details and message you about jobs',
    answeredCvSkipped: '✓ CV — skipped',
    answeredCvSaved: '✓ CV — received',

    alreadyApplied: (job: string) => `You have already applied for ${job}. We will message you here if you are shortlisted.`,
    resume: 'Picking up where you left off.',
  },

  profile: {
    none: 'You have not registered yet. It takes a couple of minutes, and it is all buttons.',
    title: 'Your profile',
    cvYes: 'received',
    cvNo: 'not sent',
    complete: 'Nothing missing.',
    gaps: (list: string) => `Still missing: ${list}.`,
    fix: 'Registering again replaces what is here.',
  },

  /**
   * Sent with parse_mode HTML. It is a fixed string with nothing interpolated
   * into it, so the tags are safe; do not add a `${}` here without escaping.
   */
  faq: [
    '<b>How this works</b>',
    '',
    '<b>How do I get a job?</b>',
    'Apply to anything open. We rank everyone who applied, ask the best few to accept the terms, and the family picks from those who accept.',
    '',
    '<b>What am I paid?</b>',
    'The figure in an offer is yours to keep. Our fee is already taken out of it — the family pays more than you see, and you never send us that part.',
    '',
    '<b>What is the pre-payment?</b>',
    'A one-off amount due to us before your first lesson, equal to one period of our fee. It is on top of the fee taken from each payment, not instead of it. The exact figure is always in the offer, before you accept.',
    '',
    '<b>When do I hear back?</b>',
    'Only if you are shortlisted, and always here. There is nothing to chase.',
    '',
    '<b>Can I reply to this chat?</b>',
    'Nobody reads replies. Everything is a button — if there is no button for it, it is not something that happens here.',
  ].join('\n'),

  buttons: {
    openJobs: 'Open jobs',
    register: 'Register as a tutor',
    myProfile: 'My profile',
    faq: 'FAQ',
    applyNow: 'Apply for this job',
    backToMenu: 'Main menu',
    agree: 'I agree — continue',
    decline: 'No thanks',
    nameYes: "Yes, that's me",
    nameNo: 'Use a different name',
    sharePhone: 'Share my number',
    done: 'Done',
    skip: 'Skip this',
    other: 'Somewhere else',
    back: '← Back',
    registerAgain: 'Register again',
  },
} as const
