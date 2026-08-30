# The second commissioning system (retired)

Not implemented, and not to be implemented. This exists so that nobody reads an
old conversation, finds a tutor talking about "the second option", and builds it.

## What it was

Until August 2026 tutors were offered a choice. The message below was sent to
**268 different people** — the second most-reused message in the whole history —
and is quoted as written:

> Here we have two types of commissioning system
>
> 1. You are supposed to pay pre payment that is 20% of your salary [you can
>    call us for detail] and monthly we will take 20%. You will receive the
>    salary from us not from the parents.
> 2. You can pay 70% of your salary once and will not take monthly.
>
> Prepayment or commission to be sent after you meet the parents but before
> your first salary
>
> If you agree with let we know.

Option 2 was a buyout: one payment of 70% of a salary, and nothing deducted
after that. Option 1 is what the system implements today.

## Why it is worth recording

**It explains the old conversations.** Roughly 277 people replied to that
message by position — "I agree with the first one", "the second one",
"Option 2". Read without this file, those look like people choosing a job.
They were choosing how they would be paid.

**It is why the bot has no such choice.** A tutor is now offered one
arrangement: the agency's share comes out of the advertised rate, and a one-off
pre-payment equal to one period of that share falls due before the first
lesson. Accept or decline — see `lib/hiring/messages.ts`.

**It nearly became a feature.** The option surfaced only when the real chat
history was mined in August 2026, and looked at first like a gap in the money
model. It was a discontinued product, not a missing one. Worth remembering that
the export shows what the business *did*, not only what it does.

## If it ever comes back

It would not be a settings change. `lib/money/` computes a share of pay and a
pre-payment; a buyout is a third quantity with its own arithmetic, a per-
placement record of which arrangement was chosen, and a payout path where the
family pays the tutor directly. Everything in `lib/money/` is asserted to the
cent, and that is where it would have to be proven first.

## How this was found

`npm run mine:pairs -- <telegram-export>/result.json` — see
`lib/mining/pairs.ts`. It ranks the operator's own most-reused messages, which
is where this one surfaced.
