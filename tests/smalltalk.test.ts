import { describe, expect, it } from 'vitest'
import { readSmallTalk } from '@/lib/bot/smalltalk'
import { copy, pick } from '@/lib/bot/copy'
import { KNOWLEDGE } from '@/lib/bot/answers/knowledge'

describe('reading small talk', () => {
  it('tells a greeting from a thank you', () => {
    for (const t of ['hi', 'Hello 👋', 'hey there', 'Good morning sir', 'Selam', 'hi again brother']) {
      expect(readSmallTalk(t), t).toBe('greeting')
    }
    for (const t of ['thanks', 'Thank you', 'thank you so much', 'tnx bro', 'Ok thank you', 'God bless you']) {
      expect(readSmallTalk(t), t).toBe('thanks')
    }
  })

  it('tells an acknowledgement from a goodbye', () => {
    for (const t of ['ok', 'Okay', 'got it', 'alright', 'noted', 'yes sure']) {
      expect(readSmallTalk(t), t).toBe('affirm')
    }
    for (const t of ['bye', 'Goodbye', 'good night', 'see you', 'take care', 'talk later']) {
      expect(readSmallTalk(t), t).toBe('farewell')
    }
  })

  it('hears an apology, a delay and a compliment', () => {
    for (const t of ['sorry', 'I am sorry', 'sorry my bad', 'apologies']) {
      expect(readSmallTalk(t), t).toBe('apology')
    }
    for (const t of ['i will get back to you', 'not now', 'let me think', 'I am busy this week', 'maybe next week']) {
      expect(readSmallTalk(t), t).toBe('later')
    }
    for (const t of ['nice work', 'well done', 'this is very helpful', 'i like this', 'you are great']) {
      expect(readSmallTalk(t), t).toBe('praise')
    }
  })

  it('hears somebody giving their background', () => {
    for (const t of [
      'I am a maths teacher',
      'i have 4 years experience',
      'I taught physics at a private school',
      'my background is in chemistry',
      "I've been teaching since 2019",
    ]) {
      expect(readSmallTalk(t), t).toBe('introduces-themselves')
    }
  })

  // Half of these are shaped like questions, which is exactly why they are
  // matched before the question guard: sending them to the knowledge base is
  // what annoyed the person in the first place.
  it('hears somebody who has had enough', () => {
    for (const t of [
      'you don\'t understand',
      'that is not what I asked',
      'this is useless',
      'you keep sending the same message',
      "what's wrong with you",
      'not helpful',
    ]) {
      expect(readSmallTalk(t), t).toBe('frustrated')
    }
  })

  it('answers after its own health rather than sending it to the knowledge base', () => {
    for (const t of ['how are you', 'how are you?', 'how is it going', "what's up"]) {
      expect(readSmallTalk(t), t).toBe('how-are-you')
    }
  })
})

describe('what small talk must never steal', () => {
  // The whole risk of this layer. A courtesy with a question stuck to it is a
  // question, and "no need to apologise" is the worst possible reply to it.
  it('leaves a question alone even when it opens with a courtesy', () => {
    for (const t of [
      'sorry, how much is the pay?',
      'hi, is this job still open',
      'thanks, but when do I hear back?',
      'I am a maths teacher, can I apply?',
      'ok so what happens after I am hired',
      'good morning, do I need a CV?',
    ]) {
      expect(readSmallTalk(t), t).toBeNull()
    }
  })

  // A regression guard with teeth: nothing the bot has an actual answer for
  // may be diverted into a pleasantry.
  it('never claims a question the knowledge base covers', () => {
    for (const entry of KNOWLEDGE) {
      expect(readSmallTalk(entry.topic), entry.topic).toBeNull()
      for (const keyword of entry.keywords) {
        expect(readSmallTalk(keyword), `${entry.id}: ${keyword}`).toBeNull()
      }
    }
  })

  it('leaves anything it does not recognise to the answerer', () => {
    for (const t of ['grade 9 in bole', 'my number is 0911223344', 'chemistry', '']) {
      expect(readSmallTalk(t), t).toBeNull()
    }
  })
})

describe('picking a wording', () => {
  it('never gives the same wording twice running', () => {
    const lines = copy.smalltalk.thanks
    for (let id = 100; id < 140; id++) {
      expect(pick(lines, id)).not.toBe(pick(lines, id + 1))
    }
  })

  it('is deterministic, so the same message always reads the same', () => {
    expect(pick(copy.smalltalk.affirm, 7)).toBe(pick(copy.smalltalk.affirm, 7))
  })

  it('stays inside the list for any id', () => {
    for (const id of [0, 1, -3, 999999, 2 ** 31]) {
      expect(copy.notSure).toContain(pick(copy.notSure, id))
    }
  })
})

describe('the small talk copy itself', () => {
  const lists: readonly (readonly string[])[] = [
    copy.smalltalk.greeting.stranger,
    copy.smalltalk.greeting.known,
    copy.smalltalk.greeting.teaching,
    copy.smalltalk.howAreYou,
    copy.smalltalk.thanks,
    copy.smalltalk.affirm,
    copy.smalltalk.apology,
    copy.smalltalk.later,
    copy.smalltalk.farewell,
    copy.smalltalk.praise,
    copy.smalltalk.introduces,
    copy.smalltalk.frustrated,
    copy.notSure,
    copy.answers.uncovered,
    copy.answers.courtesy,
  ]

  it('has something to vary between', () => {
    for (const list of lists) expect(list.length).toBeGreaterThan(1)
  })

  it('repeats no wording within a list', () => {
    for (const list of lists) expect(new Set(list).size).toBe(list.length)
  })

  // The design rule, checked on the words rather than trusted to the author.
  // Warmth is the point of this file, and warmth is where "let me put you
  // through to someone" gets written by accident.
  it('never suggests a person is on the other end', () => {
    const forbidden =
      /\b(?:talk|speak|put you through|pass you|forward|escalate|connect you) (?:to|with)? ?(?:a |an |the )?(?:human|person|colleague|agent|manager|team|someone|somebody)\b|\bsomeone will\b|\bwe will (?:call|reply|get back|be in touch)\b|\bour team\b/i
    for (const list of lists) {
      for (const line of list) expect(line, line).not.toMatch(forbidden)
    }
  })

  it('is English only', () => {
    for (const list of lists) {
      for (const line of list) expect(line).not.toMatch(/[ሀ-፿]/)
    }
  })
})
