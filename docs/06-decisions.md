# Decisions

## Settled

| Decision | Outcome | Why |
|---|---|---|
| Bot vs personal account | **Bot** | A userbot cannot send buttons, and would deliver every message into his own Telegram — the thing he is avoiding |
| Human in the loop | **None** | He runs it alone, hires nobody, and does not want conversations |
| Commission negotiation | **Accept / decline only** | A counter-offer queue is a conversation |
| Contact release | **Setting**, default `after_first_payment` | Protects the month of highest exposure to being cut out |
| AI model | **Template first**, then Gemini Flash free tier, all behind `provider.ts` | Costs nothing; reads CV photos and PDFs natively, so no OCR pipeline |
| Ranking | **Deterministic arithmetic** | Explainable, testable, free, and defensible to a candidate |
| SMS sending | **Written by system, sent by operator** | Reads as a person; one-way, so not a conversation |
| Gateway trigger | **User-initiated bulk send** | No unattended server; his own Android phone is enough |
| Gateway reliability | **Catch-up on open**, not background listening | Android kills background apps; SMS persist on the phone, so nothing is lost |
| Business separation | **Second SIM + sender allowlist** | Privacy, clean expense line, consistent business number |
| Build shape | **12 steps, 4 stopping points**, plus step 13 | Progress must be verifiable, and stopping early must still be useful |
| Pre-payment record | **Its own table**, not a row in `invoices` | A paid invoice always raises a payout; a pre-payment filed there would have paid the tutor for paying us |
| Pre-payment codes | **`TUT-` prefix**, separate from `MIS-` | Both ledgers arrive as the same bank SMS. A shared code space would let a tutor's transfer mark a family's invoice paid |
| Tutor payout details | **Asked at the hire**, not at registration | Every applicant would otherwise hand over bank details for a job they may not get |
| Account number in the bot | **In `settings`, sent verbatim** | Never in `knowledge.ts`: the model rewrites what is there, and a rewritten account number is money sent nowhere |
| Asking for money with no account set | **Blocked, with a warning** | A request that cannot say where to send it is what forced the old "call us for detail" |
| Reading the bot's conversations | **An Inbox, with no queue in it** | Seeing what was said is not holding a conversation. The rule is that nobody may be MADE to reply — so there is no unread count, nothing on Today, and no badge |
| Speaking into a thread by hand | **Operator-initiated only** | He sends when he decides to. Nothing a tutor types can summon it, so nobody is ever left waiting on a person |
| Language of a hand-typed message | **Checked at the send** | `parent.ts` is held to Amharic by a test because it is written ahead of time; a line typed at nine at night is in no file, so `checkManualMessage()` refuses it instead |

## Open — answer at the step that needs it

| Question | Needed by |
|---|---|
| Commission model: share of tutor pay, flat placement fee, or both? | Step 7 |
| Billing rhythm: monthly, every 8 lessons, or per lesson? | Step 10 |
| Parents on the bot too, or SMS-only? (bot is better — it keeps him out entirely) | Step 10 |
| The ten questions tutors always ask, for the FAQ menu | Step 4 |
| Which Telegram channels can the bot be made admin of? | Step 3 |
| A few real Telebirr / CBE SMS bodies, for the parser fixtures | Step 11 |

## Later, not in the 12 steps

**Facebook / Instagram ads.** Same pattern as Telegram channels: a job post becomes an ad, the ad's
link is the same tracked deep link, and `post_publications` already records where each applicant
came from. Adds one publishing channel plus a **cost-per-hire** view — spend per job against
applicants, shortlists and hires by source. Slots in after step 12 without changing anything built
before it.
