alter table public.lessons
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_lessons_updated_at on public.lessons;
create trigger touch_lessons_updated_at
before update on public.lessons
for each row
execute function public.touch_updated_at();

create index if not exists lessons_status_updated_idx
  on public.lessons (status, updated_at);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lessons'
  ) then
    alter publication supabase_realtime add table public.lessons;
  end if;
end $$;
