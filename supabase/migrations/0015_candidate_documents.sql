-- 0015 — Educational documents
--
-- The CV is one file and optional. A degree, a transcript and a grade 12
-- certificate are several, and the operator was already asking for them by
-- hand: "send your educational documents" is one of his most-repeated
-- messages, and people replied with "9-12 transcript" and "here is my CV"
-- into a bot that had nowhere to put either.

create table candidate_documents (
  id            bigserial primary key,
  candidate_id  bigint not null references candidates(id) on delete cascade,

  -- Path inside the existing cvs bucket. Same bucket, different prefix: the
  -- files are the same kind of thing and the access rules are identical.
  path          text not null,
  file_name     text,
  mime          text,

  created_at    timestamptz not null default now()
);

create index candidate_documents_candidate_idx
  on candidate_documents (candidate_id, created_at);

-- Re-registering replaces the profile, and it must replace the documents with
-- it rather than leaving last month's transcript attached to this month's answers.
create unique index candidate_documents_dedupe_idx on candidate_documents (candidate_id, path);

alter table candidate_documents enable row level security;
create policy candidate_documents_operator_select on candidate_documents
  for select using (exists (select 1 from operators o where o.id = auth.uid()));
