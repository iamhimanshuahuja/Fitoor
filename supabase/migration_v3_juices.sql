-- v3: Juice feast plan (feature key 'juices') + coach-set eGFR juice group per client
alter table public.profiles add column if not exists juice_group text check (juice_group in ('90','60','30'));

-- clients can't change their own juice group (coach sets it)
create or replace function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.plan_id := old.plan_id;
    new.active := old.active;
    new.juice_group := old.juice_group;
  end if;
  return new;
end; $$;

create or replace function public.my_features() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(f), '{}') from unnest(array['diet','meals','meal_photos','weight','gym','labs','habits','supplements','ai','juices']) f
  where public.has_feature(auth.uid(), f);
$$;
select 'v3 ok' as status;
