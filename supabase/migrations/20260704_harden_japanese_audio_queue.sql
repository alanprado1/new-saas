-- Japanese lessons use the legacy `lessons` table while English lessons use
-- `english_lessons`, which was created with realtime + updated_at support from
-- the start. Keep the Japanese table equally worker-friendly so audio jobs do
-- not remain in `generating_audio` when the realtime event is missed.

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

-- Send full rows for UPDATE events. This helps both the audio worker and the
-- dashboard listener reliably see `id`, `status`, and `error_message`.
alter table public.lessons replica identity full;

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
