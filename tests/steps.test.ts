import { describe, expect, it } from 'vitest'
import { nextStep, progress, REGISTER_STEPS, stepNumber, TOTAL_STEPS } from '@/lib/bot/flows/steps'

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
