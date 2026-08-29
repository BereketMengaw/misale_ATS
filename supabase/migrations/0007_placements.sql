-- 0007 — Placements and timesheets (build plan step 9)

create type placement_status as enum ('scheduled', 'active', 'paused', 'ended');
create type session_status   as enum ('scheduled', 'reminded', 'confirmed', 'missed', 'cancelled');

create table placements (
  id                 bigserial primary key,
  job_post_id        bigint not null references job_posts(id) on delete cascade,
  candidate_id       bigint not null references candidates(id) on delete cascade,
  client_id          bigint references clients(id) on delete set null,

  -- Copied from the job at hire. The job's figures may be edited afterwards;
  -- what was agreed for this placement must not move.
  rate_amount        numeric(12,2) not null,
  rate_period        rate_period not null,
  commission_percent numeric(5,2) not null,

  -- { "days": ["mon","wed","fri"], "time": "17:00", "hours": 2 }
  schedule           jsonb,
  starts_on          date,
  ends_on            date,

  status             placement_status not null default 'scheduled',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (job_post_id, candidate_id)
);

create trigger placements_updated_at
  before update on placements
  for each row execute function set_updated_at();

alter table placements enable row level security;
create policy placements_operator_select on placements
  for select using (exists (select 1 from operators o where o.id = auth.uid()));

-- ---------------------------------------------------------------------------
-- sessions — one row per lesson.
--
-- planned_hours is what was scheduled; confirmed_hours is what the tutor says
-- happened. Invoices are built from CONFIRMED hours only (docs/05-money.md),
-- so the two are kept apart rather than one overwriting the other.
-- ---------------------------------------------------------------------------
create table sessions (
  id               bigserial primary key,
  placement_id     bigint not null references placements(id) on delete cascade,

  scheduled_at     timestamptz not null,
  planned_hours    numeric(4,2) not null,
  confirmed_hours  numeric(4,2),

  status           session_status not null default 'scheduled',
  reminder_sent_at timestamptz,
  asked_at         timestamptz,
  confirmed_at     timestamptz,
  confirmed_by     bigint,          -- telegram id of whoever confirmed

  -- set once an invoice includes this lesson, so it cannot be billed twice
  invoice_id       bigint,

  created_at       timestamptz not null default now(),

  unique (placement_id, scheduled_at)
);

create index sessions_due_idx on sessions (scheduled_at) where status in ('scheduled', 'reminded');
create index sessions_placement_idx on sessions (placement_id, scheduled_at);
create index sessions_unbilled_idx on sessions (placement_id) where status = 'confirmed' and invoice_id is null;

alter table sessions enable row level security;
create policy sessions_operator_select on sessions
  for select using (exists (select 1 from operators o where o.id = auth.uid()));

insert into settings (key, value) values
  ('reminders', '{"lead_minutes":120,"remind_parent":false}'::jsonb)
on conflict (key) do nothing;
