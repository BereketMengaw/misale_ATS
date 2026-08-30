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
      'process', 'work', 'start', 'apply', 'application', 'how',
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
    ],
    answer:
      'A one-off amount due to us before your first lesson, equal to one period of our fee. It is on top of the fee taken from each payment, not instead of it. The exact figure is always in the offer, before you accept.',
  },
  {
    id: 'hear-back',
    topic: 'When do I hear back?',
    keywords: [
      'hear back', 'when', 'how long', 'reply', 'response', 'waiting', 'wait',
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
      'rank', 'ranking', 'score', 'compare', 'why not me', 'chances',
      'criteria', 'requirement', 'qualify', 'qualification',
    ],
    answer:
      'Everyone who applies is scored on the same things: subjects and grades you teach, how close you are to the family, your availability, your experience and your education. A complete profile ranks better than an empty one.',
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
      'delete', 'remove me', 'erase', 'privacy', 'data', 'unsubscribe', 'stop',
      'stop messaging', 'opt out', 'leave',
    ],
    answer:
      'Yes. Ask here and your profile and CV are deleted, and the job messages stop. You can register again later; nothing is kept to stop you.',
  },
  {
    id: 'cv',
    topic: 'Do I need a CV?',
    keywords: [
      'cv', 'resume', 'document', 'upload', 'file', 'certificate', 'degree',
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
      'schedule', 'hours', 'timesheet', 'lesson', 'session', 'days', 'times',
      'timetable', 'attendance', 'confirm hours', 'how many days',
    ],
    answer:
      'Each post says how many days a week and roughly how long a session runs. Once you are placed, this chat reminds you around each lesson and you confirm the hours you taught with a button. Those confirmed hours are what everything is paid from.',
  },
  {
    id: 'when-paid',
    topic: 'When am I paid?',
    keywords: [
      'when paid', 'payout', 'payday', 'receive money', 'transfer', 'bank',
      'end of month', 'get my money', 'late payment',
    ],
    answer:
      'You are paid on the hours you confirmed, after the family has paid for that period. The figure is the one from your offer, with nothing further taken off.',
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
]

export function entryById(id: string): KnowledgeEntry | undefined {
  return KNOWLEDGE.find((e) => e.id === id)
}
