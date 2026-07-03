create table if not exists public.english_lessons (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scenario text not null,
  scenario_hash text,
  level text not null,
  status text not null default 'queued',
  voice_id integer,
  user_id uuid references auth.users(id) on delete set null,
  visibility text not null default 'private',
  background_tag text,
  background_image_url text,
  structured_content jsonb,
  error_message text,
  learning_direction text not null default 'en-ja',
  target_language text not null default 'en',
  support_language text not null default 'ja',
  generation_provider text not null default 'groq',
  tts_provider text not null default 'kokoro',
  image_provider text not null default 'pollinations',
  image_model text not null default 'klein',
  constraint english_lessons_visibility_check check (visibility in ('private', 'dev')),
  constraint english_lessons_learning_direction_check check (learning_direction = 'en-ja'),
  constraint english_lessons_target_language_check check (target_language = 'en'),
  constraint english_lessons_support_language_check check (support_language = 'ja'),
  constraint english_lessons_image_provider_check check (image_provider in ('pollinations', 'gemini'))
);

create table if not exists public.english_lesson_lines (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.english_lessons(id) on delete cascade,
  order_index integer not null,
  speaker text not null,
  kanji text not null,
  romaji text not null,
  english text not null,
  highlights jsonb not null default '[]'::jsonb,
  audio_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.english_vocabulary (
  id uuid primary key default gen_random_uuid(),
  level text not null,
  word text not null,
  reading text,
  meaning text not null,
  example_en text not null,
  example_jp text not null,
  example_romaji text,
  created_at timestamptz not null default now()
);

create table if not exists public.english_user_card_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  level text,
  repetition integer not null default 0,
  interval integer not null default 0,
  ease_factor numeric not null default 2.5,
  next_review date not null default current_date,
  last_reviewed timestamptz not null default now(),
  learning_direction text not null default 'en-ja',
  primary key (user_id, card_id),
  constraint english_user_card_progress_direction_check check (learning_direction = 'en-ja')
);

create index if not exists english_lessons_user_status_created_idx
  on public.english_lessons (user_id, status, created_at desc);

create index if not exists english_lessons_visibility_status_created_idx
  on public.english_lessons (visibility, status, created_at desc);

create index if not exists english_lessons_scenario_hash_idx
  on public.english_lessons (scenario_hash);

create index if not exists english_lesson_lines_lesson_id_idx
  on public.english_lesson_lines (lesson_id);

create index if not exists english_vocabulary_level_idx
  on public.english_vocabulary (level);

create index if not exists english_user_card_progress_next_review_idx
  on public.english_user_card_progress (user_id, level, next_review);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_english_lessons_updated_at on public.english_lessons;
create trigger touch_english_lessons_updated_at
before update on public.english_lessons
for each row
execute function public.touch_updated_at();

alter table public.english_lessons enable row level security;
alter table public.english_lesson_lines enable row level security;
alter table public.english_vocabulary enable row level security;
alter table public.english_user_card_progress enable row level security;

drop policy if exists "english_lessons_select_own_or_dev" on public.english_lessons;
create policy "english_lessons_select_own_or_dev"
on public.english_lessons
for select
to authenticated
using (
  user_id = auth.uid()
  or visibility = 'dev'
);

drop policy if exists "english_lessons_insert_own_private" on public.english_lessons;
create policy "english_lessons_insert_own_private"
on public.english_lessons
for insert
to authenticated
with check (
  user_id = auth.uid()
  and visibility in ('private', 'dev')
);

drop policy if exists "english_lessons_update_own" on public.english_lessons;
create policy "english_lessons_update_own"
on public.english_lessons
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "english_lessons_delete_own" on public.english_lessons;
create policy "english_lessons_delete_own"
on public.english_lessons
for delete
to authenticated
using (user_id = auth.uid());

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
      and (l.user_id = auth.uid() or l.visibility = 'dev')
  )
);

drop policy if exists "english_vocabulary_select_authenticated" on public.english_vocabulary;
create policy "english_vocabulary_select_authenticated"
on public.english_vocabulary
for select
to authenticated
using (true);

drop policy if exists "english_user_card_progress_select_own" on public.english_user_card_progress;
create policy "english_user_card_progress_select_own"
on public.english_user_card_progress
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "english_user_card_progress_upsert_own" on public.english_user_card_progress;
create policy "english_user_card_progress_upsert_own"
on public.english_user_card_progress
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'english_lessons'
  ) then
    alter publication supabase_realtime add table public.english_lessons;
  end if;
end $$;
