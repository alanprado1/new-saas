-- Cover the composite owner foreign key without changing any learner rows.
-- Filename aligned with the verified Supabase migration history after application.
create index course_attempt_events_attempt_owner on public.course_attempt_events(attempt_id, user_id);
