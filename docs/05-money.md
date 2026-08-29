# Money

## How a payment reaches the server

The bank never talks to the server. **The phone is the bridge.**

```
Parent pays into the CBE / Telebirr account
        ↓
The bank sends its SMS to the operator's phone, exactly as it does today
        ↓
The gateway app forwards the message text to /api/webhooks/sms
        ↓
Server extracts amount, payer name, reference; finds the matching invoice
        ↓
Invoice marked PAID; the tutor's payout is calculated
```

No bank integration, no API access, no permission to request. The SMS already arrives — the app
just passes it along instead of letting it sit unread.

## Invoices

Billing is **monthly**. A placement on a monthly rate is billed that rate flat; one on an hourly or
per-session rate is billed for the lessons its agreed schedule actually places in that month,
counted from the calendar rather than estimated — September and February are not the same month.

Each invoice carries a **unique short reference code** that the parent is asked to put in the
payment reason. That code is what makes matching reliable. Its alphabet excludes 0/O, 1/I/L and the
vowels, so it survives being written by hand, read off a screen and retyped on a keypad, and cannot
spell a word by accident.

There are no per-lesson timesheets: the operator removed them, since a flat monthly rate does not
need hours counted.

## Matching

Regex-first per provider template — amount, payer name, transaction reference. For CBE, the SMS
carries a receipt link (`apps.cbe.com.et/?id=…`) which the server can open to confirm payer and
amount when the text alone is ambiguous. An unrecognised format falls back to the configured model
provider, or straight to the Unmatched inbox when none is configured.

Matching scores reference code + amount + payer name:

- **High confidence** → auto-marks the invoice paid.
- **Anything else** → the **Unmatched payments** inbox, where one tap attaches it to the right
  invoice.
- **Always available** → mark any invoice paid by hand.

The parser is never a single point of failure. **The invoice list is the source of truth** — an
unmatched payment shows up as an invoice still unpaid, which is visible. Parsing only saves typing.

## Payouts

A paid invoice produces a payout row: **gross − commission = net**, with a due date, shown in
**Payouts due**. The operator pays, records the confirmation, and it is reconciled. Per-tutor and
per-month views for checking.

## Protecting the commission

Once the tutor has the parent's number and the parent has the tutor's, they can arrange next month
privately and cut the agency out. Contact release is therefore a setting,
`settings.contact_release`:

- `on_hire` — fastest, most trusting.
- `after_first_payment` — **recommended**; covers the month of highest exposure.
- `never` — first names and area only; the bot stays the scheduling channel.

Registration tells both sides that details will be exchanged, so nobody is surprised.

## Testing

- Unit tests over a fixture file of real Telebirr and CBE SMS bodies, asserting amount, reference,
  payer and the invoice matched. Includes deliberately malformed messages, which must land in the
  Unmatched inbox rather than mis-match.
- One placement run end to end in test — lessons → invoice → payment → payout — asserting gross,
  commission and net **to the cent**.
- Before going live: a full dry run with a fake parent, a fake tutor and a 1-birr real transfer.
