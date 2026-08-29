-- 0011 — Payment SMS matching (build plan step 11)

create type payment_match as enum ('auto', 'operator', 'unmatched');

create table payments (
  id            bigserial primary key,

  -- Exactly what arrived, kept whole: the parsers will be rewritten against
  -- real messages, and re-parsing history needs the original text.
  raw_body      text not null,
  sender        text,
  received_at   timestamptz not null default now(),

  -- What the parser made of it.
  provider      text,
  amount_cents  bigint,
  payer         text,
  txn_ref       text,
  reference     text,
  receipt_url   text,
  parsed        jsonb,

  invoice_id    bigint references invoices(id) on delete set null,
  matched_by    payment_match not null default 'unmatched',
  matched_at    timestamptz,
  note          text,

  created_at    timestamptz not null default now()
);

-- The same forwarded message must not be banked twice. The gateway resends on
-- catch-up, so this is load-bearing rather than tidiness.
create unique index payments_dedupe_idx
  on payments (coalesce(txn_ref, ''), coalesce(amount_cents, 0), coalesce(sender, ''))
  where txn_ref is not null;

create index payments_unmatched_idx on payments (received_at desc) where invoice_id is null;

alter table payments enable row level security;
create policy payments_operator_select on payments
  for select using (exists (select 1 from operators o where o.id = auth.uid()));
