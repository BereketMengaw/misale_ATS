# Overview

## The loop

| Who | What happens |
|---|---|
| **Operator** | Answers a few questions: subject, grade, area, days per week, pay. |
| System | Writes a clean job post in Amharic and English, publishes it to the Telegram channels. |
| Tutors | Tap **Apply** on the post; the bot opens in their private chat. |
| System | Runs a button-driven registration, takes the CV, scores each applicant against the job. |
| **Operator** | Sees the top 3 with score breakdowns on the dashboard. Can ask for 5 more. Picks one. |
| System | Introduces tutor and parent, tells the others honestly, edits every channel post to FILLED. |
| System | Reminds both sides before each lesson; tutor confirms hours worked. |
| System | Generates the invoice with a unique reference code; the operator sends it. |
| **Operator** | Forwards the payment SMS (or the app does). Invoice marks itself paid. One tap releases the payout. |

## Why a bot and not a personal account

A userbot on a personal Telegram account cannot send buttons — inline keyboards, the Apply deep
link that identifies the job, "Share contact", the availability grid, "confirm your hours" are all
Bot API only. Without buttons every answer is free text, which needs a model to interpret and
becomes slow, costly and unpredictable. It would also deliver every applicant message into the
operator's own Telegram, which is precisely what he is trying to avoid.

## Telegram constraints that shape the design

1. **A bot cannot message a user who has never started it.** Every post carries a deep link
   (`t.me/<bot>?start=job_<id>`); tapping Apply creates the contact, which is also what makes
   future "this job suits you" DMs possible.
2. **The bot can only auto-post where it is an admin.** Channels owned by other people have no API
   path — the dashboard produces a ready-to-send pack and logs where it was posted manually.
3. **Phone numbers require a Share-contact tap**, never a typed field.
4. **CVs are personal data** — registration carries a one-line consent covering storage and future
   job DMs.

## Closing a job

Lifecycle: `draft → open → closed_filled | closed_cancelled | expired`. On hire, three things
happen automatically:

1. **Every channel post is edited in place** via the stored `message_id` — it keeps its views and
   position but now reads **ተይዟል / FILLED** with the Apply button removed.
2. **The deep link stops accepting applications.** Old links, forwarded copies and screenshots get
   "this position has been filled — here is what's open now", with buttons for live jobs. A dead
   link becomes a new applicant.
3. **Everyone in the pipeline is closed out** — the two presented get the shortlist message, the
   rest get a short note. Nobody waits on a reply that never comes.

Open posts older than a configurable window (default 30 days) are flagged for closing or reposting,
so stale links never stay live.
