-- Allow the configured dev account to inspect every Japanese lesson while
-- keeping normal users scoped to their own lessons plus dev/shared lessons.

drop policy if exists "lessons_select_own_or_dev" on public.lessons;
create policy "lessons_select_own_or_dev"
on public.lessons
for select
to authenticated
using (
  user_id = auth.uid()
  or visibility = 'dev'
  or lower(coalesce(auth.jwt() ->> 'email', '')) = lower('dev@test.com')
);

drop policy if exists "lesson_lines_select_visible_lessons" on public.lesson_lines;
create policy "lesson_lines_select_visible_lessons"
on public.lesson_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.lessons l
    where l.id = lesson_lines.lesson_id
      and (
        l.user_id = auth.uid()
        or l.visibility = 'dev'
        or lower(coalesce(auth.jwt() ->> 'email', '')) = lower('dev@test.com')
      )
  )
);
