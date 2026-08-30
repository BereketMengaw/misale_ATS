import { describe, expect, it } from 'vitest'
import { isCourtesy, isWorthReading, mine, picksFromAList, wantsToApply } from '@/lib/mining/questions'
import { detectIntent } from '@/lib/bot/answers/intent'

describe('what counts as a question worth reading', () => {
  it('keeps a real question', () => {
    expect(isWorthReading('what if i want to stop teaching')).toBe(true)
  })

  it('drops greetings, commands and bare numbers', () => {
    for (const junk of ['hi', 'ok', '/start', '/start job_2_1', '0911234567', '  ']) {
      expect(isWorthReading(junk), junk).toBe(false)
    }
  })
})

// Measured against a real export: courtesies and "I want to apply" were most
// of everything anyone sent, and they buried every genuine question.
describe('setting aside what is not a question', () => {
  it('drops courtesies however they stack', () => {
    for (const t of ['Okay Thank you', 'Ok Thanks 🙏', 'Eshi Thank you🙏', 'ok', 'Yes I can',
                     'Good morning', 'selam nw', 'Of course', "It's okay", 'Hi there']) {
      expect(isCourtesy(t), t).toBe(true)
    }
  })

  it('keeps a real question that opens politely', () => {
    for (const t of ['Is this still available', 'So what is next', 'What grade is it']) {
      expect(isCourtesy(t), t).toBe(false)
    }
  })

  it('recognises someone saying they want the job', () => {
    for (const t of ['i want to apply', 'I want to apply for this job', 'I wanna apply',
                     "I'm interested", 'Can i apply', 'Applying for this', 'I need this job']) {
      expect(wantsToApply(t), t).toBe(true)
    }
  })

  it('recognises someone picking from a list', () => {
    for (const t of ['The first one', 'the 2nd one.', 'This one', 'I agree with the first one',
                     'I agree with the first commissioning system.']) {
      expect(picksFromAList(t), t).toBe(true)
    }
  })

  it('counts each of those separately rather than as a missing answer', () => {
    const report = mine([
      { text: 'i want to apply for this job', from: 'abel' },
      { text: 'The first one', from: 'hanna' },
      { text: 'Okay thank you', from: 'sara' },
      { text: 'do you sponsor a work visa', from: 'dawit' },
    ])
    expect(report.wantsToApply).toBe(1)
    expect(report.picksFromAList).toBe(1)
    expect(report.courtesies).toBe(1)
    expect(report.uncovered).toHaveLength(1)
  })
})

describe('mining real conversations', () => {
  const asked = (text: string, from: string) => ({ text, from })

  it('counts people, not repetitions', () => {
    const report = mine([
      asked('what if i want to stop teaching', 'abel'),
      asked('what if i want to stop teaching', 'abel'),
      asked('what if i want to stop teaching', 'hanna'),
    ])
    const q = [...report.uncovered, ...report.weak, ...report.covered][0]
    expect(q.people).toBe(2)
    expect(q.count).toBe(3)
  })

  // The bucket that matters. A weak match is not a miss — it is an answer to
  // the wrong question, delivered confidently, which is how a tutor came to be
  // told their CV would be deleted when they asked about leaving a placement.
  it('separates a weak match from a confident one', () => {
    const report = mine([
      asked('do you deduct anything from my salary', 'abel'),
      asked('how much will i be paid for this job', 'hanna'),
    ])
    expect(report.weak.map((q) => q.topEntry)).toContain('commission')
    expect(report.covered.map((q) => q.topEntry)).toContain('pay')
  })

  // The question that produced that bug, now that it has an answer of its own.
  it('finds the entry that was written because of this report', () => {
    const report = mine([asked('what if i want to stop teaching in the middle', 'abel')])
    expect(report.covered.map((q) => q.topEntry)).toContain('leaving')
  })

  it('reports a question nothing matches as one to write', () => {
    const report = mine([asked('do you sponsor a work visa for me', 'abel')])
    expect(report.uncovered).toHaveLength(1)
    expect(report.uncovered[0].topEntry).toBeNull()
  })

  it('ranks by how many people asked', () => {
    const report = mine([
      asked('do you sponsor a work visa for me', 'abel'),
      asked('is there a canteen at the house', 'hanna'),
      asked('is there a canteen at the house', 'sara'),
    ])
    expect(report.uncovered[0].text).toContain('canteen')
  })
})

describe('what the bot does before it tries to answer', () => {
  it('routes the commonest message of all to the open jobs', () => {
    for (const t of ['i want to apply', 'I want to apply for this job', "I'm interested",
                     'Can i apply', 'Applying for this', 'I need this job']) {
      expect(detectIntent(t), t).toBe('apply')
    }
  })

  it('routes "is it still open" to the live list', () => {
    for (const t of ['Is it still available', 'Is this still open', 'Is it closed?',
                     'Anything new?', 'any new jobs']) {
      expect(detectIntent(t), t).toBe('job-status')
    }
  })

  it('knows a reply to a list it cannot see', () => {
    for (const t of ['The first one', 'the 2nd one.', 'I agree with the first one']) {
      expect(detectIntent(t), t).toBe('picks-from-a-list')
    }
  })

  it('answers a courtesy as a courtesy', () => {
    for (const t of ['Okay Thank you', 'Ok Thanks 🙏', 'Good morning']) {
      expect(detectIntent(t), t).toBe('courtesy')
    }
  })

  // Applying wins: someone doing both is applying, not asking.
  it('prefers the intention to act over the question wrapped around it', () => {
    expect(detectIntent('is this still open? i want to apply')).toBe('apply')
  })

  // Built entirely from polite words, and still a question — and after an
  // answer, a follow-up to it. Treating it as a courtesy replied "Any time"
  // to somebody asking whether we meant what we just said.
  it('does not mistake a question for a courtesy', () => {
    for (const t of ['Are you sure', 'are you sure?', 'Is it ok?', 'Can you?', 'Really?']) {
      expect(isCourtesy(t), t).toBe(false)
      expect(detectIntent(t), t).not.toBe('courtesy')
    }
  })

  it('leaves a real question to the answerer', () => {
    for (const t of ['how much will i be paid', 'what is the pre payment',
                     'do i need a cv', 'why do you need my phone number']) {
      expect(detectIntent(t), t).toBeNull()
    }
  })
})
