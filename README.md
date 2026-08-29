# Misale ATS

A tutoring agency that runs itself. A Telegram bot writes and publishes job posts, registers and
ranks tutors, places them with parents, tracks lessons, bills parents and works out payouts. A web
dashboard is the only place a human touches it.

**Status:** step 1 (foundations) built. Steps 2–12 remain — see [the build plan](docs/02-build-plan.md).

## The one rule that shapes everything

The operator runs this alone, hires nobody, and does not hold conversations — not with applicants,
not with parents. The system *is* the company, not an assistant to a person. Every flow is buttons.
There is no "talk to a human" escape hatch. His entire job is clicking in the dashboard.

Anything that would put him in a back-and-forth conversation is a bug.

## Docs

| | |
|---|---|
| [01 — Overview](docs/01-overview.md) | What it does, end to end |
| [02 — Build plan](docs/02-build-plan.md) | 12 steps, 4 stopping points |
| [03 — Architecture](docs/03-architecture.md) | Stack, repo shape, data model |
| [04 — Messaging & SMS](docs/04-messaging.md) | Telegram, the send queue, the Android gateway |
| [05 — Money](docs/05-money.md) | Invoices, payment matching, payouts |
| [06 — Decisions](docs/06-decisions.md) | Settled, and still open |
| [07 — Setup checklist](docs/07-setup-checklist.md) | What to prepare before step 1 |

## Running it locally

```bash
npm install
cp .env.example .env.local     # fill in Supabase + Telegram values
npm run dev
```

Then, once:

1. **Database** — run `supabase/migrations/0001_foundations.sql` against the Supabase project
   (SQL editor, or `supabase db push`).
2. **Operator** — create your user under Authentication → Users, then insert the allowlist row:
   `insert into operators (id, email) values ('<user-uuid>', '<your email>');`
   Signing in without this row gets you a dashboard that says so.
3. **Webhook** — expose the dev server (`npx untun` / ngrok / a Vercel preview), set
   `NEXT_PUBLIC_APP_URL` to that origin, then `npm run bot:set-webhook`.

`npm test` runs the unit tests; `npm run typecheck` and `npm run build` must both stay clean.

Client-facing summary: https://claude.ai/code/artifact/72322bd0-2798-42b1-99c0-c70427c0b03c
