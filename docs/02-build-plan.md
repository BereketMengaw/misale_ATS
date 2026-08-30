# Build plan

Twelve steps. Each is roughly one working session, ends in something usable, and has a test that
must pass before the next one starts. Four steps (marked **STOP**) leave the system genuinely
useful on its own.

| # | Step | Done when |
|---|---|---|
| 1 | **Foundations** — Next.js + Supabase, first migration, bot webhook, admin login | You message the bot and it replies; you can log into `/dashboard` |
| 2 | **Job post writing** — fields → template → preview → approve | You answer a few questions and get a post you'd actually send |
| 3 | **Publishing** — channels, Apply deep link, copy-pack for channels you don't own | A post lands in the test channel with a working Apply button |
| | **STOP** | You can already post jobs properly, in seconds |
| 4 | **Registration wizard** — deterministic steps, share-contact, availability grid, CV upload | Someone applies from another phone and appears in `/candidates` |
| 5 | **CV handling** — file shown beside the profile; optional parsing → merge, conflicts flagged | Every CV is readable next to its profile; if parsing is on, 5 real CVs match |
| 6 | **Ranking** — pure scorer, weights in settings, applicant board | 20 seeded candidates rank in the order you'd pick by hand |
| 7 | **Selection & closing** — commission accept/decline, Top 3, "+5 more", hire, introductions, FILLED | A mock job goes post → hire without typing a message |
| | **STOP** | The whole hiring side runs without you. The big one. |
| 8 | **Talent-pool DMs** — match new posts to saved profiles, one-tap apply | An old candidate gets a relevant DM and applies from it |
| 9 | **Placement & timesheet** — schedule, reminders, tutor confirms hours | A week of lessons runs with reminders and confirmed hours |
| | **STOP** | You know what was taught, when, and by whom, without asking anyone |
| 10 | **Invoices** — generate from confirmed hours, reference code, send queue, overdue chase | An invoice with its reference code reaches the parent on time |
| 11 | **SMS matching** — gateway webhook, provider parsers, Unmatched inbox | A real forwarded SMS marks the right invoice paid by itself |
| 12 | **Payouts** — gross − commission = net, payouts due, reconciliation | One placement runs end to end with every figure correct |
| | **STOP** | The money side closes the loop. The agency runs end to end. |

## Which steps involve AI

Three of the twelve, and all three work without it:

- **Step 2** — post wording. Starts as a template with no model at all.
- **Step 5** — CV parsing. Deferrable; the wizard already collects the structured data by buttons,
  so the CV starts as evidence a human reads.
- **Step 11** — fallback only, for an SMS format the regex parsers don't recognise. Without a
  model it goes to the Unmatched inbox instead.

Plus one thing that is not a step: **answering a tutor's typed question**. It sits outside the
build order because it does not gate anything — the bot works without it, as it always did, by
sending people back to the buttons.

Everything the bot may assert lives in `lib/bot/answers/knowledge.ts`. Keyword retrieval
(`retrieve.ts`, pure and tested) picks the facts; the model only rephrases them for the question
that was asked, and `rejectAnswer()` checks what comes back before it is sent. With no model the
matched fact goes out verbatim, which is why this degrades to something usable rather than to an
error. What nobody asked about yet shows up as uncovered rows in `bot_answers` — that is the list
of entries still to write.

Everything else — the wizard, ranking, the pipeline, timesheets, invoices, payment matching,
payouts — is ordinary code.

## A thing that is deliberately not here

Tutors were once offered a choice of two commissioning systems. Only one
survives, and the other is recorded in `docs/08-retired-commission-option.md`
so that an old conversation mentioning "the second option" does not read as a
missing feature.
