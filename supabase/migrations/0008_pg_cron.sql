-- 0008 — Hourly lesson cron, run from Postgres
--
-- Vercel's Hobby plan allows one cron a day; lesson reminders need to be
-- nearer hourly than daily, so the schedule lives in Postgres instead.
-- pg_cron calls pg_net, which calls the same idempotent endpoint Vercel's
-- daily backstop calls.
--
-- The URL and secret are NOT in this file. They are inserted separately, so
-- nothing secret is committed to the repository.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Not `settings`: that table is read by the dashboard. This one has no policies
-- at all, so only the secret key can ever see it.
create table if not exists internal_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table internal_config enable row level security;

create or replace function trigger_lesson_cron()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target text;
  secret text;
begin
  select value into target from internal_config where key = 'cron_url';
  select value into secret from internal_config where key = 'cron_secret';

  -- Not configured yet is not an error; it just means there is nothing to call.
  if target is null or secret is null then
    return;
  end if;

  perform net.http_post(
    url     := target,
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || secret,
                 'Content-Type',  'application/json'
               ),
    body    := '{}'::jsonb
  );
end;
$$;

-- Replace any earlier schedule so re-running this migration is safe.
select cron.unschedule('lesson-reminders')
where exists (select 1 from cron.job where jobname = 'lesson-reminders');

select cron.schedule(
  'lesson-reminders',
  '*/15 * * * *',
  $$select trigger_lesson_cron()$$
);
