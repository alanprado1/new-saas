-- Lesson ownership + dev-shared library access.
-- Run this in Supabase SQL Editor before deploying code that depends on
-- lessons.user_id and lessons.visibility.

alter table public.lessons
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists visibility text not null default 'private';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lessons_user_id_fkey'
      and conrelid = 'public.lessons'::regclass
  ) then
    alter table public.lessons
      add constraint lessons_user_id_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete set null;
  end if;
end $$;

alter table public.lessons
  drop constraint if exists lessons_visibility_check;

alter table public.lessons
  add constraint lessons_visibility_check
  check (visibility in ('private', 'dev'));

-- Existing lessons created through the old dev auto-login flow may have no
-- owner. Treat those as dev/shared so they remain visible as seed content.
update public.lessons
set visibility = 'dev'
where user_id is null;

update public.lessons l
set user_id = u.id
from auth.users u
where l.user_id is null
  and l.visibility = 'dev'
  and lower(u.email) = lower('dev@test.com');

create index if not exists lessons_user_status_created_idx
  on public.lessons (user_id, status, created_at desc);

create index if not exists lessons_visibility_status_created_idx
  on public.lessons (visibility, status, created_at desc);

create index if not exists lesson_lines_lesson_id_idx
  on public.lesson_lines (lesson_id);

alter table public.lessons enable row level security;
alter table public.lesson_lines enable row level security;

drop policy if exists "Allow authenticated read lessons" on public.lessons;
drop policy if exists "Users can read own lessons" on public.lessons;
drop policy if exists "Users can update own lessons" on public.lessons;
drop policy if exists "Users can delete own lessons" on public.lessons;
drop policy if exists "Allow authenticated read lines" on public.lesson_lines;

drop policy if exists "lessons_select_own_or_dev" on public.lessons;
create policy "lessons_select_own_or_dev"
on public.lessons
for select
to authenticated
using (
  user_id = auth.uid()
  or visibility = 'dev'
);

drop policy if exists "lessons_insert_own_private" on public.lessons;
create policy "lessons_insert_own_private"
on public.lessons
for insert
to authenticated
with check (
  user_id = auth.uid()
  and visibility = 'private'
);

drop policy if exists "lessons_update_own" on public.lessons;
create policy "lessons_update_own"
on public.lessons
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and visibility = 'private'
);

drop policy if exists "lessons_delete_own" on public.lessons;
create policy "lessons_delete_own"
on public.lessons
for delete
to authenticated
using (user_id = auth.uid());

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
      )
  )
);
