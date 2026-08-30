-- 0019 — The inbox.
--
-- Everything the bot has ever said and been told is already in `message_log`.
-- What was missing was a way to READ it: to open one person and see the whole
-- exchange, and — when the operator decides to — to say something himself.
--
-- This does not weaken the rule in CLAUDE.md. That rule is about a human being
-- MADE to read and reply: no "talk to a human" button, no queue, nothing that
-- routes a tutor's message at the operator expecting an answer. None of that
-- is here. The bot still answers every typed question itself, nothing is
-- escalated, and no row in this table is ever work. The operator looking at a
-- transcript, and choosing on his own initiative to send a line, is the
-- opposite arrangement: he speaks when he wants to, and nobody is left waiting
-- when he doesn't.
--
-- Two things are added: a per-person summary so the list can be ordered and
-- paged in Postgres rather than by reading the whole log, and a column marking
-- the messages a human wrote rather than the bot.

-- ---------------------------------------------------------------------------
-- Who sent it. NULL for everything the bot generated, which is nearly all of
-- it; set only on a line the operator typed into the dashboard.
-- ---------------------------------------------------------------------------
alter table message_log
  add column if not exists operator_id uuid references operators(id) on delete set null;

-- ---------------------------------------------------------------------------
-- The one line a list row shows. Kept in SQL because the trigger below needs
-- it; the rich rendering of a whole transcript is pure TypeScript in
-- lib/conversations/transcript.ts, where it can be tested.
-- ---------------------------------------------------------------------------
create or replace function conversation_preview(
  p_direction message_direction,
  p_payload   jsonb
)
returns text
language sql
immutable
as $$
  select nullif(trim(
    case
      when p_direction = 'out' then p_payload->>'text'
      else coalesce(
        p_payload->'message'->>'text',
        p_payload->'message'->>'caption',
        case when p_payload->'callback_query' is not null
             then 'tapped ' || coalesce(p_payload->'callback_query'->>'data', 'a button') end,
        case when p_payload->'message'->'contact' is not null
             then 'shared their contact' end,
        case when p_payload->'message'->'document' is not null
             then 'sent ' || coalesce(p_payload->'message'->'document'->>'file_name', 'a file') end,
        case when p_payload->'message'->'photo' is not null
             then 'sent a photo' end
      )
    end
  ), '');
$$;

-- ---------------------------------------------------------------------------
-- conversations — one row per person the bot has exchanged anything with.
--
-- Derived entirely from message_log by the trigger below, so it cannot drift
-- and there is nothing to backfill by hand later. It exists because ordering
-- seven hundred people by "when did we last speak" over a growing log is a
-- scan, and this is an index.
--
-- Deliberately absent: anything resembling unread, assigned, or awaiting a
-- reply. There is no state here for a message to be IN, because a message is
-- never a task. See the note at the top of this file.
-- ---------------------------------------------------------------------------
create table if not exists conversations (
  telegram_id      bigint primary key,
  chat_id          bigint,

  last_at          timestamptz not null,
  last_direction   message_direction not null,
  last_kind        text,
  last_text        text,

  inbound_count    integer not null default 0,
  outbound_count   integer not null default 0,

  last_inbound_at  timestamptz,
  -- The last time a PERSON, not the bot, wrote to them.
  last_operator_at timestamptz,

  created_at       timestamptz not null default now()
);

create index if not exists conversations_last_at_idx on conversations (last_at desc);
-- Powers the "they spoke last" filter, which is an ordinary filter the
-- operator may choose — not a queue, and never a default.
create index if not exists conversations_inbound_last_idx
  on conversations (last_at desc) where last_direction = 'in';

alter table conversations enable row level security;

create policy conversations_operator_select on conversations
  for select using (exists (select 1 from operators o where o.id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Maintained on write. A trigger rather than a second insert from logMessage()
-- because logMessage is best-effort and swallows its own errors: a summary
-- updated separately would quietly fall behind the log it claims to summarise.
-- ---------------------------------------------------------------------------
create or replace function touch_conversation()
returns trigger
language plpgsql
as $$
begin
  -- Channel posts and anything else with no person attached.
  if new.telegram_id is null then
    return new;
  end if;

  insert into conversations as c (
    telegram_id, chat_id, last_at, last_direction, last_kind, last_text,
    inbound_count, outbound_count, last_inbound_at, last_operator_at
  )
  values (
    new.telegram_id,
    new.chat_id,
    new.created_at,
    new.direction,
    new.kind,
    conversation_preview(new.direction, new.payload),
    case when new.direction = 'in'  then 1 else 0 end,
    case when new.direction = 'out' then 1 else 0 end,
    case when new.direction = 'in'  then new.created_at end,
    case when new.operator_id is not null then new.created_at end
  )
  on conflict (telegram_id) do update set
    chat_id = coalesce(excluded.chat_id, c.chat_id),
    -- Rows normally arrive in order, but a backfill or a retry must not be
    -- allowed to make an older message look like the latest word.
    last_at        = greatest(c.last_at, excluded.last_at),
    last_direction = case when excluded.last_at >= c.last_at then excluded.last_direction else c.last_direction end,
    last_kind      = case when excluded.last_at >= c.last_at then excluded.last_kind      else c.last_kind      end,
    last_text      = case when excluded.last_at >= c.last_at then excluded.last_text      else c.last_text      end,
    inbound_count    = c.inbound_count  + excluded.inbound_count,
    outbound_count   = c.outbound_count + excluded.outbound_count,
    last_inbound_at  = greatest(c.last_inbound_at,  excluded.last_inbound_at),
    last_operator_at = greatest(c.last_operator_at, excluded.last_operator_at);

  return new;
end;
$$;

drop trigger if exists message_log_touch_conversation on message_log;
create trigger message_log_touch_conversation
  after insert on message_log
  for each row execute function touch_conversation();

-- ---------------------------------------------------------------------------
-- Everything logged before this migration existed. One pass, newest row per
-- person wins the "last" columns.
-- ---------------------------------------------------------------------------
insert into conversations (
  telegram_id, chat_id, last_at, last_direction, last_kind, last_text,
  inbound_count, outbound_count, last_inbound_at
)
select
  m.telegram_id,
  (array_agg(m.chat_id   order by m.created_at desc, m.id desc))[1],
  max(m.created_at),
  (array_agg(m.direction order by m.created_at desc, m.id desc))[1],
  (array_agg(m.kind      order by m.created_at desc, m.id desc))[1],
  (array_agg(conversation_preview(m.direction, m.payload)
             order by m.created_at desc, m.id desc))[1],
  count(*) filter (where m.direction = 'in'),
  count(*) filter (where m.direction = 'out'),
  max(m.created_at) filter (where m.direction = 'in')
from message_log m
where m.telegram_id is not null
group by m.telegram_id
on conflict (telegram_id) do nothing;
