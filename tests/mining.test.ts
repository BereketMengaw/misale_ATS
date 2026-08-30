import { describe, expect, it } from 'vitest'
import { isWorthReading, mine } from '@/lib/mining/questions'

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
      asked('what if i want to stop teaching in the middle', 'abel'),
      asked('how much will i be paid for this job', 'hanna'),
    ])
    expect(report.weak.map((q) => q.topEntry)).toContain('delete-data')
    expect(report.covered.map((q) => q.topEntry)).toContain('pay')
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
