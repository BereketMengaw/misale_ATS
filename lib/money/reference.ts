/**
 * The payment reference code. PURE.
 *
 * This is the single string that makes a payment match itself: the parent types
 * it into the payment reason, and step 11 reads it back out of a bank SMS. It
 * is therefore designed to survive being written by hand, read off a screen and
 * retyped on a phone keypad.
 *
 * The alphabet excludes 0/O, 1/I/L and the vowels, which removes both the
 * lookalike pairs and any chance of spelling a word by accident.
 */

const ALPHABET = '23456789BCDFGHJKMNPQRSTVWXYZ'
const PREFIX = 'MIS'
const LENGTH = 4

export function isValidReference(code: string): boolean {
  return /^MIS-[23456789BCDFGHJKMNPQRSTVWXYZ]{4}$/.test(code)
}

/**
 * Accepts what a person actually types: lowercase, no dash, extra spaces, the
 * prefix left off entirely, or the prefix's I typed as a 1 or an l.
 *
 * The body needs no lookalike mapping — the alphabet already excludes every
 * pair that could be confused. An earlier version mapped I to 1 across the
 * whole string, which silently broke the MIS prefix itself.
 */
export function normalizeReference(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const body = cleaned.replace(/^M[I1L]S/, '')

  return /^[23456789BCDFGHJKMNPQRSTVWXYZ]{4}$/.test(body) ? `${PREFIX}-${body}` : null
}

/** Every reference-shaped string in a block of text, e.g. a bank SMS. */
export function findReferences(text: string): string[] {
  const found = new Set<string>()
  for (const m of text.toUpperCase().matchAll(/MIS[\s-]?([23456789BCDFGHJKMNPQRSTVWXYZ]{4})/g)) {
    found.add(`${PREFIX}-${m[1]}`)
  }
  return [...found]
}

/** A fresh code. Uniqueness is the database's job; collisions are retried. */
export function generateReference(random: () => number = Math.random): string {
  let body = ''
  for (let i = 0; i < LENGTH; i++) {
    body += ALPHABET[Math.floor(random() * ALPHABET.length)]
  }
  return `${PREFIX}-${body}`
}

/** How many distinct codes exist — worth knowing before trusting 4 characters. */
export const REFERENCE_SPACE = ALPHABET.length ** LENGTH
