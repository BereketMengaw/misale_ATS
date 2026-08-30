/**
 * What the bot is allowed to assert. English only — see CLAUDE.md.
 *
 * This is the ONLY source of fact for an answered question. The model does not
 * know anything about this agency: it is handed the entries below and told to
 * answer from them and nothing else. So a wrong figure here becomes a wrong
 * figure in a tutor's chat, and a figure that is missing here is one the bot
 * will decline to state rather than invent.
 *
 * `answer` is sent verbatim when there is no model. Keep every one of them a
 * complete, sendable reply on its own.
 */

export type KnowledgeEntry = {
  id: string
  /** Shown on the follow-up buttons, so it reads as a question a person asks. */
  topic: string
  /** Lowercase. Multi-word entries are phrases and score higher than single words. */
  keywords: string[]
  answer: string
}

export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'how-it-works',
    topic: 'How do I get a job?',
    keywords: [
      'how does this work', 'how do i get a job', 'how to get job', 'get hired',
      'how this works', 'how it works', 'get a job',
    ],
    answer:
      'Apply to anything open. We rank everyone who applied, ask the best few to accept the terms, and the family picks from those who accept. Tap "Open jobs" to see what is live now.',
  },
  {
    id: 'pay',
    topic: 'What am I paid?',
    keywords: [
      'pay', 'paid', 'salary', 'wage', 'money', 'birr', 'how much', 'earn',
      'income', 'payment', 'rate',
    ],
    answer:
      'The figure in an offer is yours to keep. Our fee is already taken out of it — the family pays more than you see, and you never send us that part. The exact figure is in the offer before you accept.',
  },
  {
    id: 'commission',
    topic: 'What is your fee?',
    keywords: [
      'commission', 'fee', 'cut', 'percentage', 'percent', 'charge', 'deduct',
      'deduction', 'your share', 'agency fee',
    ],
    answer:
      'Our fee comes out of what the family pays, before the figure you are shown. You never send it to us separately. The amount you keep is always the number written in the offer.',
  },
  {
    id: 'pre-payment',
    topic: 'What is the pre-payment?',
    keywords: [
      'prepayment', 'pre payment', 'deposit', 'upfront', 'advance',
      'pay before', 'pay you before', 'before i start', 'pay first',
      'why do i pay', 'registration fee', 'joining fee',
      'when is it due', 'when do i pay', 'deadline', 'two weeks',
    ],
    answer:
      'A one-off amount equal to one period of our fee. It falls due once you have met the family — within two weeks of that, and before your first salary. It is on top of the fee taken from each payment, not instead of it, and the exact figure is always in the offer before you accept.',
  },
  {
    id: 'hear-back',
    topic: 'When do I hear back?',
    keywords: [
      'hear back', 'how long until', 'how long to wait', 'reply',
      'response', 'waiting', 'wait',
      'status', 'update', 'result', 'answer me', 'still waiting',
    ],
    answer:
      'Only if you are shortlisted, and always here in this chat. There is nothing to chase and nobody to call — if you are picked, a message arrives on its own.',
  },
  {
    id: 'shortlisted',
    topic: 'Was I shortlisted?',
    keywords: [
      'shortlisted', 'shortlist', 'selected', 'chosen', 'picked', 'did i get',
      'am i in', 'rejected', 'was i accepted',
    ],
    answer:
      'I cannot look up your application from here. If you are shortlisted, an offer arrives in this chat by itself. No message means it has not happened yet.',
  },
  {
    id: 'no-reply-human',
    topic: 'Is a person reading this?',
    keywords: [
      'is anyone there', 'are you a bot', 'human', 'person', 'someone',
      'talk to', 'speak to', 'call you', 'call me', 'phone me', 'ring me',
      'your phone number', 'office', 'agent',
    ],
    answer:
      'No person reads this chat — I answer it. I can explain how the work, the pay and the process run, but everything that actually happens here happens through the buttons.',
  },
  {
    id: 'ranking',
    topic: 'How are applicants ranked?',
    keywords: [
      'rank', 'ranking', 'ranked', 'score', 'compare', 'why not me', 'chances',
      'criteria', 'requirement', 'qualify', 'qualification',
    ],
    answer:
      'Everyone who applies is scored the same way. The grade counts most, then how close you live to the family, then the subject, whether your days cover what the job needs, your experience and your education, and how your past placements were rated. Never having been rated does not count against you.',
  },
  {
    id: 'negotiate',
    topic: 'Can the rate be changed?',
    keywords: [
      'negotiate', 'negotiation', 'increase', 'raise', 'more money', 'higher',
      'lower', 'discount', 'bargain', 'can you make it', 'too low', 'reduce',
      'rate',
    ],
    answer:
      'The rate on a post is the rate. It is not negotiated here, and there is nobody to negotiate with — apply if it works for you, and skip it if it does not. Other jobs pay differently, so it is worth checking the open list.',
  },
  {
    id: 'profile-change',
    topic: 'How do I change my details?',
    keywords: [
      'change', 'edit', 'update', 'wrong', 'mistake', 'correct', 'fix',
      'my profile', 'my details', 'phone number', 'my number', 'register again',
    ],
    answer:
      'Open "My profile" to see what we hold, then tap "Register again" to replace it. It is the same buttons as the first time and it overwrites the old answers.',
  },
  {
    id: 'delete-data',
    topic: 'Can you delete my data?',
    keywords: [
      'delete', 'remove me', 'erase', 'privacy', 'my data', 'unsubscribe',
      'stop messaging', 'stop the messages', 'opt out', 'delete my profile',
    ],
    answer:
      'Yes. Ask here and your profile and CV are deleted, and the job messages stop. You can register again later; nothing is kept to stop you.',
  },
  {
    id: 'leaving',
    topic: 'What if I want to stop teaching?',
    keywords: [
      'stop', 'stop teaching', 'want to stop', 'stop in the middle', 'quit',
      'resign', 'leave the job', 'leave', 'discontinue', 'cannot continue',
      'can not continue', 'stop after i started', 'give up', 'drop the job',
      'no longer teach', 'end the job',
    ],
    answer:
      'Tell us here as early as you can, before you stop. Finding the family another tutor is our job, not yours — but we can only do it if we know in advance, so that nobody is left without one. There is nothing for you to arrange yourself.',
  },
  {
    id: 'cv',
    topic: 'Do I need a CV?',
    keywords: [
      'cv', 'resume', 'document', 'upload', 'file', 'certificate',
      'transcript', 'attach',
    ],
    answer:
      'It is optional but it helps. The registration collects everything we score you on by buttons, so a CV is extra evidence a person reads when the top few are close. A photo of it is fine.',
  },
  {
    id: 'area',
    topic: 'Where would I teach?',
    keywords: [
      'where', 'area', 'location', 'place', 'addis', 'distance', 'far',
      'travel', 'transport', 'online', 'remote', 'home',
      // The sub-cities a tutor registers in — kept in step with DEFAULT_AREAS
      // by tests/answers.test.ts — plus the names people actually type.
      'bole', 'yeka', 'kirkos', 'arada', 'lideta', 'addis ketema', 'gulele',
      'kolfe keranio', 'nifas silk lafto', 'akaky kaliti',
      'piassa', 'megenagna', 'cmc', 'sarbet', 'gerji', 'ayat', 'summit',
      'lebu', 'jemo', 'kazanchis', 'saris', 'mexico',
    ],
    answer:
      'Lessons are at the family\'s home, and every post names the part of Addis it is in. You are matched towards areas near the one you registered in, so pick the closest when you register.',
  },
  {
    id: 'schedule',
    topic: 'How do lessons and hours work?',
    keywords: [
      'schedule', 'lesson', 'session', 'days', 'times', 'timetable',
      'how many days', 'how long is a lesson',
    ],
    answer:
      'Each post says how many days a week and roughly how long a session runs. The exact times are whatever you and the family agree once you are hired — nobody here sets your timetable, and there is nothing to log afterwards.',
  },
  {
    id: 'when-paid',
    topic: 'When am I paid?',
    keywords: [
      'when paid', 'payout', 'payday', 'receive money', 'transfer', 'bank',
      'end of month', 'get my money', 'late payment',
    ],
    answer:
      'After the family has paid for that period. The figure is the one from your offer, with nothing further taken off — our fee came out before you ever saw it.',
  },
  {
    id: 'multiple-jobs',
    topic: 'Can I take more than one job?',
    keywords: [
      'more than one', 'two jobs', 'two families', 'another job',
      'another family', 'multiple', 'second', 'at once', 'at the same time',
      'part time', 'full time', 'other work',
    ],
    answer:
      'Yes, as long as the days and times do not clash with a family you have already committed to. Apply to anything open that fits the availability you registered.',
  },
  {
    id: 'no-jobs',
    topic: 'There is nothing open — what now?',
    keywords: [
      'no jobs', 'nothing open', 'empty', 'no vacancy', 'no post', 'when new',
      'next job', 'notify me',
    ],
    answer:
      'Register anyway. New posts are matched against saved profiles, so a job that fits you arrives here as a message you can apply to in one tap — you do not have to keep checking.',
  },
  {
    id: 'legit',
    topic: 'Is this real?',
    keywords: [
      'scam', 'fake', 'legit', 'trust', 'real company', 'safe', 'fraud',
      'who are you', 'about you', 'misale',
    ],
    answer:
      'Misale places tutors with families in Addis. We never ask for money to apply or to be shortlisted, and your phone number is not shown to a family until you are hired. Any figure you owe is written in an offer before you accept it.',
  },
  {
    id: 'pay-to-apply',
    topic: 'Do I pay anything to apply?',
    keywords: [
      'pay to apply', 'pay you to apply', 'have to pay', 'pay to register',
      'application fee', 'is it free', 'free to apply', 'money to apply',
      'pay you first', 'pay anything', 'cost me',
    ],
    answer:
      'No. Applying and registering are free, and nothing is ever due before you are hired. The only amount you owe us is the one-off pre-payment, and that is named in your offer before you accept it.',
  },
  {
    id: 'all-subjects',
    topic: 'What if I teach every subject?',
    keywords: [
      'all subject', 'every subject', 'any subject', 'all subjects',
      'teach everything', 'which subject', 'what subject', 'only maths',
      'general tutor',
    ],
    answer:
      'Say so — there is an "All subjects" button in the subjects step, and it matches you to any job. Most jobs here are for a grade rather than a single subject, so it is worth using if it is true of you.',
  },
  {
    id: 'requirements',
    topic: 'What do I need to qualify?',
    keywords: [
      'requirement', 'qualified', 'eligible', 'degree', 'diploma', 'university',
      'college', 'who can apply', 'am i good enough', 'still a student',
    ],
    answer:
      'There is no fixed bar. You are scored against the others who applied, so what decides it is the fit — the subject, the grade, how near you live and the days you can teach. Education and experience count, but a close match beats a long CV.',
  },
  {
    id: 'registration-time',
    topic: 'How long does registering take?',
    keywords: [
      'registering', 'registration', 'how long to register', 'how many step',
      'take long', 'quick', 'minutes',
    ],
    answer:
      'A couple of minutes. Thirteen steps, nearly all of them buttons — the only thing you type is your name, and your number if the share button does not appear. You can stop part way and pick up where you left off.',
  },
  {
    id: 'why-phone',
    topic: 'Why do you need my phone number?',
    keywords: [
      'why my phone', 'need my phone number', 'why my number',
      'who sees my number', 'is my number safe', 'share my number',
    ],
    answer:
      'So a family can reach you once you are hired, and not before. It is never shown while you are applying or shortlisted, and it is not published anywhere.',
  },
  {
    id: 'apply-many-jobs',
    topic: 'Can I apply to more than one job?',
    keywords: [
      'apply to more', 'several job', 'many job', 'apply again', 'apply twice',
      'other job', 'more posts',
    ],
    answer:
      'Yes, to as many as suit you. Registering once is enough — after that each application is a single tap, and every job is judged on its own.',
  },
  {
    id: 'why-not-chosen',
    topic: 'Why was I not chosen?',
    keywords: [
      'why not chosen', 'not chosen', 'not selected', 'someone else got',
      'lost the job', 'passed over',
    ],
    answer:
      'Almost always because someone matched that job more closely — the subject, the grade, or how near they live. It is not a mark against you and it does not carry into the next one. You stay in the pool.',
  },
  {
    id: 'decline-offer',
    topic: 'What if I turn an offer down?',
    keywords: [
      'decline', 'refuse', 'say no', 'turn down', 'not accept',
      'change my mind', 'withdraw',
    ],
    answer:
      'Nothing else changes. You are out of that one job and stay in the pool for everything else, and we keep messaging you when a job suits you. There is no penalty and nothing to explain.',
  },
  {
    id: 'after-hired',
    topic: 'What happens once I am hired?',
    keywords: [
      'after hired', 'once hired', 'what next', 'next step', 'got the job',
      'start teaching', 'first lesson',
    ],
    answer:
      'You get a message here with the job, what you are paid, and the family. You meet them, agree the times directly, and teach. Your one-off pre-payment is due within two weeks of meeting them and before your first salary — after that there is nothing to send back to us.',
  },
  {
    id: 'family-contact',
    topic: 'When do I get the family details?',
    keywords: [
      'family number', 'family contact', 'parent number', 'their number',
      'address', 'where do i go', 'reach the family', 'contact the family',
    ],
    answer:
      'At the hire. The message telling you the job is yours carries the family name and phone number, and from then on you arrange lessons with them directly.',
  },
  {
    id: 'confirm-hours',
    topic: 'Do I have to log my hours?',
    keywords: [
      'log hours', 'confirm hours', 'timesheet', 'attendance', 'record hours',
      'report hours', 'count hours', 'hours',
    ],
    answer:
      'No. Billing is a flat monthly rate, so nobody counts lessons and there is nothing for you to submit. Teach the days you agreed and that is all.',
  },
  {
    id: 'how-pay-calculated',
    topic: 'How is my pay worked out?',
    keywords: [
      'calculated', 'worked out', 'how is my pay', 'monthly rate',
      'per month', 'billing', 'how much a month',
    ],
    answer:
      'Billing is monthly. On a monthly rate you are simply paid that figure. On an hourly or per-session rate the month is billed for the lessons your agreed days actually fall on, counted off the calendar — so a long month pays more than a short one.',
  },
  {
    id: 'lesson-times',
    topic: 'Who decides the lesson times?',
    keywords: [
      'lesson time', 'who decides', 'what time', 'arrange', 'agree times',
      'change the time', 'when are lessons', 'reschedule',
    ],
    answer:
      'You and the family, between you. The post fixes how many days a week; the hours are whatever you both agree once you are hired. Nobody here sets or changes your timetable.',
  },
  {
    id: 'reminders',
    topic: 'Will I get lesson reminders?',
    keywords: [
      'reminder', 'remind me', 'notification', 'alert', 'will you remind',
    ],
    answer:
      'No. This chat messages you about jobs, offers and hires — not about individual lessons. Once you are placed, the timetable is between you and the family.',
  },
  {
    id: 'accepted-what-now',
    topic: 'I accepted — what happens now?',
    keywords: [
      'i accepted', 'accepted the offer', 'waiting after accepting',
      'family choosing', 'shortlist now what',
    ],
    answer:
      'The family is choosing between the few who accepted. You will hear here either way, and there is nothing to do in the meantime — no one to call and nothing to send.',
  },
]

export function entryById(id: string): KnowledgeEntry | undefined {
  return KNOWLEDGE.find((e) => e.id === id)
}
