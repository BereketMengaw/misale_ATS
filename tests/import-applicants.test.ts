import { describe, expect, it } from 'vitest'
import {
  IMPORTED_SLOTS, readArea, readAvailability, readEducation, readGrades, readName, readPhone,
} from '@/lib/import/applicants'
import { EDUCATION, GRADE_BANDS, SLOTS } from '@/lib/candidates/options'

/**
 * Every string below is a real answer from the form, not one invented for the
 * test. 771 people wrote these over two years and nobody was validating them.
 */
describe('reading the education answer', () => {
  it('reads the ways people write a first degree', () => {
    for (const said of [
      'degree', 'bachelor degree', 'bsc', 'BSc degree', "bachelor's degree",
      'BA degree', 'bachelor', 'graduated', 'Degree ',
    ]) {
      expect(readEducation(said), said).toBe('degree')
    }
  })

  /** Both of these contain a degree word and describe somebody still studying. */
  it('does not promote a student to a graduate', () => {
    for (const said of ['university student', 'undergraduate student', 'batchelor student', 'student']) {
      expect(readEducation(said), said).toBe('student')
    }
  })

  it('reads a postgraduate', () => {
    for (const said of ['masters', 'msc', 'MSc', 'MA', 'mba']) {
      expect(readEducation(said), said).toBe('masters')
    }
    expect(readEducation('PhD')).toBe('phd')
  })

  it('reads a diploma', () => {
    for (const said of ['diploma', 'TVET level 4', 'certificate']) {
      expect(readEducation(said), said).toBe('diploma')
    }
  })

  it('reads a year of study as still studying', () => {
    for (const said of ['freshman', '2nd year', '3rd year medical school', 'freahman university']) {
      expect(readEducation(said), said).toBe('student')
    }
  })

  it('forgives the ways people misspell degree', () => {
    for (const said of ['dgree', 'degre', 'bcs', 'medical doctor']) {
      expect(readEducation(said), said).toBe('degree')
    }
  })

  /** What they know is not how far they got. */
  it('does not read a field of study as a level', () => {
    for (const said of ['computer science', 'civil engineering', 'chemical engineering']) {
      expect(readEducation(said), said).toBe('other')
    }
  })

  it('is nothing at all for a blank, rather than "other"', () => {
    expect(readEducation('')).toBeNull()
    expect(readEducation('   ')).toBeNull()
  })

  it('only ever returns a value the database will accept', () => {
    const allowed = new Set(EDUCATION.map((e) => e.value))
    for (const said of ['degree', 'msc', 'diploma', 'student', 'phd', 'something odd', '']) {
      const got = readEducation(said)
      if (got) expect(allowed.has(got), `${said} -> ${got}`).toBe(true)
    }
  })
})

describe('reading the grades answer', () => {
  it('maps the form ranges onto our bands', () => {
    expect(readGrades('Grade 1 - Grade 4')).toEqual(['1-4'])
    expect(readGrades('Grade 5 - Grade 8')).toEqual(['5-8'])
    expect(readGrades('Grade 12')).toEqual(['11-12'])
    expect(readGrades('grade 8')).toEqual(['5-8'])
  })

  /** The form's ranges are not ours: 9 to 11 spans both of the upper bands. */
  it('covers every band a range touches', () => {
    expect(readGrades('Grade 9 -  Grade 11')).toEqual(['9-10', '11-12'])
  })

  it('takes more than one selection', () => {
    expect(readGrades('Grade 1 - Grade 4, Grade 5 - Grade 8')).toEqual(['1-4', '5-8'])
  })

  /**
   * There is no KG band. Reading it as 1-4 would put a KG tutor in front of a
   * family looking for someone to teach grade 4.
   */
  it('gives nothing for a stage we do not have', () => {
    expect(readGrades('KG 1 - KG 3')).toEqual([])
    expect(readGrades('')).toEqual([])
  })

  it('only ever returns bands that exist', () => {
    const allowed = new Set(GRADE_BANDS.map((g) => g.value))
    for (const said of ['Grade 1 - Grade 4', 'Grade 9 -  Grade 11', 'Grade 12', 'KG 1 - KG 3']) {
      for (const band of readGrades(said)) expect(allowed.has(band), band).toBe(true)
    }
  })
})

describe('reading the days answer', () => {
  it('takes the days somebody actually chose', () => {
    const a = readAvailability('Monday, Wednesday, Friday')
    expect(Object.keys(a).sort()).toEqual(['fri', 'mon', 'wed'])
  })

  it('handles a whole week without duplicating anything', () => {
    const a = readAvailability('monday, tuesday, wednesday, thursday, friday, saturday, sunday')
    expect(Object.keys(a)).toHaveLength(7)
  })

  it('is empty when nothing was chosen', () => {
    expect(readAvailability('')).toEqual({})
    expect(readAvailability('whenever')).toEqual({})
  })

  /** The one assumption in the import, from the question's own wording. */
  it('uses after-school times, which the form asked about and never collected', () => {
    const allowed = new Set(SLOTS.map((s) => s.value))
    for (const slots of Object.values(readAvailability('Monday, Saturday'))) {
      expect(slots).toEqual([...IMPORTED_SLOTS].sort())
      for (const s of slots) expect(allowed.has(s)).toBe(true)
    }
  })
})

describe('reading the area answer', () => {
  it('settles the spellings of one sub-city', () => {
    expect(readArea('Kolfe Keraniyo', '')).toBe('Kolfe Keranio')
    expect(readArea('kolfe keranio', '')).toBe('Kolfe Keranio')
    expect(readArea('lemikura', '')).toBe('Lemi Kura')
    expect(readArea('AKAKI KALITY', '')).toBe('Akaky Kaliti')
  })

  it('finds the sub-city inside a longer answer', () => {
    expect(readArea('bole bulbula', '')).toBe('Bole')
    expect(readArea('', 'yeka abado')).toBe('Yeka')
  })

  /** 54 people answered the sub-city question with the name of the city. */
  it('refuses "Addis Ababa", which locates nobody', () => {
    expect(readArea('addis ababa', '')).toBeNull()
    expect(readArea('Addis Abeba', '')).toBeNull()
  })

  it('falls back to the neighbourhood when the sub-city is unusable', () => {
    expect(readArea('addis ababa', 'Bole')).toBe('Bole')
  })

  it('is nothing rather than a guess', () => {
    expect(readArea('', '')).toBeNull()
    expect(readArea('somewhere', 'else')).toBeNull()
  })
})

describe('reading the name', () => {
  it('tidies the case a phone keyboard produced', () => {
    expect(readName('bereket mengaw demle')).toBe('Bereket Mengaw Demle')
    expect(readName('  ABEBE   KEBEDE ')).toBe('Abebe Kebede')
  })

  it('is nothing when there is no name', () => {
    expect(readName('')).toBeNull()
    expect(readName('x')).toBeNull()
  })
})

/**
 * The phone box was free text and people used it as one. Twenty-nine answers
 * were being dropped, and most were somebody giving two numbers.
 */
describe('reading the phone answer', () => {
  it('takes the first of two numbers rather than neither', () => {
    expect(readPhone('0943594619/0912416814')).toBe('+251943594619')
    expect(readPhone('0953943398 / 0911093265')).toBe('+251953943398')
    expect(readPhone('0919801247  or 0703529299')).toBe('+251919801247')
    expect(readPhone('09 07 34 75 53/09 21 94 37 76')).toBe('+251907347553')
  })

  it('still reads a single ordinary number', () => {
    expect(readPhone('0947328262')).toBe('+251947328262')
    expect(readPhone('+251947328262')).toBe('+251947328262')
  })

  it('is nothing when no part of it is a number we can dial', () => {
    for (const junk of ['dd', 'Kindie', '', '094732', '0067658402']) {
      expect(readPhone(junk), junk).toBeNull()
    }
  })
})
