-- 0002 — Job posts (build plan step 2)
-- The operator answers a few fields; the system writes the bilingual post.
-- Publishing (channels, message_id, Apply deep link) arrives in step 3;
-- clients / students / job_requests arrive with the demand side.

create type rate_period as enum ('per_hour', 'per_session', 'per_month');
create type gender_pref as enum ('any', 'female', 'male');
create type job_status  as enum ('draft', 'open', 'closed_filled', 'closed_cancelled', 'expired');

create table job_posts (
  id                 bigserial primary key,

  -- what the operator answers
  subject            text not null,
  grade              text not null,
  area               text not null,
  days_per_week      smallint not null check (days_per_week between 1 and 7),
  hours_per_session  numeric(4,2) check (hours_per_session > 0 and hours_per_session <= 12),
  rate_amount        numeric(12,2) not null check (rate_amount > 0),
  rate_period        rate_period not null default 'per_hour',
  gender_pref        gender_pref not null default 'any',
  starts_on          date,
  notes              text,
  commission_percent numeric(5,2) not null default 20 check (commission_percent >= 0 and commission_percent < 100),

  -- what the system writes
  body_am            text not null,
  body_en            text not null,
  generated_by       text not null default 'template',
  -- true once the operator has hand-edited the text; regenerate then warns first
  body_edited        boolean not null default false,

  status             job_status not null default 'draft',
  approved_at        timestamptz,
  expires_at         timestamptz,

  created_by         uuid references operators(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger job_posts_updated_at
  before update on job_posts
  for each row execute function set_updated_at();

create index job_posts_status_idx on job_posts (status, created_at desc);

alter table job_posts enable row level security;

-- Operators read jobs through the dashboard's own session; writes go via the
-- service role in server actions.
create policy job_posts_operator_select on job_posts
  for select using (exists (select 1 from operators o where o.id = auth.uid()));
