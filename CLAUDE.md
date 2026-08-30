# Working on this project

## Non-negotiable design rule

The operator never holds a conversation. No free-text branch may require a human to interpret it.
If a step can't be answered with buttons, redesign the step. Never add a "talk to a human" button,
a negotiation queue, or anything that routes a message to him expecting a reply.

**The bot answering a typed question is not an exception to this.** The rule is about *a human
being made to read and reply*, not about free text existing. A tutor can type a question and the
bot answers it from `lib/bot/answers/knowledge.ts` — nothing is queued, forwarded or escalated,
and no reply may suggest a person is on the other end. `rejectAnswer()` in `lib/ai/provider.ts`
enforces that on the model's own words at runtime, because a prompt is a request and a check is a
guarantee. Every step of the wizard stays buttons: the ranker needs enums, not prose.

## Cost rule

This runs on free tiers. Only 3 of 12 build steps may call an AI model, plus one thing that is not
a step — answering a tutor's typed question — and every one of them must work without a model.
All model calls go through `lib/ai/provider.ts` — never call a model SDK from anywhere else.
Default provider is a no-model template; Gemini Flash free tier is the first real one.

The answerer is the only model call on a path a stranger can trigger, so it is fenced in
`lib/bot/answers/service.ts`: nothing matched means no call at all, the same question is served
from the cache for 30 days, and one person gets 12 questions an hour before dropping to the
matched fact verbatim. Every one of those fallbacks is a real answer, not an error.

## What must never be wrong

`lib/scoring/rank.ts` and everything in `lib/money/` are pure functions — data in, data out, no
I/O. They are unit tested. Money math is asserted to the cent. Do not put database or Telegram
calls inside them.

## Conventions

- TypeScript, Next.js App Router, Supabase, grammY.
- Bot conversation state lives in Postgres (`bot_sessions`), never in memory — the webhook is
  stateless and may run on any instance.
- **Language depends on who is reading.** Two audiences, two rules:
  - **Tutors and the bot — English only.** Job posts, every bot message, every button. No language
    picker, no `lang` column; `tests/copy.test.ts` fails the build if Ethiopic script appears in
    `lib/bot/copy.ts`, and `tests/answers.test.ts` does the same for the knowledge base. A model
    answer that comes back in Amharic is rejected and the fact is sent instead.
  - **Families — Amharic only.** Every message the operator sends a parent lives in
    `lib/messaging/parent.ts`, written natively rather than translated out of English.
    `tests/parent-messages.test.ts` fails the build if English creeps in.
- An Amharic SMS fits **70 characters** per segment against English's 160, so a parent message
  costs roughly 3× to send. Keep them to two segments; `lib/messaging/sms.ts` counts it, and the
  dashboard shows the count beside every message before it is sent.

## Build order

Follow `docs/02-build-plan.md` in order. Each step has a "done when" test. Do not start a step
before the previous one passes its test.
