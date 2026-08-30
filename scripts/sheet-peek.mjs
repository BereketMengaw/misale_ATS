/** Tab names, headers and a row count for a spreadsheet. Read-only. */
import { accessToken } from './sheet-auth.mjs'

const ids = process.argv.slice(2)
const token = await accessToken()
const get = async (u) => {
  const r = await fetch(u, { headers: { authorization: `Bearer ${token}` } })
  const b = await r.json()
  if (!r.ok) throw new Error(b.error?.message ?? String(r.status))
  return b
}

for (const id of ids) {
  const meta = await get(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties(title),sheets(properties(title))`)
  console.log(`\n=== ${meta.properties.title} ===`)
  for (const s of meta.sheets ?? []) {
    const tab = s.properties.title
    const enc = encodeURIComponent(`${tab}!A1:Z3`)
    let rows = []
    try {
      const v = await get(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${enc}`)
      rows = v.values ?? []
    } catch { /* an empty or odd tab is not a failure */ }
    const header = (rows[0] ?? []).map((c) => String(c).trim()).filter(Boolean)
    console.log(`  [${tab}] ${header.length} cols: ${header.join(' | ') || '(empty)'}`)
    if (rows[1]) console.log(`      e.g. ${rows[1].slice(0, 8).join(' | ')}`)
  }
}
