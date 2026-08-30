/**
 * Applies any migration in supabase/migrations that has not run yet, oldest
 * first, each in its own transaction.
 *
 *   npm run migrate          apply everything outstanding
 *   npm run migrate -- --dry list what would run, and stop
 *
 * Needs DATABASE_URL: Supabase dashboard → Project Settings → Database →
 * Connection string → URI. It is the only credential that can run DDL; the
 * SUPABASE_SECRET_KEY goes through PostgREST, which cannot.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error(
    [
      'Missing DATABASE_URL.',
      '',
      'Supabase dashboard → Project Settings → Database → Connection string → URI,',
      'then put it in .env.local (it is gitignored):',
      "  ! echo 'DATABASE_URL=postgresql://postgres:...@db....supabase.co:5432/postgres' >> .env.local",
    ].join('\n'),
  )
  process.exit(1)
}

const dry = process.argv.includes('--dry')
const dir = join(process.cwd(), 'supabase/migrations')
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

// The ledger of what has run. Created here rather than in a migration, since
// a migration cannot record itself before the table exists.
await client.query(`
  create table if not exists schema_migrations (
    filename    text primary key,
    applied_at  timestamptz not null default now()
  )
`)

const { rows } = await client.query<{ filename: string }>('select filename from schema_migrations')
const applied = new Set(rows.map((r) => r.filename))
const pending = files.filter((f) => !applied.has(f))

// Everything that predates this runner is already in the database — the first
// run must not replay 0001 over a live schema.
if (applied.size === 0 && pending.length > 1) {
  const last = pending[pending.length - 1]
  console.log(`No ledger yet. Marking everything before ${last} as already applied.`)
  if (!dry) {
    for (const f of pending.slice(0, -1)) {
      await client.query('insert into schema_migrations (filename) values ($1)', [f])
    }
  }
  pending.splice(0, pending.length - 1)
}

if (pending.length === 0) {
  console.log(`Nothing to do — all ${files.length} migrations are applied.`)
  await client.end()
  process.exit(0)
}

console.log(`${pending.length} to apply:\n${pending.map((f) => `  ${f}`).join('\n')}`)
if (dry) {
  await client.end()
  process.exit(0)
}

for (const file of pending) {
  const sql = readFileSync(join(dir, file), 'utf8')
  process.stdout.write(`\n${file} … `)
  try {
    await client.query('begin')
    await client.query(sql)
    await client.query('insert into schema_migrations (filename) values ($1)', [file])
    await client.query('commit')
    console.log('applied')
  } catch (err) {
    await client.query('rollback')
    console.log('FAILED — rolled back, nothing after it was run')
    console.error(err instanceof Error ? err.message : err)
    await client.end()
    process.exit(1)
  }
}

await client.end()
console.log('\nDone.')
