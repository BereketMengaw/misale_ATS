import { describe, expect, it } from 'vitest'
import { KNOWLEDGE, entryById, knowledgeFingerprint } from '@/lib/bot/answers/knowledge'
import { DEFAULT_AREAS } from '@/lib/candidates/options'
import { bestAnswer, normalize, retrieve, scoreAll } from '@/lib/bot/answers/retrieve'
import { rejectAnswer } from '@/lib/ai/provider'
import { answerQuestionTemplate } from '@/lib/ai/providers/template'

describe('knowledge base', () => {
  it('has a unique id, a topic and a real answer for every entry', () => {
    const ids = new Set<string>()
    for (const entry of KNOWLEDGE) {
      expect(entry.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(entry.id)).toBe(false)
      ids.add(entry.id)
      expect(entry.topic.trim()).not.toBe('')
      expect(entry.answer.trim().length).toBeGreaterThan(40)
      expect(entry.keywords.length).toBeGreaterThan(2)
    }
  })

  // Tutors and the bot are English only — see CLAUDE.md.
  it('is English only', () => {
    for (const entry of KNOWLEDGE) {
      expect(entry.answer).not.toMatch(/[ሀ-፿]/)
      expect(entry.topic).not.toMatch(/[ሀ-፿]/)
    }
  })

  // The non-negotiable rule: nothing may route a tutor to a person.
  it('never offers a human, a call or a negotiation', () => {
    const forbidden =
      /we will (call|reply|get back)|contact us|reach out to us|call us|talk to (a|our) (human|person|agent)|our office|whatsapp/i
    for (const entry of KNOWLEDGE) {
      expect(entry.answer).not.toMatch(forbidden)
    }
  })

  // Every answer is sent verbatim when there is no model, so each has to stand
  // alone as a complete reply rather than as a fragment for a model to expand.
  it('sends every answer as a whole sentence', () => {
    for (const entry of KNOWLEDGE) {
      expect(entry.answer.trim()).toMatch(/[.!?]$/)
    }
  })

  // A keyword the scorer throws away — a stop word, or a phrase that can never
  // match because normalize() rewrites it — is dead weight that reads as if it
  // were doing something. Each one has to score against its own entry.
  it('has no keyword the scorer cannot see', () => {
    for (const entry of KNOWLEDGE) {
      for (const keyword of entry.keywords) {
        expect(keyword).toBe(keyword.toLowerCase())
        expect(keyword).toBe(normalize(keyword))
        const hit = scoreAll(keyword).find((m) => m.entry.id === entry.id)
        expect(hit?.score ?? 0, `"${keyword}" in ${entry.id}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('the areas a tutor can name', () => {
  // Someone who types "anything in Bole?" must reach the area answer. The
  // sub-city list lives in options.ts; this is what keeps the two in step when
  // an area is added there.
  it('recognises every area the wizard offers', () => {
    const area = entryById('area')!
    for (const name of DEFAULT_AREAS) {
      const keyword = normalize(name)
      expect(area.keywords, `${name} is not a keyword of the area answer`).toContain(keyword)
      expect(bestAnswer(`do you have anything in ${name}`)?.id).toBe('area')
    }
  })
})

describe('normalize', () => {
  it('strips punctuation, case and spacing', () => {
    expect(normalize('  How MUCH do I get PAID??  ')).toBe('how much do i get paid')
  })

  it('gives the same key to the same question typed twice', () => {
    expect(normalize('When do I hear back?')).toBe(normalize('when do i hear back'))
  })
})

describe('retrieve', () => {
  const cases: [string, string][] = [
    ['how much will i be paid?', 'pay'],
    ['what is the pre payment?', 'pre-payment'],
    ['when do i hear back', 'hear-back'],
    ['is anyone reading this or are you a bot', 'no-reply-human'],
    ['can you increase the rate to 6000', 'negotiate'],
    ['do i need a cv', 'cv'],
    ['how do i change my phone number', 'profile-change'],
    ['please delete my data', 'delete-data'],
    ['is this a scam', 'legit'],
    ['can i take two jobs at the same time', 'multiple-jobs'],
    ['can i teach two families at once', 'multiple-jobs'],
    ['why do i have to pay you before i start', 'pre-payment'],
    ['do you have anything in bole', 'area'],
    ['is transport covered by you', 'transport'],
    ['do you pay for transport', 'transport'],
    ['who pays the taxi fare', 'transport'],
    ['what if i want to stop in the middle', 'leaving'],
    ['so what if i stopped after i started tutoring', 'leaving'],
    ['i want to quit the job', 'leaving'],
    ['please delete my data', 'delete-data'],
    ['stop messaging me', 'delete-data'],
  ]

  for (const [question, expected] of cases) {
    it(`answers "${question}" from ${expected}`, () => {
      expect(bestAnswer(question)?.id).toBe(expected)
    })
  }

  it('finds nothing for a question the bot has no facts about', () => {
    expect(retrieve('what is the capital of france')).toEqual([])
    expect(bestAnswer('teach me calculus please')).toBeNull()
  })

  it('finds nothing in a greeting', () => {
    expect(retrieve('hello sir')).toEqual([])
  })

  // "times" once stemmed to "tim" and "fees" to "fe", so the keyword they were
  // meant to match went unreached. Any word whose -e belongs to the stem.
  it('keeps the e that belongs to the word', () => {
    expect(bestAnswer('what are your fees')?.id).toBe('commission')
    expect(bestAnswer('who decides the lesson times')?.id).toBe('lesson-times')
    expect(bestAnswer('what are the rates')?.id).toBe(bestAnswer('what is the rate')?.id)
  })

  it('matches the singular and the plural alike', () => {
    expect(bestAnswer('how many hours')?.id).toBe(bestAnswer('how many hour')?.id)
  })

  it('scores a whole phrase above an incidental word', () => {
    // "how" alone belongs to how-it-works; "how much" is about pay.
    expect(bestAnswer('how much')?.id).toBe('pay')
  })

  it('returns at most the limit, best first', () => {
    const found = retrieve('how much am i paid and what is your fee', 3)
    expect(found.length).toBeLessThanOrEqual(3)
    expect(found[0].score).toBeGreaterThanOrEqual(found[found.length - 1].score)
  })
})

describe('the no-model answer', () => {
  it('sends the best fact word for word', () => {
    const entry = entryById('pay')!
    const fact = { id: entry.id, topic: entry.topic, answer: entry.answer }
    const answer = answerQuestionTemplate({
      text: 'how much do i get paid',
      facts: [fact],
      fallback: fact,
    })
    expect(answer.text).toBe(entry.answer)
    expect(answer.covered).toBe(true)
    expect(answer.generatedBy).toBe('template')
  })

  it('admits it is not covered when nothing matched', () => {
    const answer = answerQuestionTemplate({ text: 'anything', facts: [], fallback: null })
    expect(answer.covered).toBe(false)
    expect(answer.text).toBe('')
  })

  // The wide pass hands a model every fact so it can judge a paraphrase, but
  // there is no matched fact behind it. Falling back to facts[0] there would
  // answer a question nobody asked.
  it('does not answer from the wide pass when there is no fallback', () => {
    const answer = answerQuestionTemplate({
      text: 'what is the weather',
      facts: KNOWLEDGE.map((e) => ({ id: e.id, topic: e.topic, answer: e.answer })),
      fallback: null,
    })
    expect(answer.covered).toBe(false)
    expect(answer.text).toBe('')
  })
})

describe('guards on what a model is allowed to say', () => {
  it('passes an ordinary answer', () => {
    expect(rejectAnswer('The figure in your offer is yours to keep.')).toBeNull()
  })

  it('refuses an empty or overlong answer', () => {
    expect(rejectAnswer('   ')).toBe('empty')
    expect(rejectAnswer('a'.repeat(701))).toBe('too-long')
  })

  it('refuses Amharic, because tutors get English', () => {
    expect(rejectAnswer('ይህ መልእክት በራስ-ሰር የሚላክ ነው።')).toBe('not-english')
  })

  it('refuses an invented link or handle', () => {
    expect(rejectAnswer('See https://misale.example for details.')).toBe('contains-link')
    expect(rejectAnswer('Message @misale_support about it.')).toBe('contains-link')
  })

  // The rule that matters: no reply may suggest a person is on the other end.
  it('refuses anything that promises a human', () => {
    const promises = [
      'We will call you tomorrow about the rate.',
      'Someone from our team will get back to you.',
      'Please contact us to discuss it.',
      'I will reply once I have checked with the office.',
      'You can talk to a human about that.',
      'We will let you know soon.',
    ]
    for (const text of promises) {
      expect(rejectAnswer(text)).toBe('promises-a-human')
    }
  })

  // The mirror image, and the one that actually bit: asked "please call me",
  // the model says "I cannot call you" — obeying the rule in the exact words
  // the rule is written in. Rejecting that threw away its best answers and
  // sent the blunt fact instead.
  it('allows a denial that uses the same words as a promise', () => {
    const denials = [
      'I cannot call you as no person reads this chat.',
      'No person reads this chat, and I cannot call you.',
      'We will not call you about the rate.',
      'You cannot contact us here; everything is a button.',
      'Nobody will get back to you, because nobody reads this.',
      "I can't reply to messages here.",
    ]
    for (const text of denials) {
      expect(rejectAnswer(text), text).toBeNull()
    }
  })

  // A denial in one sentence must not license a promise in the next.
  it('still refuses a promise that follows a denial', () => {
    expect(rejectAnswer('Nobody reads this chat. We will call you tomorrow.')).toBe('promises-a-human')
  })

  // Every knowledge answer is a valid model answer, so the guards must not
  // reject the very text they fall back to.
  it('lets every knowledge answer through', () => {
    for (const entry of KNOWLEDGE) {
      expect(rejectAnswer(entry.answer)).toBeNull()
    }
  })
})

/**
 * The cache holds an answer for thirty days. Correcting a fact has to take
 * effect immediately, or the bot goes on asserting something that is no longer
 * true — it spent a month telling tutors to tap a button that had been removed.
 */
describe('the knowledge fingerprint', () => {
  const one = KNOWLEDGE.slice(0, 2)

  it('is the same for the same facts', () => {
    expect(knowledgeFingerprint(one)).toBe(knowledgeFingerprint(one))
  })

  it('does not depend on the order they arrive in', () => {
    expect(knowledgeFingerprint([...one].reverse())).toBe(knowledgeFingerprint(one))
  })

  it('changes the moment an answer is reworded', () => {
    const edited = [{ ...one[0], answer: `${one[0].answer} And one more thing.` }, one[1]]
    expect(knowledgeFingerprint(edited)).not.toBe(knowledgeFingerprint(one))
  })

  it('changes when a fact is added or taken away', () => {
    expect(knowledgeFingerprint(one.slice(0, 1))).not.toBe(knowledgeFingerprint(one))
    expect(knowledgeFingerprint([...one, KNOWLEDGE[2]])).not.toBe(knowledgeFingerprint(one))
  })

  /** Keywords and topics steer retrieval, not what gets asserted. */
  it('ignores changes that do not change what is said', () => {
    const retagged = [{ ...one[0], keywords: [...one[0].keywords, 'brand new phrase'] }, one[1]]
    expect(knowledgeFingerprint(retagged)).toBe(knowledgeFingerprint(one))
  })

  it('is short enough to live in a cache key', () => {
    expect(knowledgeFingerprint(KNOWLEDGE).length).toBeLessThanOrEqual(8)
  })
})
