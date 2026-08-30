-- 0018 — Tutors who exist without a Telegram account.
--
-- 771 applicants arrived through a Google Form years before this bot did.
-- `telegram_id` was not null because every candidate came from Telegram and it
-- is how the bot finds anybody. That is still true of anyone who registers, but
-- it must not be the price of being in the system at all: the alternative was
-- asking 771 people to fill the form in again.
--
-- An imported tutor is ranked, searched, shortlisted and read like any other.
-- What they cannot be is MESSAGED, until they open the bot themselves — at
-- which point their phone number finds this row and fills the id in, rather
-- than making a second one. Postgres allows any number of NULLs under a unique
-- constraint, so the existing one still holds for everyone who has an id.
alter table candidates alter column telegram_id drop not null;

-- How a returning applicant is recognised. Phones are stored E.164 by
-- normalizePhone, so this is an exact match rather than a fuzzy one.
create index if not exists candidates_phone_idx on candidates (phone)
  where phone is not null;

-- Where the row came from, so an import can be told from a registration and
-- re-run without guessing. NULL means they registered on the bot themselves.
alter table candidates
  add column if not exists imported_from text,
  add column if not exists imported_at   timestamptz;
