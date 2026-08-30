# What to send by hand

Almost nothing, now. This exists because the export showed messages still being
pasted one at a time that the bot already sends better — and one of them broke
the rule the project is built on.

## Stop sending the commissioning message

The most-reused message in the history went to 268 people and said, in part:

> 1) You are supposed to pay pre payment that is 20% of your salary **[you can
>    call us for detail]** and monthly we will take 20% …
> 2) You can pay 70% of your salary once and will not take monthly.

Three things are wrong with it now.

**It invites a phone call.** "You can call us for detail" is exactly what the
non-negotiable rule forbids: a message that routes a person to a human
expecting a reply. It has been sent to 268 people.

**Option 2 no longer exists** — see `docs/08-retired-commission-option.md`.

**The deadline was vague.** "Before your first salary" is right; the two-week
window is what the bot now says, in every place it says it.

And it is unnecessary. `commissionOffer` in `lib/hiring/messages.ts` sends the
same thing at the shortlist with the arithmetic already done — 4,800 ETB rather
than "20% of your salary" — and with Accept and Decline as buttons rather than
"if you agree with let we know". Nobody has to work anything out, and nobody
has to be read by a person.

## If somebody has to be messaged before that

Short, and pointing at the thing that answers:

> Thanks for applying.
>
> Our fee is 20%, already taken out of the figure you are quoted — you never
> send us that part.
>
> There is also a one-off pre-payment equal to one period of that fee, due
> within two weeks of meeting the family and before your first salary.
>
> You will see the exact figures here before you are asked to accept anything.
> Any question, type it here and you will get an answer.

## The welcome and the group links

Those two are still worth sending, and the bot now says the group itself: at
the end of registration and whenever the answer is that nothing is open. The
constant is `JOBS_GROUP` in `lib/bot/copy.ts`, so a changed link changes once.
