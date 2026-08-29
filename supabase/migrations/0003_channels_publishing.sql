-- 0003 — Channels and publishing (build plan step 3)
-- A bot can only auto-post where it is an admin. Channels owned by other people
-- have no API path, so the dashboard produces a ready-to-send pack and records
-- that it was posted by hand.

create type channel_kind   as enum ('bot_admin', 'manual');
create type post_language  as enum ('both', 'am', 'en');
create type publish_method as enum ('bot', 'manual');

create table channels (
  id          bigserial primary key,
  title       text not null,
  -- Telegram chat id, e.g. -1001234567890. Null for channels we only post to by hand.
  chat_id     bigint unique,
  username    text,                       -- without the @
  kind        channel_kind not null default 'manual',
  language    post_language not null default 'both',
  active      boolean not null default true,
  -- what the last admin check saw, so the dashboard can warn before a failed post
  last_check_at     timestamptz,
  last_check_ok     boolean,
  last_check_detail text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger channels_updated_at
  before update on channels
  for each row execute function set_updated_at();

alter table channels enable row level security;

create policy channels_operator_select on channels
  for select using (exists (select 1 from operators o where o.id = auth.uid()));

-- ---------------------------------------------------------------------------
-- post_publications — one row per job × channel.
--
-- The row is created BEFORE the message is sent, because its id goes into the
-- Apply deep link (job_<job>_<publication>). That is what tells us which
-- channel an applicant came from, and it is what a cost-per-hire view will read.
--
-- message_id is what step 7 edits in place to say FILLED, keeping the post's
-- views and position.
-- ---------------------------------------------------------------------------
create table post_publications (
  id           bigserial primary key,
  job_post_id  bigint not null references job_posts(id) on delete cascade,
  channel_id   bigint not null references channels(id) on delete cascade,
  method       publish_method not null,
  message_id   bigint,
  posted_at    timestamptz,
  posted_by    uuid references operators(id) on delete set null,
  apply_count  integer not null default 0,
  -- set when the post has been rewritten to FILLED
  closed_at    timestamptz,
  error        text,
  created_at   timestamptz not null default now(),
  unique (job_post_id, channel_id)
);

create index post_publications_job_idx on post_publications (job_post_id);

alter table post_publications enable row level security;

create policy post_publications_operator_select on post_publications
  for select using (exists (select 1 from operators o where o.id = auth.uid()));

-- Counting an Apply tap must not need a read first: the bot is stateless and
-- two taps can land at once.
create or replace function bump_apply_count(publication_id bigint)
returns void
language sql
as $$
  update post_publications
     set apply_count = apply_count + 1
   where id = publication_id;
$$;
