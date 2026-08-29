# Working on this project

## Non-negotiable design rule

The operator never holds a conversation. No free-text branch may require a human to interpret it.
If a step can't be answered with buttons, redesign the step. Never add a "talk to a human" button,
a negotiation queue, or anything that routes a message to him expecting a reply.

## Cost rule

This runs on free tiers. Only 3 of 12 steps may call an AI model, and each must work without one.
All model calls go through `lib/ai/provider.ts` — never call a model SDK from anywhere else.
Default provider is a no-model template; Gemini Flash free tier is the first real one.

## What must never be wrong

`lib/scoring/rank.ts` and everything in `lib/money/` are pure functions — data in, data out, no
I/O. They are unit tested. Money math is asserted to the cent. Do not put database or Telegram
calls inside them.

## Conventions

- TypeScript, Next.js App Router, Supabase, grammY.
- Bot conversation state lives in Postgres (`bot_sessions`), never in memory — the webhook is
  stateless and may run on any instance.
- User-facing copy is **English only**. Job posts, bot messages, buttons and SMS. Do not add a
  second language, a language picker, or a `lang` column; `tests/copy.test.ts` fails the build if
  Ethiopic script appears in bot copy.
- SMS bodies stay under 160 characters, which is one segment.

## Build order

Follow `docs/02-build-plan.md` in order. Each step has a "done when" test. Do not start a step
before the previous one passes its test.
