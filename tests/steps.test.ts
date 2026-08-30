import { describe, expect, it } from 'vitest'
import {
  EDIT_LABEL, EDITABLE_STEPS, isEditable, nextStep, ownsStep, prevStep, progress,
  REGISTER_STEPS, stepNumber, STEP_FIELD, STEP_LABEL, TOTAL_STEPS,
} from '@/lib/bot/flows/steps'

describe('wizard steps', () => {
  it('walks from the first step to the last without a gap', () => {
    const walked: string[] = []
    let step: (typeof REGISTER_STEPS)[number] | null = 'consent'
    while (step) {
      walked.push(step)
      step = nextStep(step)
    }
    expect(walked).toEqual([...REGISTER_STEPS])
  })

  it('ends after the last step', () => {
    expect(nextStep(REGISTER_STEPS[REGISTER_STEPS.length - 1])).toBeNull()
  })

  it('asks for consent before anything is collected', () => {
    expect(REGISTER_STEPS[0]).toBe('consent')
  })

  it('asks for the phone through share-contact before the optional fields', () => {
    expect(REGISTER_STEPS.indexOf('phone')).toBeLessThan(REGISTER_STEPS.indexOf('cv'))
  })

  it('counts from 1, and the last step is the total', () => {
    expect(stepNumber('consent')).toBe(1)
    expect(stepNumber(REGISTER_STEPS[TOTAL_STEPS - 1])).toBe(TOTAL_STEPS)
    expect(progress('consent')).toBe(`Step 1 of ${TOTAL_STEPS}`)
  })
})

describe('a tap has to belong to the step it lands on', () => {
  it('matches each step to the field its buttons send', () => {
    expect(ownsStep('gender', 'gender')).toBe(true)
    expect(ownsStep('subjects', 'subject')).toBe(true)
    expect(ownsStep('grades', 'grade')).toBe(true)
    expect(ownsStep('days', 'day')).toBe(true)
    expect(ownsStep('times', 'time')).toBe(true)
  })

  it('rejects a tap left over from an earlier step', () => {
    // The bug: on step "subjects", an old "Female" button wrote gender and
    // advanced past subjects, losing the answer that was on screen.
    expect(ownsStep('subjects', 'gender')).toBe(false)
    expect(ownsStep('rate', 'education')).toBe(false)
    expect(ownsStep('cv', 'area')).toBe(false)
  })

  it('walks backwards as well as forwards, and stops at both ends', () => {
    expect(prevStep('consent')).toBeNull()
    expect(prevStep('name')).toBe('consent')
    expect(prevStep('cv')).toBe('rate')
    expect(nextStep('cv')).toBe('documents')
    // The last step is the one that finishes the registration.
    expect(nextStep('documents')).toBeNull()
    for (const step of REGISTER_STEPS.slice(1)) {
      expect(nextStep(prevStep(step)!)).toBe(step)
    }
  })

  it('has a label and a field for every step, with no gaps', () => {
    for (const step of REGISTER_STEPS) {
      expect(STEP_LABEL[step]).toBeTruthy()
      expect(STEP_FIELD[step]).toBeTruthy()
    }
  })
})

// The count is said out loud in two places — "Step 4 of 14" on every screen,
// and the knowledge answer about how long registering takes. A step added
// without the second one moving makes the bot wrong about itself.
describe('the number of steps, as the bot states it', () => {
  it('matches what the answer about registering says', async () => {
    const { KNOWLEDGE } = await import('@/lib/bot/answers/knowledge')
    const words = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen']
    const said = KNOWLEDGE.find((e) => e.id === 'registration-time')!.answer
    expect(said).toContain(words[TOTAL_STEPS - 10])
  })
})

/**
 * Editing reuses the wizard's own questions, so the two lists have to stay in
 * step. A field added to registration and forgotten here is a field nobody can
 * ever correct.
 */
describe('what can be changed afterwards', () => {
  it('offers every step except consent', () => {
    expect(EDITABLE_STEPS).toEqual(REGISTER_STEPS.filter((s) => s !== 'consent'))
    expect(EDITABLE_STEPS).not.toContain('consent')
  })

  it('has a button label for every one of them', () => {
    for (const step of EDITABLE_STEPS) {
      expect(EDIT_LABEL[step], step).toBeTruthy()
    }
    expect(Object.keys(EDIT_LABEL).sort()).toEqual([...EDITABLE_STEPS].sort())
  })

  it('accepts only a real step', () => {
    for (const step of EDITABLE_STEPS) expect(isEditable(step)).toBe(true)
    for (const junk of ['consent', 'payout', '', 'name; drop table']) {
      expect(isEditable(junk), junk).toBe(false)
    }
  })
})
