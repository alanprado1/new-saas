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

revoke execute on function public.reserve_google_tts_characters(integer, integer, date) from public, anon, authenticated;
grant execute on function public.reserve_google_tts_characters(integer, integer, date) to service_role;
