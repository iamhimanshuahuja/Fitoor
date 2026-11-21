-- v4: juice days are booked per client by the coach (not a plan feature anymore)
-- Safe to re-run.

create table if not exists public.juice_days (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  day            date not null,
  note           text,
  status         text not null default 'scheduled' check (status in ('scheduled', 'done', 'missed')),
  request_day    date,
  request_reason text,
  request_status text check (request_status in ('pending', 'approved', 'declined')),
  request_at     timestamptz,
  created_by     uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (user_id, day)
);
create index if not exists juice_days_user_day on public.juice_days (user_id, day);

alter table public.juice_days enable row level security;
grant select, insert, update, delete on public.juice_days to authenticated;

drop policy if exists jd_admin_all on public.juice_days;
create policy jd_admin_all on public.juice_days for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists jd_own_select on public.juice_days;
create policy jd_own_select on public.juice_days for select using (user_id = auth.uid());
drop policy if exists jd_own_update on public.juice_days;
create policy jd_own_update on public.juice_days for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Clients may only: ask for another date (request_day / request_reason → pending) or mark the day done.
create or replace function public.guard_juice_day() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  new.user_id := old.user_id; new.day := old.day; new.note := old.note; new.created_by := old.created_by;
  if new.status not in ('scheduled', 'done') then new.status := old.status; end if;
  if new.request_day is distinct from old.request_day or new.request_reason is distinct from old.request_reason then
    if new.request_day is not null and new.request_day < current_date then
      raise exception 'Pick a date from today onwards';
    end if;
    new.request_status := case when new.request_day is null then null else 'pending' end;
    new.request_at := now();
  else
    new.request_status := old.request_status; new.request_at := old.request_at;
  end if;
  return new;
end $$;
drop trigger if exists guard_juice_day on public.juice_days;
create trigger guard_juice_day before update on public.juice_days for each row execute function public.guard_juice_day();

-- On a juice day the client can't log other food (the coach still can, e.g. to record a slip).
create or replace function public.block_food_on_juice_day() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and exists (
    select 1 from public.juice_days j where j.user_id = new.user_id and j.day = new.log_date and j.status <> 'missed'
  ) then
    raise exception 'Juice day: only juices today. Talk to your coach if you need to eat.';
  end if;
  return new;
end $$;
drop trigger if exists block_food_on_juice_day on public.meal_logs;
create trigger block_food_on_juice_day before insert on public.meal_logs for each row execute function public.block_food_on_juice_day();

-- Juices are no longer switched on by a plan; the coach books days per client instead.
update public.plans set features = array_remove(features, 'juices');
delete from public.user_features where feature = 'juices';

select 'v4 ok' as status;
