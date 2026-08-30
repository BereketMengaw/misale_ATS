-- 0020 — Reading the CV (build plan step 5)
--
-- `cv_text` and `cv_parsed` have been on `candidates` since 0004, unwritten:
-- the wizard collects every field by button, so a CV started as evidence a
-- human reads and nothing needed to interpret it. This is the second half of
-- step 5 — "optional parsing → merge, conflicts flagged" — and what it needs
-- beyond those two columns is the provenance of a reading.
--
-- Three questions have to be answerable from the row itself, without opening
-- the jsonb:
--
--   * has this CV been read, and when
--   * which file was read — a tutor who sends a better CV gets a new
--     `cv_path`, and last month's reading is then about a document that is no
--     longer on the profile
--   * what read it, so a reading made by a model that has since been changed
--     is not mistaken for one made by the current one
--
-- The reading itself stays in `cv_parsed`: the facts, the fields it filled, the
-- ones it confirmed, and the ones where it disagrees with what the tutor
-- answered. A disagreement is never written to the profile. The tutor's buttons
-- are their own statement and a CV is evidence about them, so parsing only ever
-- fills a field they left empty; everything else is put in front of the
-- operator, who has the file open beside it.

-- `cv_text` stays unwritten, and is left in place rather than dropped. The
-- reader works on the document itself — Gemini takes a PDF or a photograph
-- directly, which is why there is no OCR step anywhere in this codebase — so a
-- transcript of the CV would be output tokens spent on something no query reads.
-- The column is where one would go if searching CV bodies ever earns its cost.

alter table candidates
  add column if not exists cv_parsed_at   timestamptz,
  -- The value `cv_path` had when the reading was made. Compared with the
  -- current one to tell a fresh reading from one about a replaced file, and to
  -- keep the same document from being sent to a model twice.
  add column if not exists cv_parsed_from text,
  add column if not exists cv_parsed_by   text;

comment on column candidates.cv_parsed is
  'The reading of the CV: facts, fills, confirmations and conflicts. Conflicts are never applied to the profile.';
