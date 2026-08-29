-- 0006 — Talent-pool DMs (build plan step 8)
-- A tutor who registered months ago and was not hired is an asset, not a
-- dead record. When a new job fits them, the bot may message them — which is
-- exactly what the consent at registration covers.

create table talent_matches (
  id           bigserial primary key,
  job_post_id  bigint not null references job_posts(id) on delete cascade,
  candidate_id bigint not null references candidates(id) on delete cascade,

  score        numeric(6,2) not null,
  sent_at      timestamptz,
  -- set when they apply from the DM, which is what makes the channel worth having
  applied_at   timestamptz,
  error        text,

  created_at   timestamptz not null default now(),

  -- Nobody is messaged twice about the same job.
  unique (job_post_id, candidate_id)
);

create index talent_matches_candidate_idx on talent_matches (candidate_id, sent_at desc);
create index talent_matches_job_idx on talent_matches (job_post_id);

alter table talent_matches enable row level security;

create policy talent_matches_operator_select on talent_matches
  for select using (exists (select 1 from operators o where o.id = auth.uid()));

-- How aggressive the matching is, tunable without a deploy.
insert into settings (key, value) values
  ('talent_match', '{"min_score":60,"max_per_job":10,"cooldown_days":3}'::jsonb)
on conflict (key) do nothing;
