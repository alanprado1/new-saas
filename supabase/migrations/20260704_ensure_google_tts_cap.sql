create table if not exists public.google_tts_monthly_usage (
  month_start date primary key,
  character_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint google_tts_monthly_usage_nonnegative check (character_count >= 0)
);

alter table public.english_lessons
  alter column tts_provider set default 'google';

create table if not exists public.google_tts_usage_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  month_start date not null,
  lesson_id uuid,
  line_id uuid,
  character_count integer not null,
  provider text not null default 'google_chirp3_hd',
  voice_name text,
  model text,
  constraint google_tts_usage_events_character_count_positive check (character_count > 0)
);

create index if not exists google_tts_usage_events_month_start_idx
  on public.google_tts_usage_events (month_start, created_at);

alter table public.google_tts_monthly_usage enable row level security;
alter table public.google_tts_usage_events enable row level security;

drop policy if exists "google_tts_monthly_usage_service_only" on public.google_tts_monthly_usage;
create policy "google_tts_monthly_usage_service_only"
on public.google_tts_monthly_usage
for all
using (false)
with check (false);

drop policy if exists "google_tts_usage_events_service_only" on public.google_tts_usage_events;
create policy "google_tts_usage_events_service_only"
on public.google_tts_usage_events
for all
using (false)
with check (false);

create or replace function public.reserve_google_tts_characters(
  p_character_count integer,
  p_hard_cap integer default 980000,
  p_month_start date default date_trunc('month', timezone('utc', now()))::date
)
returns table (
  allowed boolean,
  month_start date,
  previous_total integer,
  new_total integer,
  hard_cap integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_total integer;
begin
  if p_character_count is null or p_character_count <= 0 then
    raise exception 'p_character_count must be positive';
  end if;

  if p_hard_cap is null or p_hard_cap <= 0 then
    raise exception 'p_hard_cap must be positive';
  end if;

  insert into public.google_tts_monthly_usage (month_start, character_count)
  values (p_month_start, 0)
  on conflict on constraint google_tts_monthly_usage_pkey do nothing;

  select u.character_count
    into v_previous_total
  from public.google_tts_monthly_usage u
  where u.month_start = p_month_start
  for update;

  if v_previous_total + p_character_count > p_hard_cap then
    return query select false, p_month_start, v_previous_total, v_previous_total, p_hard_cap;
    return;
  end if;

  update public.google_tts_monthly_usage u
  set character_count = u.character_count + p_character_count,
      updated_at = now()
  where u.month_start = p_month_start;

  return query select true, p_month_start, v_previous_total, v_previous_total + p_character_count, p_hard_cap;
end;
$$;

create or replace function public.release_google_tts_characters(
  p_character_count integer,
  p_month_start date default date_trunc('month', timezone('utc', now()))::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_total integer;
begin
  if p_character_count is null or p_character_count <= 0 then
    raise exception 'p_character_count must be positive';
  end if;

  update public.google_tts_monthly_usage u
  set character_count = greatest(0, character_count - p_character_count),
      updated_at = now()
  where u.month_start = p_month_start
  returning character_count into v_new_total;

  return coalesce(v_new_total, 0);
end;
$$;

create or replace function public.record_google_tts_usage_event(
  p_character_count integer,
  p_lesson_id uuid default null,
  p_line_id uuid default null,
  p_voice_name text default null,
  p_model text default null,
  p_month_start date default date_trunc('month', timezone('utc', now()))::date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if p_character_count is null or p_character_count <= 0 then
    raise exception 'p_character_count must be positive';
  end if;

  insert into public.google_tts_usage_events (
    month_start,
    lesson_id,
    line_id,
    character_count,
    voice_name,
    model
  )
  values (
    p_month_start,
    p_lesson_id,
    p_line_id,
    p_character_count,
    p_voice_name,
    p_model
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke execute on function public.reserve_google_tts_characters(integer, integer, date) from public, anon, authenticated;
revoke execute on function public.release_google_tts_characters(integer, date) from public, anon, authenticated;
revoke execute on function public.record_google_tts_usage_event(integer, uuid, uuid, text, text, date) from public, anon, authenticated;

grant execute on function public.reserve_google_tts_characters(integer, integer, date) to service_role;
grant execute on function public.release_google_tts_characters(integer, date) to service_role;
grant execute on function public.record_google_tts_usage_event(integer, uuid, uuid, text, text, date) to service_role;
