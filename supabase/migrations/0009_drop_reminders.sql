-- 0009 — Remove lesson reminders and timesheets
--
-- Reverses the reminder half of step 9 at the operator's request: billing is a
-- flat monthly rate, so counting hours per lesson was work nobody asked for.
-- Placements stay — they record who teaches whom, at what rate, on what split,
-- which is what invoices at step 10 need. The schedule stays as a note of what
-- was agreed; the system no longer drives it.

select cron.unschedule('lesson-reminders')
where exists (select 1 from cron.job where jobname = 'lesson-reminders');

drop function if exists trigger_lesson_cron();
drop table if exists internal_config;
drop table if exists sessions;
drop type if exists session_status;
delete from settings where key = 'reminders';
