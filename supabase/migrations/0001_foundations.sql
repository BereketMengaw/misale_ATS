-- 0001 — Foundations (build plan step 1)
-- Only the plumbing step 1 needs: operator identity, bot session state, a message log
-- and the settings bag. Demand/supply/money tables arrive with the steps that use them.

create extension if not exists "pgcrypto";

-- updated_at helper, reused by every later migration
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- operators — who may log into the dashboard.
-- A row here is the allowlist; a Supabase auth user without one gets nothing.
-- ---------------------------------------------------------------------------
create table operators (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text,
  telegram_id bigint unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger operators_updated_at
  before update on operators
  for each row execute function set_updated_at();

alter table operators enable row level security;

-- An operator can read their own row. Everything else goes through the service role.
create policy operators_self_select on operators
  for select using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- settings — commission defaults, ranking weights, contact-release rule,
-- message templates. Tunable without a deploy.
-- ---------------------------------------------------------------------------
create table settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger settings_updated_at
  before update on settings
  for each row execute function set_updated_at();

alter table settings enable row level security;

insert into settings (key, value) values
  ('commission',       '{"model":"share_of_pay","percent":20}'::jsonb),
  ('contact_release',  '{"rule":"after_first_payment"}'::jsonb),
  ('ranking_weights',  '{"subject":30,"grade":15,"area":20,"availability":15,"experience":10,"education":5,"rating":5}'::jsonb),
  ('post_expiry_days', '30'::jsonb);

-- ---------------------------------------------------------------------------
-- bot_sessions — conversation state. Lives in Postgres, never in memory:
-- the webhook is stateless and may run on any instance.
-- ---------------------------------------------------------------------------
create table bot_sessions (
  telegram_id bigint primary key,
  chat_id     bigint not null,
  flow        text,
  step        text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger bot_sessions_updated_at
  before update on bot_sessions
  for each row execute function set_updated_at();

alter table bot_sessions enable row level security;

-- ---------------------------------------------------------------------------
-- message_log — every inbound update and outbound send, for debugging and for
-- proving what the system told someone.
-- ---------------------------------------------------------------------------
create type message_direction as enum ('in', 'out');

create table message_log (
  id          bigserial primary key,
  direction   message_direction not null,
  telegram_id bigint,
  chat_id     bigint,
  kind        text,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create index message_log_telegram_id_idx on message_log (telegram_id, created_at desc);
create index message_log_created_at_idx on message_log (created_at desc);

alter table message_log enable row level security;
