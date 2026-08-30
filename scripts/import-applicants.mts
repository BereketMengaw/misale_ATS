/**
 * Bring the Google Form's applicants into `candidates`.
 *
 *   npm run import:applicants          show what would happen, change nothing
 *   npm run import:applicants -- --write   actually write
 *
 * Safe to run twice: rows are keyed on phone number, so a second run updates
 * the same people rather than making new ones. It will never overwrite anyone
 * who has since registered on the bot — their own answers beat a two-year-old
 * form, and their telegram_id is how they are reachable.
 */
import { accessToken } from './sheet-auth.mjs'
import { supabaseAdmin } from '../lib/supabase/admin'
import { completeness } from '../lib/candidates/completeness'
import {
  readArea, readAvailability, readEducation, readGrades, readName, readPhone,
} from '../lib/import/applicants'

const SHEET = '1dYXb8EEzG3Zt29vdr-oPPhyHA8eEz07vwxb23IR6zcI'
const TAB = 'Form Responses 1'
const SOURCE = 'google-form:applicant-data'
const write = process.argv.includes('--write')

const token = await accessToken()
const res = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/${encodeURIComponent(`${TAB}!A:L`)}`,
  { headers: { authorization: `Bearer ${token}` } },
)
const values: string[][] = (await res.json()).values ?? []
const rows = values.slice(1)

type Mapped = {
  phone: string
  full_name: string | null
  area: string | null
  education: string | null
  grades: string[]
  availability: Record<string, string[]>
  completeness: number
  timestamp: string
}

const mapped = new Map<string, Mapped>()
const dropped = { noPhone: 0, badPhone: 0, noName: 0 }

for (const r of rows) {
  const [timestamp = '', name = '', phoneRaw = '', education = '', subCity = '', residence = '', , grades = '', , days = ''] = r

  if (!phoneRaw.trim()) { dropped.noPhone++; continue }
  // A number that cannot be dialled is not a contact. Better a smaller import
  // than a list of people nobody can reach, counted as if they were reachable.
  const phone = readPhone(phoneRaw)
  if (!phone) { dropped.badPhone++; continue }

  const full_name = readName(name)
  if (!full_name) { dropped.noName++; continue }

  const row: Mapped = {
    phone,
    full_name,
    area: readArea(subCity, residence),
    education: readEducation(education),
    grades: readGrades(grades),
    availability: readAvailability(days),
    completeness: 0,
    timestamp,
  }
  row.completeness = completeness({
    fullName: row.full_name, phone: row.phone, area: row.area, education: row.education,
    grades: row.grades, availability: row.availability,
    subjects: [], experience: null, expectedRate: null, cvPath: null,
  })

  // Same person, twice. The later form wins: it is what they say now.
  const seen = mapped.get(row.phone)
  if (!seen || new Date(row.timestamp) >= new Date(seen.timestamp)) mapped.set(row.phone, row)
}

const list = [...mapped.values()]
const pct = (n: number) => `${Math.round((n / list.length) * 100)}%`

console.log(`\nform rows            : ${rows.length}`)
console.log(`dropped              : ${dropped.noPhone} no phone · ${dropped.badPhone} unusable phone · ${dropped.noName} no name`)
console.log(`people to import     : ${list.length}   (duplicates merged: ${rows.length - dropped.noPhone - dropped.badPhone - dropped.noName - list.length})`)
console.log(`  with an area       : ${list.filter((r) => r.area).length} (${pct(list.filter((r) => r.area).length)})`)
console.log(`  with education     : ${list.filter((r) => r.education).length} (${pct(list.filter((r) => r.education).length)})`)
console.log(`  with grades        : ${list.filter((r) => r.grades.length).length} (${pct(list.filter((r) => r.grades.length).length)})`)
console.log(`  with availability  : ${list.filter((r) => Object.keys(r.availability).length).length} (${pct(list.filter((r) => Object.keys(r.availability).length).length)})`)

const avg = Math.round(list.reduce((t, r) => t + r.completeness, 0) / list.length)
console.log(`  average completeness: ${avg}%`)

console.log('\nfirst five, as they would be stored:')
for (const r of list.slice(0, 5)) {
  console.log(`  ${r.full_name} · ${r.phone} · ${r.area ?? '(no area)'} · ${r.education ?? '(no education)'}`
    + ` · grades ${r.grades.join('/') || '-'} · days ${Object.keys(r.availability).join(',') || '-'} · ${r.completeness}%`)
}

if (!write) {
  console.log('\nDRY RUN — nothing written. Re-run with --write to import.\n')
  process.exit(0)
}

const db = supabaseAdmin()
let inserted = 0
let updated = 0
let skippedRegistered = 0
let failed = 0

for (const r of list) {
  const { data: existing } = await db
    .from('candidates')
    .select('id, telegram_id, imported_from')
    .eq('phone', r.phone)
    .maybeSingle()

  // Somebody who registered on the bot has answered all of this themselves,
  // more recently and with more of it. The form must not overwrite them.
  if (existing && existing.telegram_id && !existing.imported_from) {
    skippedRegistered++
    continue
  }

  const payload = {
    full_name: r.full_name,
    phone: r.phone,
    area: r.area,
    education: r.education,
    grades: r.grades,
    availability: r.availability,
    subjects: [],
    completeness: r.completeness,
    status: r.completeness > 0 ? 'active' : 'incomplete',
    imported_from: SOURCE,
    imported_at: new Date().toISOString(),
  }

  const { error } = existing
    ? await db.from('candidates').update(payload).eq('id', existing.id)
    : await db.from('candidates').insert(payload)

  if (error) { console.error(`  ${r.phone}: ${error.message}`); failed++ }
  else if (existing) updated++
  else inserted++
}

console.log(`\ninserted ${inserted} · updated ${updated} · left alone ${skippedRegistered} (already registered) · failed ${failed}\n`)
