-- 0007 — Placements (build plan step 9)
--
-- Who teaches whom, at what rate, on what split. The schedule is a note of
-- what was agreed; there are no per-lesson records and nothing is reminded.

create type placement_status as enum ('scheduled', 'active', 'paused', 'ended');

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
