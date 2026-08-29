# Messaging, SMS and the Android gateway

One function, `notify(person, message)`, picks the channel.

## Three delivery cases

- **Tutor on Telegram** — automatic. They tapped Apply, so the bot may message them.
- **Parent on Telegram** — needs a one-time connect link sent at registration. After that tap,
  invoices, reminders and hire notifications flow with no human involvement.
- **Anyone by SMS** — written by the system, **sent by the operator**. This is the default and it
  is deliberate: it reads as a person rather than a robot, and a one-way message is not the
  conversation he is avoiding.

## The send queue (`outbox`)

Mobile-first — he will use it on his phone. Each row carries recipient, number, purpose and the
finished text, with three actions:

- **Send** — an `sms:+2519…?body=…` link that opens the native SMS app with number and body
  prefilled. One tap. Sends from his own number.
- **Copy** — clipboard fallback for desktop.
- **Mark sent** — stamps `sent_at`, which is what overdue chasing keys off. Unsent rows carry a
  count badge and turn red once late; a forgotten message means an invoice never goes out.

Parents who connect to the bot drop off the queue automatically. It shrinks over time.

## Bulk send from the Android phone

The operator's own phone is Android, so no dedicated device is needed. He opens the gateway app
3–5 times a day when it suits him; it pulls the pending queue, shows a count, and sends on one tap,
spaced a few seconds apart so it does not read as a burst to the carrier.

- No unattended server, no cron, no polling schedule — he decides when.
- No battery-optimisation failure mode; the app is in the foreground while he uses it.
- Safest possible from the carrier's side: it genuinely is him sending, from his number.
- The pending queue is a **cancellation window** — a wrong amount or name is caught on the
  dashboard before anything leaves.

## Catching up, rather than always listening

Background apps get killed on a daily-driver phone; the design must not depend on the gateway being
alive. It does not need to be. **An SMS is stored on the phone permanently**, so when the app is
opened it reads back through the inbox and forwards every bank message that arrived since it last
looked — even after days asleep.

So one action does both directions: **open the app → queued messages go out, missed bank messages
come in.**

The phone always initiates the connection; the server never reaches into it.

## Urgency split

- **Can wait** — invoices, hire news, shortlist replies, receipts → the bulk queue.
- **Must be on time** — lesson reminders → **Telegram only**. Never in a queue that waits for
  someone to open an app, where it would arrive after the lesson.

Anything the gateway fails to send falls back to the one-at-a-time `sms:` links rather than
disappearing.

## Copy constraints

SMS fits **160 characters** per segment, so bodies stay short and say only what is needed. Anything
longer belongs on Telegram, where length is free.

Sample, after a hire:

```
Ethio Tutors: Your tutor is Abebe Kebede,
0911234567. Math, Grade 9. Starts Mon 1 Sep,
4:00PM. Questions: t.me/ethiotutorsbot
```

## The gateway app

**`android-sms-gateway` by capcom6** (open source, GitHub) — REST API for sending, webhook on
receive, sender filtering. Free, no account. Backup option: `httpSMS`. Verify current state at
step 11 before committing.

Setup, once: install, paste server URL and secret key, allow SMS read/send, **turn off battery
optimisation for the app**, leave on charger while sending.

## Keeping business separate from personal

A second SIM dedicated to the business solves four problems at once: personal messages stay on
SIM 1 and are never touched; the bill is a clean business expense; parents always see one business
number; and the app can filter by SIM.

Three layers, strongest first:

1. **Sender allowlist in the app** — forward only `CBE`, `Telebirr`, `Awash`. A personal message
   never enters the system at all.
2. **SIM filter** — slot 2 only.
3. **Server discard** — anything that does not parse as a payment is dropped without storing the
   text. Defence in depth, not the main defence.

**Practical step:** bank alerts go to the number registered on the account. Moving to a business
SIM means updating the registered number with CBE and Telebirr — do this early, not after build.

## Later, optional

Fully unattended sending — a dedicated Android on a charger draining the queue on a schedule, or
Ethio Telecom bulk SMS if volume justifies the paperwork. Same queue, same API; only the trigger
changes.
