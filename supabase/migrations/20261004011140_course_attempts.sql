-- Course data only. Evaluation lives in the authenticated app server.
-- Filename aligned with the verified Supabase migration history after application.
-- Client roles can read their own rows; only the server role can commit results.
begin;
create table public.course_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  content_version text not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  revision integer not null default 0 check (revision >= 0 and revision <= 5000),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  completed_at timestamptz,
  active boolean not null default true,
  is_restart boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, user_id)
);
create unique index course_attempts_active on public.course_attempts(user_id, record_id) where active;
create index course_attempts_completed on public.course_attempts(user_id, record_id) where completed_at is not null;
create table public.course_attempt_events (
  attempt_id uuid not null,
  user_id uuid not null,
  sequence integer not null check (sequence > 0 and sequence <= 5000),
  request_id uuid not null,
  action jsonb not null check (jsonb_typeof(action) = 'object'),
  created_at timestamptz not null default now(),
  primary key(attempt_id, sequence),
  unique(attempt_id, request_id),
  foreign key(attempt_id, user_id) references public.course_attempts(id, user_id) on delete cascade
);
create index course_attempt_events_owner on public.course_attempt_events(user_id);
alter table public.course_attempts enable row level security;
alter table public.course_attempt_events enable row level security;
revoke all on public.course_attempts, public.course_attempt_events from public, anon, authenticated;
grant select on public.course_attempts, public.course_attempt_events to authenticated;
grant select, insert, update, delete on public.course_attempts, public.course_attempt_events to service_role;
create policy course_attempts_owner_read on public.course_attempts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy course_attempt_events_owner_read on public.course_attempt_events for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.course_start_attempt(
  p_id uuid, p_user uuid, p_record text, p_version text, p_hash text,
  p_restart boolean, p_state jsonb, p_result jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.course_attempts;
begin
  -- Serializes starts/restarts for this owner and lesson, including the first insert.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text || ':' || p_record, 0));
  select * into a from public.course_attempts where id = p_id;
  if found then
    if a.user_id <> p_user or a.record_id <> p_record or a.content_version <> p_version or a.content_hash <> p_hash or a.is_restart <> p_restart or not a.active then
      raise exception 'Attempt start conflict';
    end if;
    return to_jsonb(a);
  end if;
  if not p_restart then
    select * into a from public.course_attempts where user_id = p_user and record_id = p_record and active;
    if found then return to_jsonb(a); end if;
  end if;
  update public.course_attempts set active = false, updated_at = now() where user_id = p_user and record_id = p_record and active;
  insert into public.course_attempts(id,user_id,record_id,content_version,content_hash,state,result,is_restart)
    values(p_id,p_user,p_record,p_version,p_hash,p_state,p_result,p_restart) returning * into a;
  return to_jsonb(a);
end $$;

create function public.course_save_event(
  p_attempt uuid, p_user uuid, p_request uuid, p_sequence integer, p_action jsonb,
  p_version text, p_hash text, p_state jsonb, p_result jsonb, p_complete boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.course_attempts; e public.course_attempt_events;
begin
  select * into a from public.course_attempts where id = p_attempt and user_id = p_user for update;
  if not found then raise exception 'Attempt not found'; end if;
  if not a.active then raise exception 'Attempt was restarted'; end if;
  if a.content_version <> p_version or a.content_hash <> p_hash then raise exception 'Content version conflict'; end if;
  select * into e from public.course_attempt_events where attempt_id = p_attempt and request_id = p_request;
  if found then
    if e.sequence <> p_sequence or e.action <> p_action then raise exception 'Conflicting duplicate request'; end if;
    return to_jsonb(a);
  end if;
  if a.completed_at is not null or p_sequence <> a.revision + 1 then raise exception 'Event order conflict'; end if;
  insert into public.course_attempt_events(attempt_id,user_id,sequence,request_id,action)
    values(p_attempt,p_user,p_sequence,p_request,p_action);
  update public.course_attempts set revision = p_sequence, state = p_state, result = p_result,
    completed_at = case when p_complete then now() else null end, updated_at = now()
    where id = p_attempt returning * into a;
  return to_jsonb(a);
end $$;
revoke all on function public.course_start_attempt(uuid,uuid,text,text,text,boolean,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.course_save_event(uuid,uuid,uuid,integer,jsonb,text,text,jsonb,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.course_start_attempt(uuid,uuid,text,text,text,boolean,jsonb,jsonb) to service_role;
grant execute on function public.course_save_event(uuid,uuid,uuid,integer,jsonb,text,text,jsonb,jsonb,boolean) to service_role;
commit;
