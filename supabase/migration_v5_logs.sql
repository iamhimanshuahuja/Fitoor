-- v5: login history + feature activity log. Safe to re-run.
-- Clients and the coach can READ these; nobody writes them from the browser.
--   login_events  ← written only by the `track` edge function (service role), so IP/location can't be faked
--   activity_logs ← written by triggers on the data tables, and by the `ai` edge function for AI calls

create table if not exists public.login_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  event       text not null check (event in ('sign_in', 'sign_up', 'session_resume', 'sign_out')),
  ip          text,
  city        text,
  region      text,
  country     text,
  isp         text,
  device      text,
  user_agent  text,
  remember    boolean,
  created_at  timestamptz not null default now()
);
create index if not exists login_events_user_time on public.login_events (user_id, created_at desc);
alter table public.login_events enable row level security;
revoke insert, update, delete on public.login_events from authenticated, anon;
grant select on public.login_events to authenticated;
drop policy if exists le_read on public.login_events;
create policy le_read on public.login_events for select using (user_id = auth.uid() or public.is_admin());

create table if not exists public.activity_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.profiles(id) on delete cascade,
  actor_id    uuid,
  action      text not null,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists activity_logs_user_time on public.activity_logs (user_id, created_at desc);
alter table public.activity_logs enable row level security;
revoke insert, update, delete on public.activity_logs from authenticated, anon;
grant select on public.activity_logs to authenticated;
drop policy if exists al_read on public.activity_logs;
create policy al_read on public.activity_logs for select using (user_id = auth.uid() or public.is_admin());

-- One trigger function for every tracked table. Action = <table>_<insert|update|delete>.
create or replace function public.log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare d jsonb; uid uuid;
begin
  d := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  uid := (d->>'user_id')::uuid;
  if uid is null then return null; end if;              -- templates etc.
  if tg_op = 'UPDATE' and tg_table_name = 'habit_logs' then return null; end if; -- ticks are too chatty
  insert into public.activity_logs (user_id, actor_id, action, detail)
  values (uid, auth.uid(), tg_table_name || '_' || lower(tg_op), jsonb_strip_nulls(jsonb_build_object(
    'date',    coalesce(d->>'log_date', d->>'day', d->>'report_date'),
    'slot',    d->>'slot',
    'kg',      d->>'weight_kg',
    'photo',   case when d->>'photo_path' is not null then true end,
    'source',  coalesce(d->'ai'->>'source', d->>'source'),
    'label',   d->>'day_label',
    'lab',     d->>'lab_name',
    'context', d->>'context',
    'status',  d->>'status',
    'request', d->>'request_status',
    'by_coach', case when auth.uid() is not null and auth.uid() <> uid then true end
  )));
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['meal_logs', 'weight_logs', 'habit_logs', 'workouts', 'lab_reports', 'comments', 'juice_days', 'diet_plans'] loop
    execute format('drop trigger if exists log_activity on public.%I', t);
    execute format('create trigger log_activity after insert or update or delete on public.%I for each row execute function public.log_activity()', t);
  end loop;
end $$;

select 'v5 ok' as status;
