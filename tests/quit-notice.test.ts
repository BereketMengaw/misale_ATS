import { describe, expect, it } from 'vitest'
import { isLive, noticeTarget, placementLabel, type PlacementRow } from '@/lib/notices/target'
import { copy } from '@/lib/bot/copy'
import { isLeavingNotice } from '@/lib/bot/answers/intent'

const placement = (over: Partial<PlacementRow> & { id: number }): PlacementRow => ({
  status: 'active', subject: 'Mathematics', grade: 'Grade 9', area: 'Bole', ...over,
})

describe('which placement a notice belongs to', () => {
  it('files against the only live one', () => {
    const target = noticeTarget([placement({ id: 7 })])
    expect(target).toEqual({ kind: 'one', placement: placement({ id: 7 }) })
  })

  // The bug this module exists for. The old query took the most recent
  // placement of any status, so a tutor who finished a job in March and is
  // stopping their current one filed against the finished one.
  it('never files against a placement that has already ended', () => {
    const target = noticeTarget([
      placement({ id: 9, status: 'ended', subject: 'Physics' }),
      placement({ id: 4, status: 'active', subject: 'Chemistry' }),
    ])
    expect(target.kind).toBe('one')
    expect(target.kind === 'one' && target.placement.id).toBe(4)
  })

  it('counts a scheduled or paused placement as still leavable', () => {
    for (const status of ['scheduled', 'active', 'paused']) {
      expect(isLive(status), status).toBe(true)
    }
    expect(isLive('ended')).toBe(false)
    expect(isLive(null)).toBe(false)
  })

  // The other half of the bug. The knowledge base tells tutors they may hold
  // more than one job, and the old query then picked whichever was hired last.
  // That puts the wrong family on the operator's desk, and the right family
  // finds out when the tutor stops turning up.
  it('refuses to guess between two live placements', () => {
    const target = noticeTarget([
      placement({ id: 1, subject: 'Mathematics' }),
      placement({ id: 2, subject: 'Physics' }),
    ])
    expect(target.kind).toBe('which')
    expect(target.kind === 'which' && target.placements.map((p) => p.id)).toEqual([1, 2])
  })

  it('has nothing to file when nothing is live', () => {
    expect(noticeTarget([])).toEqual({ kind: 'none' })
    expect(noticeTarget([placement({ id: 3, status: 'ended' })])).toEqual({ kind: 'none' })
  })
})

describe('naming a placement to the person teaching it', () => {
  it('uses the job they were hired for, not a row id', () => {
    expect(placementLabel(placement({ id: 1 }))).toBe('Mathematics · Grade 9 · Bole')
  })

  it('drops the parts that are missing rather than printing gaps', () => {
    expect(placementLabel(placement({ id: 1, grade: null, area: '' }))).toBe('Mathematics')
  })

  it('falls back to something rather than an empty button', () => {
    expect(placementLabel(placement({ id: 12, subject: null, grade: null, area: null })))
      .toBe('Placement #12')
  })
})

describe('what the bot says back', () => {
  // The reply that started this. The bot filed the notice, said nothing about
  // it, and recited "tell us as early as you can before you stop" at somebody
  // who had just told us.
  it('confirms the notice instead of asking for it', () => {
    const said = copy.leaving.filed('Mathematics · Grade 9 · Bole')
    expect(said).toContain('Mathematics · Grade 9 · Bole')
    expect(said).toMatch(/recorded/i)
    expect(said).not.toMatch(/tell us|let us know|as early as you can/i)
  })

  it('names the job in every line that has one', () => {
    expect(copy.leaving.already('Physics · Grade 11 · CMC')).toContain('Physics · Grade 11 · CMC')
  })

  it('asks which one rather than picking', () => {
    expect(copy.leaving.which).toMatch(/which/i)
  })

  it('never promises that a person will follow up', () => {
    const forbidden = /we will (?:call|reply|get back|be in touch)|someone will|our team|contact us/i
    const lines = [
      copy.leaving.filed('X'), copy.leaving.already('X'), copy.leaving.which, copy.leaving.gone,
    ]
    for (const line of lines) expect(line, line).not.toMatch(forbidden)
  })
})

describe('what still counts as giving notice', () => {
  // The message that started this, and the shapes around it.
  it('hears somebody stopping one of several jobs', () => {
    for (const t of [
      'i want to stop working on one tutoring',
      'I want to stop teaching',
      'I have to quit',
      'i cannot continue',
    ]) {
      expect(isLeavingNotice(t), t).toBe(true)
    }
  })

  it('still leaves a hypothetical alone', () => {
    for (const t of ['what if i want to stop', 'can i stop in the middle', 'what happens if i quit']) {
      expect(isLeavingNotice(t), t).toBe(false)
    }
  })
})
