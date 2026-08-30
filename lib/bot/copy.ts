/**
 * User-facing copy. English only — see CLAUDE.md.
 * Kept in one file so the wording is edited in one place, not hunted through handlers.
 */

/**
 * The group you already send everyone by hand: 122 people were told "join the
 * @wisdomwayteachersteam, for current job post" after applying. One constant,
 * because it is the kind of thing that changes and must change in one place.
 *
 * Kept out of lib/bot/answers/knowledge.ts on purpose. Knowledge is what the
 * model rewrites, and a model that invents a link is a phishing message the
 * agency sent — rejectAnswer() drops any answer containing one. A link belongs
 * only in copy the code sends verbatim.
 */
export const JOBS_GROUP = '@wisdomwayteachersteam'

/**
 * Which of several wordings goes out this time.
 *
 * Seeded from the Telegram message id rather than at random: it is free, it is
 * already in hand, and because ids climb by at least one per message the same
 * person never draws the same variant twice running. A random pick can, and
 * "Any time." twice in a row undoes the whole point of having variants.
 *
 * Deterministic, so a test can assert what a given message gets back.
 */
export function pick<T>(variants: readonly T[], seed: number): T {
  return variants[Math.abs(Math.trunc(seed)) % variants.length]
}

export const copy = {
  welcome: [
    'Welcome 👋',
    '',
    'This is the Misale tutors bot. Open tutoring jobs come through here.',
    'Everything you do is a button — and if you have a question, just type it and I will answer.',
  ].join('\n'),

  menu: 'What would you like to do?',

  /**
   * A file from somebody who is not mid-registration. Eleven people in the
   * real history sent a transcript into a bot that answered with a menu.
   */
  files: {
    savedAsCv: 'Got it — saved as your CV.',
    savedAsDocument: 'Got it — added to your documents.',
    notRegistered:
      'I cannot keep that yet — there is no profile to put it on. Register first and I will ask you for it, and for your educational documents, as part of the steps.',
    tooBig: 'That file is over 10 MB. Send a smaller one.',
    badType: 'Send a PDF, a Word document, or a photo.',
    failed: 'That did not save. Try sending it once more.',
  },

  // ---- typed questions ----
  answers: {
    /**
     * Nothing in the knowledge base covered it. This says so and stops. It
     * must never offer a person, a number to call or a promise to follow up —
     * see the design rule in CLAUDE.md.
     */
    uncovered: [
      "That one I can't answer — nobody has written it down yet, and I would rather say so than guess. These are the nearest things I do know, or ask me again in different words.",
      "I don't have that one written down, and I'd sooner tell you so than invent something. Here are the closest topics I do have — or put it to me in different words.",
      "That hasn't been written down here yet, so I won't guess at it. These are the nearest things I know about.",
    ],

    /** Asked something in the middle of registering. Answer, then point back. */
    backToRegistration: 'Now — back to your registration. Tap the buttons above to carry on.',

    /**
     * The commonest message anyone sends: 781 of 1,350 people in the real
     * history said some version of "I want to apply". Saying it is not
     * applying, so this hands them the thing that is.
     */
    wantsToApply: 'Here is what is open. Tap the one you want and I will take you through it.',
    wantsToApplyNothingOpen:
      `Nothing is open this minute. Register and I will message you here the moment a job fits you — and every post also goes to ${JOBS_GROUP} if you would rather watch for yourself.`,

    /** "Is it still open?" — answered from the live list rather than a promise. */
    stillOpen: 'These are open right now. Anything not listed already has a tutor.',
    stillOpenNothing: `Nothing is open right now. Register and I will message you when a job fits — every post also goes to ${JOBS_GROUP}.`,

    /**
     * "The first one." A reply to a message the bot did not send and cannot
     * see, so it says so rather than guessing which one they meant.
     */
    picksFromAList: 'I am not sure which one you mean — tap it below and I will know.',

    /**
     * "Okay thank you." Worth a reply, but not an answer.
     *
     * The fallback only. What someone actually said — hello, sorry, goodbye,
     * thanks — is answered from `copy.smalltalk`, because replying "Any time."
     * to "Hello" is the single loudest way a bot announces it is one.
     */
    courtesy: ['Any time.', 'Of course.', 'Sure thing.'],
  },

  /**
   * Somebody saying they are stopping.
   *
   * The bot used to file the notice, say nothing about it, and then read out
   * the FAQ entry — "tell us as early as you can before you stop" — at a
   * person who had just done exactly that. It was the worst reply in the bot:
   * everything it needed was already in the database, and it answered from a
   * knowledge base instead.
   *
   * None of this promises a reply. It states what was recorded and what the
   * agency does about it, which is the same thing the FAQ entry always said.
   */
  leaving: {
    /** One live placement, so there was nothing to ask. */
    filed: (job: string) => [
      `Noted, and recorded — ${job}.`,
      '',
      'That is all you needed to do. Finding the family another tutor is our job, not yours, so there is nothing for you to arrange. What you wrote has been kept as you wrote it, timing and all.',
    ].join('\n'),

    /** They have said it before and it is still open. Say so; do not re-file. */
    already: (job: string) =>
      `You have already told me about ${job}, and it is still on the list — no need to say it twice. There is nothing further for you to do.`,

    /**
     * More than one live placement. The bot must not guess which, and this is
     * the one question worth asking, because it is answerable with buttons.
     */
    which:
      'Understood. You are teaching more than one, though, so I do not want to guess at the wrong family — which are you stopping?',

    /** Tapped the wrong thing, or the placement ended in the meantime. */
    gone: 'I could not find that one among your placements any more. Take another look below.',
  },

  /**
   * What to say to something that is not a question.
   *
   * Every one of these is a list, and which line goes out is picked from the
   * Telegram message id — so consecutive messages never draw the same variant,
   * and saying "thanks" three times does not get the same sentence three times.
   * That repetition, more than any single wording, is what made the bot read
   * like a machine.
   *
   * Nothing here offers a person, and nothing here implies one is reading. See
   * the design rule in CLAUDE.md — `frustrated` is where that matters most,
   * because somebody who is annoyed is exactly who a bot wants to hand off.
   */
  smalltalk: {
    /**
     * A greeting, answered according to where the person actually stands.
     * The bot knows — it is in the database — and greeting a tutor who has
     * been teaching for a month as though they had just arrived is the kind
     * of thing only software does.
     */
    greeting: {
      stranger: [
        'Hello 👋 Good to meet you. I look after the tutoring jobs here — ask me anything, or take a look at what is open.',
        'Hi there 👋 Welcome. I can tell you how the work, the pay and the hiring go, and show you what is open right now.',
        'Hello 👋 Glad you wrote. Ask me anything about the jobs or the pay and I will tell you straight.',
      ],
      known: [
        'Hello again 👋 Good to hear from you. What can I help with?',
        'Hi 👋 Nice to see you back. Ask away.',
        'Hello 👋 Welcome back. What is on your mind?',
      ],
      teaching: [
        'Hello 👋 I hope the lessons are going well. What can I help with?',
        'Hi 👋 Good to hear from you — I hope the teaching is going smoothly. What do you need?',
        'Hello 👋 I hope your students are keeping you busy. What can I do?',
      ],
    },

    /** Asked after the bot's health. No knowledge entry will ever cover it. */
    howAreYou: [
      'I am well, thank you for asking — always here and never tired. What can I help with?',
      'Doing fine, thanks. More to the point: what can I help you with?',
      'All good on my side. What do you need?',
    ],

    thanks: [
      'Any time.',
      'You are very welcome.',
      'Happy to help — ask me again whenever you need to.',
      'Glad that was useful.',
    ],

    /** "Ok", "got it". A long reply to a short acknowledgement is its own kind of robot. */
    affirm: ['Good.', 'Got it.', 'Noted.', 'Right you are.'],

    apology: [
      'No need to apologise at all.',
      'Nothing to be sorry for — take your time.',
      'No trouble whatsoever.',
    ],

    /**
     * "I will get back to you." Honest about the one thing that does move on
     * without them: a job can be filled while they think about it.
     */
    later: [
      'Of course — take your time. I am here whenever you come back. Jobs do get taken, though, so if one interests you it is worth applying before you decide.',
      'No rush at all. I will be here. Only thing worth saying: an open job can be filled in the meantime, so apply first and think after if you are unsure.',
      'Understood — come back whenever suits you. Nothing on your side expires, though a job that is open today may not be next week.',
    ],

    farewell: [
      'Goodbye — and good luck out there.',
      'Take care. Come back any time.',
      'See you. I am here whenever you need me.',
    ],

    praise: [
      'That is kind of you — thank you.',
      'Thank you, that is good to hear.',
      'Much appreciated. Ask me anything else whenever.',
    ],

    /**
     * Somebody typing their qualifications into the chat. It counts — but only
     * where the ranker can read it, which is the profile and not this message.
     */
    introduces: [
      'Thank you for telling me — and it does count. The catch is that I cannot read it from a message: what gets weighed when a job comes up is what is on your profile.',
      'Good to know. Put it on your profile rather than here, though — the chat is just between us, and the profile is the part that is actually read when a family is choosing.',
      'That is worth having on record. It only counts once it is on your profile, though, because that is what gets looked at when a job matches you.',
    ],

    /**
     * Somebody who has had enough. Says plainly that there is nobody behind
     * the bot — which is true, and is kinder than a hand-off that never comes.
     */
    frustrated: [
      'I hear you, and I am sorry that missed. I am a bot, so I only know what has been written down here — there is nobody behind me to pass you to. Say it once more in different words and I will try again, or take one of the topics below.',
      'Fair enough — that clearly was not what you wanted. I will not pretend there is a person here to hand you over to. Let me try again: put it differently, or pick a topic below.',
      'Sorry. That was not useful, and I would rather say so than keep going. I only know what is written down here. Try me in other words, or take one of these.',
    ],
  },

  /**
   * Typed something that is not a question, not a courtesy and not a step.
   * This used to be the bare menu — "What would you like to do?" — which reads
   * as the bot ignoring what was said and handing over a list instead.
   */
  notSure: [
    'I am not quite sure what you are after there. Give me a few more words and I will try, or take one of these.',
    'That one I did not follow. Say a little more and I will have another go — or tap something below.',
    'I did not quite catch that. Tell me a bit more, or pick one of these.',
  ],

  applyingFor: 'This job:',
  applyNext: 'Tap below to continue. The whole registration is buttons.',

  jobFilled: 'Sorry — a tutor has already been assigned to that one. Here is what is open now.',
  jobNotFound: 'That posting could not be found. Here is what is open now.',
  noOpenJobs: `Nothing is open right now. Register and we will message you when something fits — and every post also goes to ${JOBS_GROUP}, so you can watch there too.`,

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

    documents:
      'And your educational documents — your degree, your grade 12 certificate, a transcript. Send them one at a time, as many as you have, then tap Done. Photos are fine.',
    documentSaved: (count: number) =>
      `Got it — ${count} document${count === 1 ? '' : 's'} so far. Send another, or tap Done.`,
    documentsSkipped: 'No problem.',

    done: (applied: string | null) =>
      [
        applied
          ? `You're registered, and your application for ${applied} is in.\n\nWe will message you here if you are shortlisted. You do not need to do anything else.`
          : "You're registered.\n\nWe will message you here when a job suits you. You do not need to do anything else.",
        '',
        `Every job also goes to ${JOBS_GROUP}. Join it and pin it, and you will see each post as it goes up.`,
      ].join('\n'),

    staleTap: 'You already answered that one.',

    /** An answered step collapses to this, so the chat reads as a record. */
    answered: (label: string, value: string) => `✓ ${label} — ${value}`,
    answeredConsent: '✓ Agreed — we may keep your details and message you about jobs',
    answeredCvSkipped: '✓ CV — skipped',
    answeredCvSaved: '✓ CV — received',
    answeredDocuments: (count: number) =>
      count === 0 ? '✓ Documents — skipped' : `✓ Documents — ${count} received`,

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
    fix: 'Anything here can be changed — tap Change something.',
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
    'A one-off amount equal to one period of our fee, due within two weeks of meeting the family and before your first salary. It is on top of the fee taken from each payment, not instead of it. The exact figure is always in the offer, before you accept.',
    '',
    '<b>When do I hear back?</b>',
    'Only if you are shortlisted, and always here. There is nothing to chase.',
    '',
    '<b>Can I ask a question here?</b>',
    'Yes — type it and I will answer. No person reads this chat, so nothing you send is passed on and nobody will call you back. Anything that actually happens here happens through a button.',
  ].join('\n'),

  /**
   * Changing something already saved.
   *
   * Until this existed the only way to correct a profile was Register again —
   * fourteen steps to fix one wrong phone number, which is why so few were ever
   * corrected. Nothing here queues anything for a person to read.
   */
  edit: {
    title: 'What do you want to change?',
    none: 'There is no profile to change yet. Register first and everything on it can be edited afterwards.',
    saved: (field: string) => `${field} updated. Anything else?`,
    cv: 'Send your CV as a file or a photo and it replaces the one we have. Tap Back to leave it as it is.',
    documents: (n: number) =>
      n === 0
        ? 'Send any degree or transcript as a file or a photo.'
        : `You have sent ${n} ${n === 1 ? 'document' : 'documents'}. Send more to add to them, or keep what you have.`,
    documentsKept: 'Left as they were.',
    failed: 'That did not save. Try it once more, and nothing already on your profile has changed.',
    done: 'Nothing else changed.',
  },

  /**
   * Where a tutor is paid. Both lines below end the matter: neither offers a
   * person, a number to call, or a promise that anyone will follow up.
   */
  payout: {
    notRegistered:
      'There is nothing to pay into yet — you have no profile. Register first, and I will ask for your account when you are hired.',
    /**
     * Kept for the profile screen, which can still say why the account is
     * blank. Nothing blocks a tutor from filling it in early any more.
     */
    notHiredYet:
      'You have no placement yet, so there is nothing to pay you for — but you can set your account now and it will be there when there is.',
  },

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
    payoutDetails: 'Payment details',
    editProfile: 'Change something',
    doneEditing: 'Done — show my profile',
    keepMine: 'Keep what I have',
  },
} as const
