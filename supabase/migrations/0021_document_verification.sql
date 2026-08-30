-- 0021 — Checking the educational documents
--
-- 0015 gave the documents somewhere to live and the profile page a link to
-- open each one. Whether the degree a tutor sent is a degree, and whether it is
-- theirs, was left to the operator's eye — which in practice means it was left
-- undone, because opening four scans per applicant is exactly the work nobody
-- does when there are twenty applicants.
--
-- What is stored here is a reading of the paper, not a judgement of the person.
-- The check compares two things the tutor and the document each say about a
-- qualification, and reports whether they agree. It cannot tell a forged
-- certificate from a real one, nothing in the code claims it can, and no
-- verdict is ever written back onto `candidates.education` — that column is the
-- tutor's own answer, and a document that fails to back it is something for the
-- operator to look at rather than a correction to apply.
--
-- The verdict a check produces is one of:
--   backs           the certificate is for the level they answered, or higher
--   short           it is for a lower level than they answered
--   name-mismatch   the name printed on it is not theirs
--   unclaimed       there is no education on the profile to check against
--   inconclusive    a real document that says nothing about the level
--   not-a-document  the file is not educational at all
--
-- Only the first three and the last are worth anybody's attention; the others
-- are recorded so the same file is never sent to a model twice.

alter table candidate_documents
  add column if not exists verified_at   timestamptz,
  add column if not exists verified_by   text,
  add column if not exists verification  jsonb;

comment on column candidate_documents.verification is
  'What the document says and whether it backs the tutor''s answer. Never applied to the profile, and never a judgement of authenticity.';

-- The operator's real question is "is there anything wrong with this person's
-- papers", so the rows worth surfacing are the ones with a verdict that needs
-- looking at. Partial, because they are a small minority of the table.
create index if not exists candidate_documents_attention_idx
  on candidate_documents (candidate_id)
  where verification->>'verdict' in ('name-mismatch', 'short', 'not-a-document');
