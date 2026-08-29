-- 0005 — Selection and closing (build plan step 7)

-- ---------------------------------------------------------------------------
-- clients — the parent paying for the lessons. Introductions need someone to
-- introduce the tutor TO, and invoices at step 10 need someone to bill.
-- ---------------------------------------------------------------------------
create table clients (
  id          bigserial primary key,
  full_name   text not null,
  phone       text,
  telegram_id bigint unique,
  area        text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger clients_updated_at
  before update on clients
  for each row execute function set_updated_at();

alter table clients enable row level security;

create policy clients_operator_select on clients
  for select using (exists (select 1 from operators o where o.id = auth.uid()));

alter table job_posts add column client_id bigint references clients(id) on delete set null;

-- ---------------------------------------------------------------------------
-- presentation_batches — the 3, then the 5.
--
-- The board scores on read so a weight change reorders it immediately, but a
-- batch must not: once the operator has looked at a Top 3 and the tutors have
-- been asked to accept the commission, that set is fixed. The scores are
-- copied onto the applications when a batch is made.
-- ---------------------------------------------------------------------------
create table presentation_batches (
  id           bigserial primary key,
  job_post_id  bigint not null references job_posts(id) on delete cascade,
  size         smallint not null,
  created_by   uuid references operators(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table presentation_items (
  batch_id       bigint not null references presentation_batches(id) on delete cascade,
  application_id bigint not null references applications(id) on delete cascade,
  rank_at_time   smallint not null,
  score_at_time  numeric(6,2),
  primary key (batch_id, application_id)
);

create index presentation_batches_job_idx on presentation_batches (job_post_id, created_at desc);

alter table presentation_batches enable row level security;
alter table presentation_items enable row level security;

create policy presentation_batches_operator_select on presentation_batches
  for select using (exists (select 1 from operators o where o.id = auth.uid()));
create policy presentation_items_operator_select on presentation_items
  for select using (exists (select 1 from operators o where o.id = auth.uid()));

-- ---------------------------------------------------------------------------
-- What the tutor agreed to, captured when they accept. The percentage can be
-- changed later in settings; what someone accepted must not move.
-- ---------------------------------------------------------------------------
alter table applications add column commission_percent numeric(5,2);
alter table applications add column commission_at      timestamptz;
alter table applications add column decided_at         timestamptz;
alter table applications add column closed_message_at  timestamptz;

-- Which candidate was hired, and when the job closed.
alter table job_posts add column hired_application_id bigint references applications(id) on delete set null;
alter table job_posts add column closed_at timestamptz;
