-- v13: profile photos for clients and coaches. Idempotent, safe to re-run.
-- Private bucket 'avatars', path <user_id>/<file>.webp. Read: yourself, your clients (coach), your own coach, super admin.
-- Write/delete: only your own folder. profiles.avatar_path holds the current photo; only the owner (or super admin) can change it.

alter table public.profiles add column if not exists avatar_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

drop policy if exists avatars_read on storage.objects;
drop policy if exists avatars_insert on storage.objects;
drop policy if exists avatars_update on storage.objects;
drop policy if exists avatars_delete on storage.objects;

create policy avatars_read on storage.objects for select to authenticated using (
  bucket_id = 'avatars' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.coaches_path((storage.foldername(name))[1])
    or (storage.foldername(name))[1] = public.my_coach_id()::text
    or public.is_super()
  ));
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Same guard as v6, plus: nobody but the owner (or super admin) may change someone's photo.
create or replace function public.protect_profile_fields() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_super() then return new; end if;
  new.role := old.role; new.plan_id := old.plan_id; new.active := old.active;
  new.coach_id := old.coach_id; new.coach_code := old.coach_code;
  if not public.coaches(old.id) then new.juice_group := old.juice_group; end if;
  if auth.uid() <> old.id then new.avatar_path := old.avatar_path; end if;
  return new;
end $$;

-- Coach client list shows photos (column appended, so create or replace works).
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
  p.coach_id, p.created_at, p.phone, p.avatar_path
from public.profiles p left join public.plans pl on pl.id = p.plan_id
where p.role = 'user';
grant select on public.user_activity to authenticated;

select 'v13 ok' as status;
