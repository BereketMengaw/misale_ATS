# Setup checklist

Things only the operator can do. None block step 1, but the earlier they are done the better.

## Before step 1

- [ ] **Telegram bot** — create via [@BotFather](https://t.me/BotFather), keep the token. Choose a
      name and username that read as the company, not a test bot.
- [ ] **Bot profile** — company photo and a short description. This is the first thing every tutor
      sees, and it is most of what makes a bot look professional rather than cheap.
- [ ] **Supabase project** — free tier.
- [ ] **Vercel account** — free tier.

## Before step 3 (publishing)

- [ ] **Test channel** — a private channel with the bot added as an admin, for safe trials.
- [ ] **Live channels** — list which channels the bot can be made an admin of, and which will need
      manual posting.

## Before step 4 (registration)

- [ ] **The ten questions** tutors always ask, for the FAQ menu.
- [ ] **Consent wording** for storing profiles and CVs and DMing about future jobs.

## Before step 7 (selection)

- [ ] **Commission model** — share of pay, flat fee, or both, and the number.
- [ ] **Contact release rule** — on hire, after first payment, or never.

## Before step 10 (invoices)

- [ ] **Billing rhythm** — monthly, every 8 lessons, or per lesson.
- [ ] **Payment details** the parent needs: account number and name to pay into.

## Before step 11 (payment matching)

- [ ] **Business SIM** in slot 2 of the Android phone.
- [ ] **Bank number updated** — CBE and Telebirr alerts must go to the business number. Do this
      early; it is the slowest item on this list.
- [ ] **A few real payment SMS** — Telebirr and CBE — for the parser fixtures.
- [ ] **Gateway app** installed (`android-sms-gateway` by capcom6), battery optimisation turned off
      for it.

## Not needed

- No dedicated or old phone — his own Android is enough.
- No AI account, at any step.
- No bank API, integration or permission.
- No iPhone involvement; the gateway is Android-only.
