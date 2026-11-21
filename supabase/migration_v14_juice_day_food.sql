-- v14: food on a juice day is no longer blocked. It is saved, tagged ai.juice_day = true and counted as off plan
-- (unless it is a cheat meal), so the client can log honestly and the coach sees it. Idempotent.
create or replace function public.block_food_on_juice_day() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.juice_days j where j.user_id = new.user_id and j.day = new.log_date and j.status <> 'missed') then
    new.ai := coalesce(new.ai, '{}'::jsonb) || jsonb_build_object('juice_day', true);
    if not coalesce(new.cheat, false) then new.followed := false; end if;
  end if;
  return new;
end $$;
drop trigger if exists block_food_on_juice_day on public.meal_logs;
create trigger block_food_on_juice_day before insert on public.meal_logs for each row execute function public.block_food_on_juice_day();
select 'v14 ok' as status;
