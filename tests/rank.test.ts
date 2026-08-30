import { describe, expect, it } from 'vitest'
import { compareRanked, DEFAULT_WEIGHTS, genderExcluded, rank, type RankableCandidate, type RankableJob } from '@/lib/scoring/rank'

const job: RankableJob = {
  subject: 'Mathematics',
  grade: 'Grade 9',
  area: 'Bole',
  daysPerWeek: 3,
  genderPref: 'any',
}

const ideal: RankableCandidate = {
  subjects: ['Mathematics', 'Physics'],
  grades: ['9-10'],
  area: 'Bole',
  availability: { mon: ['evening'], wed: ['evening'], fri: ['evening'] },
  experience: 'over_5',
  education: 'masters',
  rating: 5,
  gender: 'female',
}

describe('rank', () => {
  it('gives a perfect candidate 100', () => {
    expect(rank(job, ideal).score).toBe(100)
  })

  it('gives a candidate who matches nothing 0', () => {
    const useless: RankableCandidate = {
      subjects: ['History'], grades: ['1-4'], area: 'Akaky Kaliti',
      availability: {}, experience: 'none', education: undefined, rating: 0,
    }
    expect(rank(job, useless).score).toBe(0)
  })

  it('is explainable — every component says why', () => {
    const { breakdown } = rank(job, ideal)
    const labels = breakdown.map((c) => c.label)
    expect(labels).toContain('Teaches Mathematics')
    expect(labels).toContain('Teaches 9-10')
    expect(labels).toContain('In Bole')
    expect(breakdown.find((c) => c.key === 'subject')!.points).toBe(DEFAULT_WEIGHTS.subject)
  })

  it('never punishes a new tutor for having no rating', () => {
    const unrated = { ...ideal, rating: null }
    // Dropped from both sides of the fraction, not scored zero.
    expect(rank(job, unrated).score).toBe(100)
    expect(rank(job, unrated).breakdown.find((c) => c.key === 'rating')).toBeUndefined()
  })

  it('scores a zero rating differently from no rating', () => {
    expect(rank(job, { ...ideal, rating: 0 }).score).toBeLessThan(
      rank(job, { ...ideal, rating: null }).score,
    )
  })

  it('drops a component the job cannot answer either', () => {
    const noGrade = { ...job, grade: 'all levels' }
    expect(rank(noGrade, ideal).score).toBe(100)
    expect(rank(noGrade, ideal).breakdown.find((c) => c.key === 'grade')).toBeUndefined()
  })

  it('rewards partial availability proportionally', () => {
    const twoDays = { ...ideal, availability: { mon: ['evening'], wed: ['evening'] } }
    const points = rank(job, twoDays).breakdown.find((c) => c.key === 'availability')!.points
    expect(points).toBe(Math.round((2 / 3) * DEFAULT_WEIGHTS.availability))
  })

  it('does not reward more days than the job needs', () => {
    const everyDay = {
      ...ideal,
      availability: Object.fromEntries(
        ['mon','tue','wed','thu','fri','sat','sun'].map((d) => [d, ['evening']]),
      ),
    }
    expect(rank(job, everyDay).score).toBe(100)
  })

  // Families hire by grade and most tutors teach everything, so both sides of
  // the match can say "all subjects".
  describe('all subjects', () => {
    const generalist = { ...ideal, subjects: ['All subjects'] }
    const everySubject = {
      ...ideal,
      subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English',
                 'Amharic', 'Geography', 'History', 'Economics', 'ICT'],
    }
    const allSubjectsJob = { ...job, subject: 'All subjects' }

    it('lets a generalist match a job asking for one subject', () => {
      expect(rank(job, generalist).score).toBe(100)
    })

    it('counts ticking every subject as the same claim', () => {
      expect(rank(job, everySubject).score).toBe(100)
      expect(rank(allSubjectsJob, everySubject).score).toBe(100)
    })

    it('matches a generalist to a job wanting every subject', () => {
      expect(rank(allSubjectsJob, generalist).score).toBe(100)
    })

    // The half that is easy to get backwards: a maths tutor cannot cover a
    // post that asks for every subject.
    it('does not let a specialist cover a job wanting every subject', () => {
      const specialist = { ...ideal, subjects: ['Mathematics'] }
      const result = rank(allSubjectsJob, specialist)
      expect(result.score).toBeLessThan(100)
      expect(result.breakdown.find((c) => c.key === 'subject')!.points).toBe(0)
    })
  })

  it('matches subjects case-insensitively', () => {
    expect(rank(job, { ...ideal, subjects: ['mathematics'] }).score).toBe(100)
  })

  it('excludes on gender preference rather than scoring it', () => {
    const femaleOnly = { ...job, genderPref: 'female' as const }
    const male = { ...ideal, gender: 'male' }
    const result = rank(femaleOnly, male)
    expect(result.excluded).toBe(true)
    expect(result.score).toBe(0)
    expect(result.excludedReason).toContain('female')
  })

  it('does not exclude when the job has no preference', () => {
    expect(rank(job, { ...ideal, gender: 'male' }).excluded).toBe(false)
  })

  it('respects reweighting without a deploy', () => {
    const areaOnly = { ...DEFAULT_WEIGHTS, subject: 0, grade: 0, availability: 0, experience: 0, education: 0, rating: 0 }
    const wrongSubject = { ...ideal, subjects: ['History'] }
    expect(rank(job, wrongSubject, areaOnly).score).toBe(100)
  })

  it('is deterministic', () => {
    expect(rank(job, ideal)).toEqual(rank(job, ideal))
  })
})

describe('ordering', () => {
  it('puts the better match first and excluded candidates last', () => {
    const people = [
      { name: 'wrong grade', c: { ...ideal, grades: ['1-4'] } },
      { name: 'perfect', c: ideal },
      { name: 'wrong subject', c: { ...ideal, subjects: ['History'] } },
    ].map((p) => ({ ...p, rank: rank(job, p.c) }))

    const order = [...people].sort(compareRanked).map((p) => p.name)
    expect(order[0]).toBe('perfect')
    // Grade outweighs subject, so missing the grade is the worse miss.
    expect(order[2]).toBe('wrong grade')
  })

  it('costs more to miss the grade than the subject', () => {
    const wrongGrade = rank(job, { ...ideal, grades: ['1-4'] }).score
    const wrongSubject = rank(job, { ...ideal, subjects: ['History'] }).score
    expect(wrongGrade).toBeLessThan(wrongSubject)
  })

  it('breaks a tie on grade, then area, then subject', () => {
    const a = { rank: rank(job, { ...ideal, education: 'degree', rating: null }) }
    const b = { rank: rank(job, { ...ideal, subjects: ['History'], area: 'Bole' }) }
    expect(compareRanked(a, b)).toBeLessThan(0)
  })
})

describe('genderExcluded — the filter the boards must respect', () => {
  it('bars a candidate the job explicitly did not ask for', () => {
    expect(genderExcluded('female', 'male')).toBe('Job asks for a female tutor')
    expect(genderExcluded('male', 'female')).toBe('Job asks for a male tutor')
  })

  it('lets everyone through when the job has no preference', () => {
    expect(genderExcluded('any', 'male')).toBeNull()
    expect(genderExcluded(null, 'male')).toBeNull()
    expect(genderExcluded(undefined, 'female')).toBeNull()
  })

  it('does not bar a candidate whose gender is unknown', () => {
    expect(genderExcluded('female', null)).toBeNull()
    expect(genderExcluded('female', undefined)).toBeNull()
  })

  it('agrees with rank(), which is the whole point of sharing it', () => {
    const job: RankableJob = { subject: 'Maths', grade: 'Grade 9', area: 'Bole', daysPerWeek: 3, genderPref: 'female' }
    const candidate: RankableCandidate = { subjects: ['Maths'], grades: ['Grade 9'], area: 'Bole', availability: null, experience: 'over_5', education: 'degree', rating: null, gender: 'male' }
    const result = rank(job, candidate)
    expect(result.excluded).toBe(true)
    expect(result.excludedReason).toBe(genderExcluded('female', 'male'))
  })
})
