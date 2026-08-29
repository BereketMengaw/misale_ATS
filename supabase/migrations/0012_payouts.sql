-- 0012 — Payouts (build plan step 12) — the last stopping point.

create type payout_status as enum ('due', 'paid', 'cancelled');

create table payouts (
  id                bigserial primary key,

  -- One payout per paid invoice. The agency never fronts money it has not
  -- received, so a payout cannot exist without the invoice behind it.
  invoice_id        bigint not null unique references invoices(id) on delete restrict,
  placement_id      bigint not null references placements(id) on delete restrict,
  candidate_id      bigint not null references candidates(id) on delete restrict,

  -- Copied from the invoice, not recomputed. The commission percentage may be
  -- changed in settings afterwards; what was agreed and invoiced is what is paid.
  gross_cents       bigint not null check (gross_cents >= 0),
  commission_cents  bigint not null check (commission_cents >= 0),
  net_cents         bigint not null check (net_cents >= 0),

  status            payout_status not null default 'due',
  due_on            date not null default current_date,
  paid_at           timestamptz,
  txn_ref           text,
  note              text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- The books cannot be stored out of balance, even by a future bug.
  constraint payout_splits_add_up check (commission_cents + net_cents = gross_cents)
);

create trigger payouts_updated_at
  before update on payouts
  for each row execute function set_updated_at();

create index payouts_due_idx on payouts (due_on) where status = 'due';
create index payouts_candidate_idx on payouts (candidate_id, created_at desc);

alter table payouts enable row level security;
create policy payouts_operator_select on payouts
  for select using (exists (select 1 from operators o where o.id = auth.uid()));

-- Contact release keys off the first payment, so the moment has to be recorded.
alter table placements add column if not exists first_paid_at timestamptz;
alter table placements add column if not exists contacts_released_at timestamptz;
