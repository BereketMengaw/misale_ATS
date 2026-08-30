-- 0014 — A tutor saying they are stopping
--
-- The one message that must reach the operator. The design rule says nothing
-- routes a message to a human expecting a reply, and this does not: it is a
-- fact to record, not a conversation to hold. The bot answers the tutor itself
-- and files this so the family is not left without anyone.

create table quit_notices (
  id            bigserial primary key,

  candidate_id  bigint references candidates(id) on delete cascade,
  placement_id  bigint references placements(id) on delete set null,
  telegram_id   bigint,

  -- What they actually typed, kept whole: the wording is how the operator
  -- judges whether this is next week or right now.
  message       text not null,

  handled_at    timestamptz,
  handled_by    uuid references operators(id),

  created_at    timestamptz not null default now()
);

-- One open notice per placement. Somebody who says it three times is one
-- family about to lose a tutor, not three.
create unique index quit_notices_one_open_idx
  on quit_notices (placement_id)
  where handled_at is null and placement_id is not null;

create index quit_notices_open_idx on quit_notices (created_at desc) where handled_at is null;

alter table quit_notices enable row level security;
create policy quit_notices_operator_select on quit_notices
  for select using (exists (select 1 from operators o where o.id = auth.uid()));
create policy quit_notices_operator_update on quit_notices
  for update using (exists (select 1 from operators o where o.id = auth.uid()));
