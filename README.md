# Misale ATS

A tutoring agency that runs itself. A Telegram bot writes and publishes job posts, registers and
ranks tutors, places them with parents, tracks lessons, bills parents and works out payouts. A web
dashboard is the only place a human touches it.

**Status:** planning complete, no code yet.

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

Client-facing summary: https://claude.ai/code/artifact/72322bd0-2798-42b1-99c0-c70427c0b03c
