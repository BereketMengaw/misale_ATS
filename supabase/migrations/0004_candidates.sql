-- 0004 — Candidates and applications (build plan step 4)
-- The registration wizard writes here. Every field is answered with a button or
-- a Telegram share-contact tap; nothing needs a human to interpret it.

create type person_gender     as enum ('female', 'male');
create type education_level   as enum ('student', 'diploma', 'degree', 'masters', 'phd', 'other');
create type experience_band   as enum ('none', 'under_1', '1_2', '3_5', 'over_5');
create type candidate_status  as enum ('incomplete', 'active', 'paused', 'blocked');
create type application_status as enum (
  'applied', 'screened', 'ranked', 'shortlisted',
  'commission_agreed', 'presented', 'hired', 'rejected', 'pooled'
);

create table candidates (
  id                  bigserial primary key,
  telegram_id         bigint not null unique,
  chat_id             bigint,

  full_name           text,
  phone               text,
  gender              person_gender,
  area                text,

  education           education_level,
  institution         text,

  subjects            text[] not null default '{}',
  grades              text[] not null default '{}',
  -- { "mon": ["morning","evening"], ... } — only days with slots appear
  availability        jsonb  not null default '{}'::jsonb,

  experience          experience_band,
  expected_rate       numeric(12,2),
  expected_rate_period rate_period,

  cv_path             text,
  cv_name             text,
  cv_mime             text,
  cv_text             text,
  cv_parsed           jsonb,

  -- 0-100, recomputed on every save; the applicant board sorts incomplete last
  completeness        smallint not null default 0,
  rating              numeric(3,2),
  status              candidate_status not null default 'incomplete',

  -- one-line consent covering storage and future job DMs
  consent_at          timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger candidates_updated_at
  before update on candidates
  for each row execute function set_updated_at();

create index candidates_status_idx   on candidates (status, completeness desc);
create index candidates_subjects_idx on candidates using gin (subjects);
create index candidates_grades_idx   on candidates using gin (grades);

alter table candidates enable row level security;

create policy candidates_operator_select on candidates
  for select using (exists (select 1 from operators o where o.id = auth.uid()));

-- ---------------------------------------------------------------------------
-- applications — one per job × candidate.
-- publication_id records which channel post brought them in, so cost-per-hire
-- can be answered later without guessing.
-- ---------------------------------------------------------------------------
create table applications (
  id              bigserial primary key,
  job_post_id     bigint not null references job_posts(id) on delete cascade,
  candidate_id    bigint not null references candidates(id) on delete cascade,
  publication_id  bigint references post_publications(id) on delete set null,

  status          application_status not null default 'applied',
  score           numeric(6,2),
  score_breakdown jsonb,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (job_post_id, candidate_id)
);

create trigger applications_updated_at
  before update on applications
  for each row execute function set_updated_at();

create index applications_job_idx on applications (job_post_id, score desc nulls last);

alter table applications enable row level security;

create policy applications_operator_select on applications
  for select using (exists (select 1 from operators o where o.id = auth.uid()));

-- ---------------------------------------------------------------------------
-- CVs are personal data: a private bucket, reachable only through the secret
-- key, and read by the dashboard as a short-lived signed URL.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('cvs', 'cvs', false, 10485760)
on conflict (id) do nothing;
