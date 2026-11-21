-- v14: food on a juice day depends on the coach's setting for each client. Idempotent, safe to re-run.
--   profiles.juice_allow_food = false (default): juices only — the client can't log food on a juice day.
--   profiles.juice_allow_food = true: the client may log what they ate; it is tagged ai.juice_day and counted off plan.
-- The coach (or super admin) can always record food for a client; it is tagged the same way.
alter table public.profiles add column if not exists juice_allow_food boolean not null default false;

create or replace function public.block_food_on_juice_day() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.juice_days j where j.user_id = new.user_id and j.day = new.log_date and j.status <> 'missed') then
    if auth.uid() is not null and auth.uid() = new.user_id
       and not coalesce((select p.juice_allow_food from public.profiles p where p.id = new.user_id), false) then
      raise exception 'Juice day: your coach has set juices only today. Message your coach if you ate something.';
    end if;
    new.ai := coalesce(new.ai, '{}'::jsonb) || jsonb_build_object('juice_day', true);
    if not coalesce(new.cheat, false) then new.followed := false; end if;
  end if;
  return new;
end $$;
drop trigger if exists block_food_on_juice_day on public.meal_logs;
create trigger block_food_on_juice_day before insert on public.meal_logs for each row execute function public.block_food_on_juice_day();

-- Only the client's coach (or super admin) may change juice settings; everything else as in v13.
create or replace function public.protect_profile_fields() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_super() then return new; end if;
  new.role := old.role; new.plan_id := old.plan_id; new.active := old.active;
  new.coach_id := old.coach_id; new.coach_code := old.coach_code;
  if not public.coaches(old.id) then new.juice_group := old.juice_group; new.juice_allow_food := old.juice_allow_food; end if;
  if auth.uid() <> old.id then new.avatar_path := old.avatar_path; end if;
  return new;
end $$;

select 'v14 ok' as status;
