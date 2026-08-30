import { describe, expect, it } from 'vitest'
import {
  areaFrom,
  educationFrom,
  experienceFrom,
  gradesFrom,
  mergeCv,
  nameFrom,
  phoneFrom,
  readCvFacts,
  sameName,
  saysNothing,
  subjectsFrom,
  CV_FIELDS,
  type CvProfile,
} from '@/lib/candidates/cv'

describe('normalising what a CV says', () => {
  it('reads a qualification however it is written', () => {
    expect(educationFrom('BSc in Applied Physics')).toBe('degree')
    expect(educationFrom('B.A. in English Literature')).toBe('degree')
    expect(educationFrom('Bachelor of Education')).toBe('degree')
    expect(educationFrom('MSc Mathematics')).toBe('masters')
    expect(educationFrom('PhD candidate')).toBe('phd')
    expect(educationFrom('Diploma in Accounting')).toBe('diploma')
    expect(educationFrom('3rd year student, AAU')).toBe('student')
  })

  it('takes the highest qualification when a CV names two', () => {
    expect(educationFrom('BSc Physics, now studying for an MSc')).toBe('masters')
  })

  it('accepts the enum the wizard stores, so a re-read is stable', () => {
    expect(educationFrom('masters')).toBe('masters')
  })

  it('drops "other", which is a stored answer but never a reading', () => {
    // As a button it means "I told you and it was none of these". Coming back
    // from a CV it means the reader could not tell, and writing that into an
    // empty field would replace "not known" with "known to be nothing".
    expect(educationFrom('other')).toBeNull()
  })

  it('claims nothing from a qualification it does not recognise', () => {
    expect(educationFrom('Certificate of Attendance')).toBeNull()
    expect(educationFrom('')).toBeNull()
    expect(educationFrom(null)).toBeNull()
  })

  it('bands years of teaching', () => {
    expect(experienceFrom(0)).toBe('none')
    expect(experienceFrom(0.5)).toBe('under_1')
    expect(experienceFrom(1)).toBe('1_2')
    expect(experienceFrom(2)).toBe('1_2')
    expect(experienceFrom(3)).toBe('3_5')
    expect(experienceFrom(5)).toBe('3_5')
    expect(experienceFrom(6)).toBe('over_5')
  })

  it('refuses a number of years that cannot be a career', () => {
    expect(experienceFrom(-1)).toBeNull()
    expect(experienceFrom(90)).toBeNull()
    expect(experienceFrom('three' as unknown)).toBeNull()
    expect(experienceFrom(Number.NaN)).toBeNull()
  })

  it('maps subject spellings onto the words the ranker compares', () => {
    expect(subjectsFrom(['Maths', 'physics', 'Computer Science'])).toEqual([
      'Mathematics',
      'Physics',
      'ICT',
    ])
  })

  it('drops a subject no job can ask for', () => {
    // The ranker matches on the wizard's vocabulary. A profile carrying
    // "Sociology" is not a profile that ranks for Sociology; it is one that
    // claims something nothing will ever compare against.
    expect(subjectsFrom(['Mathematics', 'Sociology'])).toEqual(['Mathematics'])
  })

  it('cannot be walked up the prototype chain', () => {
    expect(subjectsFrom(['constructor', 'toString', '__proto__'])).toEqual([])
  })

  it('does not repeat a subject a CV lists twice', () => {
    expect(subjectsFrom(['Math', 'Mathematics', 'maths'])).toEqual(['Mathematics'])
  })

  it('covers every band a stated grade range touches', () => {
    // Somebody who teaches 7 to 12 does teach grade 5-8s. Under-claiming here
    // costs them jobs they can do.
    expect(gradesFrom(['grades 7-12'])).toEqual(['5-8', '9-10', '11-12'])
    expect(gradesFrom(['grade 9'])).toEqual(['9-10'])
    expect(gradesFrom(['university students'])).toEqual(['university'])
  })

  it('returns grade bands in the wizards order however they arrive', () => {
    expect(gradesFrom(['11-12', '1-4'])).toEqual(['1-4', '11-12'])
  })

  it('picks the sub-city out of an address', () => {
    expect(areaFrom('Bole, Addis Ababa')).toBe('Bole')
    expect(areaFrom('Yeka sub-city, woreda 08')).toBe('Yeka')
    expect(areaFrom('Lemi Kura')).toBe('Lemi Kura')
  })

  it('does not read Addis Ababa as Addis Ketema', () => {
    expect(areaFrom('Addis Ababa, Ethiopia')).toBeNull()
    expect(areaFrom('Addis Ketema, Addis Ababa')).toBe('Addis Ketema')
  })

  it('claims no area for an address outside the list', () => {
    expect(areaFrom('Bahir Dar')).toBeNull()
  })

  it('takes a phone number only when it is a real Ethiopian mobile', () => {
    expect(phoneFrom('0911 234 567')).toBe('+251911234567')
    expect(phoneFrom('+251911234567')).toBe('+251911234567')
    expect(phoneFrom('011 551 2345')).toBeNull()
    expect(phoneFrom('see page 2')).toBeNull()
  })

  it('refuses a heading pretending to be a name', () => {
    expect(nameFrom('Abebe Kebede Tadesse')).toBe('Abebe Kebede Tadesse')
    expect(nameFrom('CURRICULUM VITAE 2024')).toBeNull()
    expect(nameFrom('A dedicated and hardworking mathematics teacher')).toBeNull()
  })
})

describe('reading a whole CV', () => {
  it('turns a model reply into values the profile can hold', () => {
    expect(
      readCvFacts({
        fullName: 'Abebe Kebede',
        phone: '0911234567',
        education: 'BSc in Mathematics',
        institution: 'Addis Ababa University',
        area: 'Bole, Addis Ababa',
        experienceYears: 4,
        subjects: ['Maths', 'Physics'],
        grades: ['grades 9-12'],
      }),
    ).toEqual({
      fullName: 'Abebe Kebede',
      phone: '+251911234567',
      education: 'degree',
      institution: 'Addis Ababa University',
      area: 'Bole',
      experience: '3_5',
      subjects: ['Mathematics', 'Physics'],
      grades: ['9-10', '11-12'],
    })
  })

  it('survives a reply that is all nulls and junk', () => {
    const facts = readCvFacts({
      fullName: null,
      phone: 'n/a',
      education: 'Grade 10 complete',
      institution: null,
      area: null,
      experienceYears: null,
      subjects: null,
      grades: null,
    })
    expect(facts.fullName).toBeNull()
    expect(facts.phone).toBeNull()
    expect(facts.subjects).toEqual([])
    expect(facts.grades).toEqual([])
  })
})

describe('deciding whether two names are the same person', () => {
  it('allows a middle name on one side only', () => {
    expect(sameName('Abebe Kebede', 'Abebe Kebede Tadesse')).toBe(true)
    expect(sameName('abebe  kebede', 'Abebe Kebede')).toBe(true)
  })

  it('flags a different surname', () => {
    expect(sameName('Abebe Kebede', 'Selam Girma')).toBe(false)
  })
})

const answered: CvProfile = {
  fullName: 'Abebe Kebede',
  phone: '+251911234567',
  area: 'Bole',
  education: 'degree',
  subjects: ['Mathematics'],
  grades: ['9-10'],
  experience: '3_5',
}

describe('merging a CV into a profile', () => {
  it('fills only the fields the tutor left empty', () => {
    const reading = mergeCv(
      { fullName: 'Abebe Kebede', subjects: ['Mathematics'] },
      { education: 'degree', institution: 'AAU', area: 'Bole', subjects: ['Mathematics'] },
    )
    expect(reading.fills).toEqual([
      { field: 'education', value: 'degree' },
      { field: 'institution', value: 'AAU' },
      { field: 'area', value: 'Bole' },
    ])
    expect(reading.conflicts).toEqual([])
  })

  it('never writes over an answer the tutor gave, and flags the disagreement', () => {
    // The buttons are the tutor's own statement. A CV is evidence about them,
    // and evidence does not get to overwrite testimony.
    const reading = mergeCv(answered, { education: 'masters', area: 'Yeka' })
    expect(reading.fills).toEqual([])
    expect(reading.conflicts).toEqual([
      { field: 'education', profile: 'degree', cv: 'masters' },
      { field: 'area', profile: 'Bole', cv: 'Yeka' },
    ])
  })

  it('records the fields the CV backs up', () => {
    const reading = mergeCv(answered, {
      education: 'degree',
      area: 'Bole',
      subjects: ['Mathematics'],
    })
    expect(reading.confirmed).toEqual(['education', 'area', 'subjects'])
    expect(reading.conflicts).toEqual([])
    expect(reading.fills).toEqual([])
  })

  it('treats a subject the CV adds as something to look at, not a conflict', () => {
    // A CV is not an exhaustive list of what somebody can teach, so a subject
    // missing from it contradicts nothing — and one it adds must not be written
    // silently, because that changes which jobs they rank for.
    const reading = mergeCv(answered, { subjects: ['Mathematics', 'Physics'] })
    expect(reading.conflicts).toEqual([])
    expect(reading.fills).toEqual([])
    expect(reading.additions).toEqual([{ field: 'subjects', values: ['Physics'] }])
  })

  it('does not call a subject the CV omits a disagreement', () => {
    const reading = mergeCv({ ...answered, subjects: ['Mathematics', 'Physics'] }, {
      subjects: ['Mathematics'],
    })
    expect(reading.conflicts).toEqual([])
    expect(reading.additions).toEqual([])
    expect(reading.confirmed).toContain('subjects')
  })

  it('does not flag a middle name the wizard never asked for', () => {
    const reading = mergeCv(answered, { fullName: 'Abebe Kebede Tadesse' })
    expect(reading.conflicts).toEqual([])
    expect(reading.confirmed).toEqual(['fullName'])
  })

  it('flags a CV that belongs to somebody else', () => {
    const reading = mergeCv(answered, { fullName: 'Selam Girma' })
    expect(reading.conflicts).toEqual([
      { field: 'fullName', profile: 'Abebe Kebede', cv: 'Selam Girma' },
    ])
  })

  it('says nothing when the CV had nothing in it', () => {
    expect(saysNothing(mergeCv(answered, {}))).toBe(true)
    expect(saysNothing(mergeCv(answered, { education: 'degree' }))).toBe(false)
  })

  it('never touches availability, rate or gender', () => {
    // A CV does not say when somebody is free, the rate on one is what they
    // were last paid rather than what they would accept, and inferring gender
    // from a document is guessing at a person from their name.
    const reading = mergeCv({}, readCvFacts({ subjects: ['Mathematics'] }))
    const touched = [...reading.fills, ...reading.conflicts].map((f) => f.field)
    expect(touched).not.toContain('availability')
    expect(touched).not.toContain('expectedRate')
    expect(touched).not.toContain('gender')
  })
})

describe('what the CV reader asks a model for', () => {
  it('requires every field, so the easy ones are not answered alone', async () => {
    // This is a guard on a silent failure, not a style rule. Left optional, a
    // flash-lite model read the name and phone number off the top of the page
    // and omitted the degree, the address and the dates — and an omitted field
    // arrives as null, indistinguishable from one the CV does not contain.
    const { CV_SCHEMA } = await import('@/lib/ai/providers/gemini')
    expect([...CV_SCHEMA.required].sort()).toEqual(Object.keys(CV_SCHEMA.properties).sort())
  })

  it('asks for every field the merge knows how to use', async () => {
    const { CV_SCHEMA } = await import('@/lib/ai/providers/gemini')
    const asked = new Set(Object.keys(CV_SCHEMA.properties))
    // `experienceYears` is asked for as a number and banded here, so the field
    // names differ by exactly that one.
    for (const field of CV_FIELDS) {
      expect(asked.has(field === 'experience' ? 'experienceYears' : field)).toBe(true)
    }
  })
})
