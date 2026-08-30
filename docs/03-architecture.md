# Architecture

One Next.js app plus Supabase. One repo, one deploy. The bot webhook is an API route. Postgres
carries the relational chain that is the hard half of this product: placements → lessons →
invoices → payouts.

| Layer | Choice |
|---|---|
| Web + API + bot webhook | Next.js (App Router), TypeScript, on Vercel |
| Database / auth / CV storage | Supabase (Postgres, Auth, Storage) |
| Telegram | grammY, webhook at `/api/telegram/webhook` |
| Scheduled work | Vercel Cron → `/api/cron/*` |
| AI | Behind `lib/ai/provider.ts`; template (no model) by default, Gemini Flash free tier first real provider |
| UI | Tailwind + shadcn/ui, English |

Bot conversation state lives in Postgres (`bot_sessions`), never in memory, so the stateless
serverless webhook is safe.

## Repo shape

```
app/(dash)/…                dashboard, jobs, candidates, clients, placements, money, settings
app/api/telegram/webhook/route.ts
app/api/webhooks/sms/route.ts
app/api/gateway/{pending,sent}/route.ts    the Android app's endpoints
app/api/cron/{reminders,invoices,overdue}/route.ts
lib/bot/                    grammY bot, flows/, keyboards, session store
lib/ai/provider.ts          the ONLY place a model is called — writePost, parseCV, parseSMS
lib/ai/providers/           template.ts (no model), gemini.ts, ollama.ts, claude.ts
lib/scoring/rank.ts         pure, unit tested
lib/money/                  invoice.ts, match-payment.ts, payout.ts — pure, unit tested
lib/notify/                 notify(), channel selection, the send queue
supabase/migrations/
tests/
```

`lib/scoring/rank.ts` and `lib/money/*` hold the logic that must not be wrong. They take data and
return data, with no I/O, so they are fully testable without Telegram or a database.

## Data model

**Demand** — `clients` (parents), `students`, `job_requests`, `job_posts` (subject, grade, area,
days/week, rate, commission %, status).

**Distribution** — `channels`, `post_publications` (job × channel, `message_id`, apply count).

**Supply** — `candidates` (telegram_id, name, phone, gender, area, education, institution,
subjects[], grades[], availability jsonb, experience, expected rate, cv_file, cv_text, cv_parsed
jsonb, completeness, rating, status).

**Matching** — `applications` (job × candidate; status `applied → screened → ranked → shortlisted
→ commission_agreed → presented → hired | rejected | pooled`; `score`, `score_breakdown` jsonb),
`presentation_batches` (the 3, then the 5), `talent_matches`.

**Delivery** — `placements` (job × candidate × client, rate, schedule jsonb, commission %),
`sessions` (date, planned vs confirmed hours, confirmed_by).

**Money** — `invoices` (client, period, amount, due date, unique reference code, status),
`payments` (raw SMS, parsed jsonb, amount, payer, txn ref, provider, matched invoice, matched_by),
`payouts` (gross − commission = net, status, txn ref).

**Plumbing** — `bot_sessions`, `message_log`, `conversations` (one summary row per person,
maintained from `message_log` by a trigger, so the Inbox can order and page in Postgres),
`outbox` (the send queue), `notification_queue`,
`settings` (commission defaults, ranking weights, contact-release rule, message templates).

## Ranking

`rank(job, candidate) → { score, breakdown }`, a pure function. Weighted components: subject match,
grade match, area, availability overlap with the job's required days, experience years, education
level, past placement rating. Weights live in `settings` and are tunable without a deploy.

**No model is involved.** The board shows the score with its breakdown — "subject +30, area +20,
availability +15, 2 yrs experience +10" — which is more useful than a generated sentence. Unit
tested against seeded candidates so changing a weight cannot silently reorder everything.
