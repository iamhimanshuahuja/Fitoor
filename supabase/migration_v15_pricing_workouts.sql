-- v15: AI pricing tiers + per-person offers, and one workout per day + label. Idempotent, safe to re-run.
-- Run AFTER migration_v14_juice_day_food.sql.

-- ---------------------------------------------------------------- tiers (editable by the super admin)
create table if not exists public.ai_tiers (
  key          text primary key,                 -- free / plus / pro (or any new key)
  name         text not null,
  price_inr    integer not null default 0,       -- per month
  chat_per_day integer not null default 3,       -- AI chat logs + Ask AI questions per day
  can_ask      boolean not null default false,   -- "Ask AI" anywhere in the app (coaches: about their clients)
  blurb        text,
  sort         integer not null default 0,
  active       boolean not null default true,    -- shown on the pricing page
  updated_at   timestamptz not null default now()
);
insert into public.ai_tiers (key, name, price_inr, chat_per_day, can_ask, blurb, sort) values
  ('free', 'Free', 0, 3, false, null, 1),
  ('plus', 'Plus', 999, 19, false, null, 2),
  ('pro',  'Pro', 1999, 50, true, null, 3)
on conflict (key) do nothing;

alter table public.ai_tiers enable row level security;
grant select on public.ai_tiers to anon, authenticated;
grant insert, update, delete on public.ai_tiers to authenticated;
drop policy if exists ai_tiers_read on public.ai_tiers;
drop policy if exists ai_tiers_write on public.ai_tiers;
create policy ai_tiers_read on public.ai_tiers for select to anon, authenticated using (true);
create policy ai_tiers_write on public.ai_tiers for all to authenticated using (public.is_super()) with check (public.is_super());

-- ---------------------------------------------------------------- per person (client or coach)
alter table public.profiles add column if not exists tier text not null default 'free';
alter table public.profiles add column if not exists tier_until date;            -- offer end; after it → free
alter table public.profiles add column if not exists ai_chat_limit integer;      -- custom daily limit (overrides tier)
alter table public.profiles add column if not exists ai_ask boolean;             -- custom Ask AI on/off (overrides tier)
alter table public.profiles add column if not exists tier_price integer;         -- custom price agreed (₹/month), for records
alter table public.profiles add column if not exists tier_note text;             -- e.g. "Diwali offer, 3 months"
alter table public.profiles add column if not exists tier_requested text;        -- set by the person: wants plus / pro
alter table public.profiles add column if not exists tier_requested_at timestamptz;

-- Only the super admin changes plans / offers. People may only ask for an upgrade (tier_requested).
create or replace function public.protect_profile_fields() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_super() then return new; end if;
  new.role := old.role; new.plan_id := old.plan_id; new.active := old.active;
  new.coach_id := old.coach_id; new.coach_code := old.coach_code;
  if not public.coaches(old.id) then new.juice_group := old.juice_group; new.juice_allow_food := old.juice_allow_food; end if;
  if auth.uid() <> old.id then new.avatar_path := old.avatar_path; new.tier_requested := old.tier_requested; new.tier_requested_at := old.tier_requested_at; end if;
  new.tier := old.tier; new.tier_until := old.tier_until; new.ai_chat_limit := old.ai_chat_limit; new.ai_ask := old.ai_ask;
  new.tier_price := old.tier_price; new.tier_note := old.tier_note;
  return new;
end $$;

-- Today's AI allowance for a person (yourself, your client, or anyone for the super admin).
-- Counts successful AI chat logs + Ask AI questions since midnight India time. Super admin: unlimited.
create or replace function public.ai_quota(p_uid uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := coalesce(p_uid, auth.uid());
  p public.profiles;
  t public.ai_tiers;
  eff text;
  lim integer;
  ask boolean;
  used integer;
  day_start timestamptz := (date_trunc('day', now() at time zone 'Asia/Kolkata')) at time zone 'Asia/Kolkata';
begin
  if uid is null then return null; end if;
  if uid <> auth.uid() and not public.coaches(uid) and not public.is_super() then return null; end if;
  select * into p from public.profiles where id = uid;
  if not found then return null; end if;
  eff := case when p.tier_until is not null and p.tier_until < (now() at time zone 'Asia/Kolkata')::date then 'free' else p.tier end;
  select * into t from public.ai_tiers where key = eff;
  if not found then select * into t from public.ai_tiers where key = 'free'; eff := 'free'; end if;
  lim := coalesce(p.ai_chat_limit, t.chat_per_day, 3);
  ask := coalesce(p.ai_ask, t.can_ask, false);
  select count(*) into used from public.activity_logs a
    where a.user_id = uid and a.action in ('ai_chat', 'ai_ask') and a.created_at >= day_start and coalesce(a.detail->>'ok', 'true') = 'true';
  if p.role = 'super_admin' then return jsonb_build_object('tier', eff, 'tier_name', t.name, 'limit', null, 'used', used, 'remaining', null, 'can_ask', true, 'unlimited', true); end if;
  return jsonb_build_object('tier', eff, 'tier_name', t.name, 'limit', lim, 'used', used, 'remaining', greatest(lim - used, 0),
    'can_ask', ask, 'until', p.tier_until, 'expired', eff <> p.tier, 'unlimited', false);
end $$;
revoke all on function public.ai_quota(uuid) from public, anon;
grant execute on function public.ai_quota(uuid) to authenticated;

-- Coach client list shows each client's AI plan.
create or replace view public.user_activity with (security_invoker = true) as
select p.id as user_id, p.full_name, p.email, p.active, pl.name as plan_name,
  (select max(m.log_date) from public.meal_logs m where m.user_id = p.id) as last_meal,
  (select max(w.log_date) from public.weight_logs w where w.user_id = p.id) as last_weight,
  (select max(o.log_date) from public.workouts o where o.user_id = p.id) as last_workout,
  (select w.weight_kg from public.weight_logs w where w.user_id = p.id order by w.log_date desc limit 1) as latest_weight,
  (select w.weight_kg from public.weight_logs w where w.user_id = p.id order by w.log_date limit 1) as first_weight,
  (select count(*) from public.meal_logs m where m.user_id = p.id and m.log_date > current_date - 7) as meals_7d,
  (select count(*) filter (where m.followed) from public.meal_logs m where m.user_id = p.id and m.log_date > current_date - 7) as followed_7d,
  (select count(*) from public.workouts o where o.user_id = p.id and o.log_date > current_date - 7) as workouts_7d,
  p.coach_id, p.created_at, p.phone, p.avatar_path, p.tier, p.tier_until, p.tier_requested
from public.profiles p left join public.plans pl on pl.id = p.plan_id
where p.role = 'user';
grant select on public.user_activity to authenticated;

-- ---------------------------------------------------------------- one workout per day + label
-- Before this, every chat message saved a new workout ("Pull", "Pull", "Pull"…), and a corrected exercise was saved twice.
-- Merge them: keep the first workout of each person/day/label; for each exercise keep the sets from its LATEST entry.
do $$
declare g record; keeper uuid; ex record; latest uuid;
begin
  for g in
    select user_id, log_date, coalesce(day_label, '') as lbl, array_agg(id order by created_at) as ids
    from public.workouts group by user_id, log_date, coalesce(day_label, '') having count(*) > 1
  loop
    keeper := g.ids[1];
    for ex in select distinct exercise_id from public.workout_sets where workout_id = any(g.ids) loop
      select s.workout_id into latest from public.workout_sets s join public.workouts w on w.id = s.workout_id
        where s.workout_id = any(g.ids) and s.exercise_id = ex.exercise_id order by w.created_at desc limit 1;
      delete from public.workout_sets where workout_id = any(g.ids) and exercise_id = ex.exercise_id and workout_id <> latest;
      update public.workout_sets set workout_id = keeper where workout_id = latest and exercise_id = ex.exercise_id;
    end loop;
    update public.workouts set
      duration_min = (select max(duration_min) from public.workouts where id = any(g.ids)),
      notes = nullif((select string_agg(distinct notes, ' · ') from public.workouts where id = any(g.ids) and notes is not null and notes <> 'Logged by chat'), '')
      where id = keeper;
    delete from public.workouts where id = any(g.ids) and id <> keeper;
  end loop;
end $$;
update public.workouts set notes = null where notes = 'Logged by chat';

select 'v15 ok' as status;
