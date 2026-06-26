-- Track which backend generated each lesson background.

alter table public.lessons
  add column if not exists image_provider text not null default 'pollinations',
  add column if not exists image_model text not null default 'klein';

alter table public.lessons
  alter column image_provider set default 'pollinations',
  alter column image_model set default 'klein';

alter table public.lessons
  drop constraint if exists lessons_image_provider_check;

update public.lessons
set image_provider = coalesce(nullif(image_provider, ''), 'pollinations'),
    image_model = coalesce(nullif(image_model, ''), 'klein');

alter table public.lessons
  alter column image_provider set not null,
  alter column image_model set not null;

alter table public.lessons
  add constraint lessons_image_provider_check
  check (image_provider in ('pollinations', 'gemini'));
