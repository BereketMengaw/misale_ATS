-- 0010 — Invoices and the send queue (build plan step 10)

create type invoice_status as enum ('draft', 'sent', 'paid', 'cancelled');
create type outbox_status  as enum ('pending', 'sent', 'cancelled');
create type outbox_purpose as enum ('introduction', 'invoice', 'overdue', 'receipt', 'other');

create table invoices (
  id            bigserial primary key,
  client_id     bigint not null references clients(id) on delete restrict,
  placement_id  bigint not null references placements(id) on delete restrict,

  -- "2026-09". One invoice per placement per month, enforced below.
  period        text not null,

  -- What the parent owes, and the split as it stood when the invoice was made.
  gross_cents   bigint not null check (gross_cents >= 0),
  commission_cents bigint not null check (commission_cents >= 0),
  net_cents     bigint not null check (net_cents >= 0),
  commission_percent numeric(5,2) not null,
  description   text,

  -- The code the parent puts in the payment reason. This is what makes a
  -- payment match itself at step 11, so it is unique across the whole table.
  reference     text not null unique,

  issued_on     date not null default current_date,
  due_on        date not null,

  status        invoice_status not null default 'draft',
  sent_at       timestamptz,
  paid_at       timestamptz,
  paid_by       text,          -- how it was marked paid: 'sms' or 'operator'

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- gross must always equal the two halves; a rounding bug cannot be stored.
  constraint invoice_splits_add_up check (commission_cents + net_cents = gross_cents),
  unique (placement_id, period)
);

create trigger invoices_updated_at
  before update on invoices
  for each row execute function set_updated_at();

create index invoices_unpaid_idx on invoices (due_on) where status <> 'paid';
create index invoices_client_idx on invoices (client_id, period desc);

alter table invoices enable row level security;
create policy invoices_operator_select on invoices
  for select using (exists (select 1 from operators o where o.id = auth.uid()));

-- ---------------------------------------------------------------------------
-- outbox — the send queue. Written by the system, SENT BY THE OPERATOR.
--
-- One row per message he still has to send: recipient, number, purpose and the
-- finished text. Marking it sent is what overdue chasing keys off, so a
-- forgotten message is visible rather than silent.
-- ---------------------------------------------------------------------------
create table outbox (
  id           bigserial primary key,
  purpose      outbox_purpose not null default 'other',

  recipient    text not null,
  phone        text,
  body         text not null,

  invoice_id   bigint references invoices(id) on delete cascade,
  client_id    bigint references clients(id) on delete set null,

  status       outbox_status not null default 'pending',
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index outbox_pending_idx on outbox (created_at) where status = 'pending';

alter table outbox enable row level security;
create policy outbox_operator_select on outbox
  for select using (exists (select 1 from operators o where o.id = auth.uid()));

insert into settings (key, value) values
  ('billing', '{"rhythm":"monthly","due_in_days":7}'::jsonb)
on conflict (key) do nothing;
