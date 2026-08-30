-- 0017 — Which bank, when it is not CBE or Telebirr.
--
-- `payout_provider` offered "other" from the start, and picking it threw away
-- the only thing that mattered: the operator saw "Another bank" and an account
-- number, with nothing saying where to send it. Ethiopia has a dozen banks
-- tutors actually use — Awash, Abyssinia, Dashen, Oromia and the rest — and an
-- agency that can only pay two of them is an agency that cannot pay everyone.
--
-- Free text rather than more enum values: the list of banks changes on
-- somebody else's schedule, and a tutor at a bank we have not heard of must
-- not be stuck. The bot offers the common ones as buttons and takes a typed
-- name for anything else.
alter table candidates
  add column if not exists payout_bank text;
