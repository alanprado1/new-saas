-- Allow the configured dev account to inspect every English lesson while keeping
-- normal users scoped to their own lessons plus dev/shared lessons.

drop policy if exists "english_lessons_select_own_or_dev" on public.english_lessons;
create policy "english_lessons_select_own_or_dev"
on public.english_lessons
for select
to authenticated
using (
  user_id = auth.uid()
  or visibility = 'dev'
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower('dev@test.com')
);

drop policy if exists "english_lesson_lines_select_visible_lessons" on public.english_lesson_lines;
create policy "english_lesson_lines_select_visible_lessons"
on public.english_lesson_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.english_lessons l
    where l.id = english_lesson_lines.lesson_id
      and (
        l.user_id = auth.uid()
        or l.visibility = 'dev'
        or lower(coalesce(auth.jwt() ->> 'email', '')) = lower('dev@test.com')
      )
  )
);
