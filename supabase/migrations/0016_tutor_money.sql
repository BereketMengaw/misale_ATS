-- 0016 — The tutor's side of the money.
--
-- Two gaps, both of them holes rather than decisions (docs/06-decisions.md
-- records what was deliberately left out, and neither of these is in it):
--
--   1. `payouts` computes what a tutor is owed to the cent and had nowhere to
--      send it. `candidates` carried a phone number and no account.
--   2. The pre-payment existed only as words. `commissionOffer` quotes the
--      figure, the knowledge base explains it, and nothing recorded that
--      anybody owed it, was told where to send it, or ever paid.
--
-- Both are now rows, because a charge nobody records is a charge nobody collects.

-- ---------------------------------------------------------------------------
-- Where a tutor is paid
-- ---------------------------------------------------------------------------

do $$ begin
  create type payout_provider as enum ('telebirr', 'cbe', 'other');
exception when duplicate_object then null;
end $$;

alter table candidates
  add column if not exists payout_provider payout_provider,
  -- Digits only, normalised on the way in. Not unique: a household can share
  -- an account, and rejecting the second tutor to use one would be wrong.
  add column if not exists payout_account  text,
  -- The name ON the account, which is not always the name on the profile.
  add column if not exists payout_name     text,
  add column if not exists payout_set_at   timestamptz;

-- ---------------------------------------------------------------------------
-- The pre-payment
-- ---------------------------------------------------------------------------

do $$ begin
  create type prepayment_status as enum ('due', 'paid', 'waived');
exception when duplicate_object then null;
end $$;

create table if not exists prepayments (
  id                 bigserial primary key,

  candidate_id       bigint not null references candidates(id) on delete restrict,
  -- One placement, one pre-payment — that is what "one-off" means. The unique
  -- constraint is what makes creating it at hire safe to run twice.
  placement_id       bigint not null unique references placements(id) on delete restrict,

  -- Frozen at hire from the rate the tutor accepted. Changing the commission
  -- percentage in settings later must not silently re-price a debt somebody
  -- has already been told the figure for.
  amount_cents       bigint not null check (amount_cents > 0),
  commission_percent numeric(5,2) not null,

  -- TUT-XXXX. Its own prefix, so a tutor's transfer can never be matched
  -- against a family's invoice — see lib/money/reference.ts.
  reference          text not null unique,

  status             prepayment_status not null default 'due',
  -- Two weeks from meeting the family, per docs/05-money.md.
  due_on             date not null,

  -- Nobody is late for a payment they were never given an account for, so the
  -- moment the tutor was actually told is recorded rather than assumed.
  notified_at        timestamptz,
  paid_at            timestamptz,
  waived_at          timestamptz,
  note               text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists prepayments_updated_at on prepayments;
create trigger prepayments_updated_at
  before update on prepayments
  for each row execute function set_updated_at();

create index if not exists prepayments_due_idx on prepayments (due_on) where status = 'due';
create index if not exists prepayments_candidate_idx on prepayments (candidate_id, created_at desc);

alter table prepayments enable row level security;
drop policy if exists prepayments_operator_select on prepayments;
create policy prepayments_operator_select on prepayments
  for select using (exists (select 1 from operators o where o.id = auth.uid()));

-- ---------------------------------------------------------------------------
-- A payment can now settle either ledger
-- ---------------------------------------------------------------------------

alter table payments
  add column if not exists prepayment_id bigint references prepayments(id) on delete set null;

-- One transfer settles one thing. Without this a payment attached to both would
-- show as money received twice, which is the one error the books must not hold.
alter table payments drop constraint if exists payment_settles_one_ledger;
alter table payments add constraint payment_settles_one_ledger
  check (invoice_id is null or prepayment_id is null);

create index if not exists payments_prepayment_idx on payments (prepayment_id)
  where prepayment_id is not null;

-- ---------------------------------------------------------------------------
-- Where the money goes
-- ---------------------------------------------------------------------------

-- The unchecked box in docs/07-setup-checklist.md, before step 10: "Payment
-- details the parent needs: account number and name to pay into." It was never
-- wired to anything, so invoiceAm has been sending a bill with no payee and the
-- pre-payment could not be asked for at all. One row, read by both messages.
insert into settings (key, value) values
  ('payment_details', '{"account_name":"","cbe_account":"","telebirr":""}'::jsonb)
on conflict (key) do nothing;
