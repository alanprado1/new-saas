-- Prepare SRS progress for multiple learning directions without changing the
-- existing user_id/card_id uniqueness contract.

alter table public.user_card_progress
  add column if not exists learning_direction text default 'ja-en';

update public.user_card_progress
set learning_direction = 'ja-en'
where learning_direction is null;

alter table public.user_card_progress
  drop constraint if exists user_card_progress_learning_direction_check;

alter table public.user_card_progress
  add constraint user_card_progress_learning_direction_check
  check (learning_direction in ('ja-en', 'en-ja'));

create index if not exists user_card_progress_direction_due_idx
  on public.user_card_progress (user_id, learning_direction, next_review);

alter table public.lessons
  add column if not exists learning_direction text default 'ja-en',
  add column if not exists target_language text default 'ja',
  add column if not exists support_language text default 'en',
  add column if not exists generation_provider text default 'gemini',
  add column if not exists tts_provider text default 'voicevox';

update public.lessons
set
  learning_direction = coalesce(learning_direction, 'ja-en'),
  target_language = coalesce(target_language, 'ja'),
  support_language = coalesce(support_language, 'en'),
  generation_provider = coalesce(generation_provider, 'gemini'),
  tts_provider = coalesce(tts_provider, 'voicevox');

alter table public.lessons
  drop constraint if exists lessons_learning_direction_check,
  drop constraint if exists lessons_target_language_check,
  drop constraint if exists lessons_support_language_check;

alter table public.lessons
  add constraint lessons_learning_direction_check
  check (learning_direction in ('ja-en', 'en-ja')),
  add constraint lessons_target_language_check
  check (target_language in ('ja', 'en')),
  add constraint lessons_support_language_check
  check (support_language in ('ja', 'en'));

create index if not exists lessons_direction_status_created_idx
  on public.lessons (learning_direction, status, created_at desc);
