-- 0013 — Answered questions
--
-- The bot answers a typed question itself. Every one is kept: it is the
-- rate limit, the cache that keeps the model on its free tier, and the list
-- of things tutors ask that the knowledge base does not yet cover.

create table bot_answers (
  id            bigserial primary key,

  telegram_id   bigint,
  chat_id       bigint,

  -- Exactly what they typed, and the normalized form the cache is keyed on.
  question      text not null,
  question_norm text not null,

  -- Which knowledge entries were retrieved, so a bad answer can be traced to
  -- the facts it was built from rather than guessed at.
  matched_ids   text[] not null default '{}',

  covered       boolean not null default false,
  answer        text not null default '',

  -- 'template', a provider name, 'cache' or 'rate-limited'.
  source        text not null,

  created_at    timestamptz not null default now()
);

-- The cache: the same question from anyone, answered once.
create index bot_answers_cache_idx
  on bot_answers (question_norm, created_at desc)
  where covered;

-- The rate limit, per person per hour.
create index bot_answers_rate_idx on bot_answers (telegram_id, created_at desc);

-- What the operator should add to lib/bot/answers/knowledge.ts next.
create index bot_answers_uncovered_idx
  on bot_answers (created_at desc)
  where not covered;

alter table bot_answers enable row level security;
create policy bot_answers_operator_select on bot_answers
  for select using (exists (select 1 from operators o where o.id = auth.uid()));
