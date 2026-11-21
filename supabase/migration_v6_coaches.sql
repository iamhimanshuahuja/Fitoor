-- v6: multi-coach system. Safe to re-run.
-- Roles: user (client) · coach · super_admin.
--   super_admin sees and manages everything (incl. coach names and assignment history).
--   coach sees ONLY clients whose profiles.coach_id = coach (current assignment). After a coach change the
--   new coach sees the full history; the old coach loses access and its profile/name is not visible to the new coach.
-- Existing 'admin' accounts become 'super_admin'.

-- ---------- 1. Roles, coach link, coach codes
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'super_admin' where role = 'admin';
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'coach', 'super_admin'));
alter table public.profiles add column if not exists coach_id uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists coach_code text;
create unique index if not exists profiles_coach_code_key on public.profiles (upper(coach_code)) where coach_code is not null;
create index if not exists profiles_coach_id on public.profiles (coach_id);

-- ---------- 2. Helper functions (security definer → no RLS recursion)
create or replace function public.is_super() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin');
$$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'super_admin'));
$$;
-- Kept for old code paths: now means "coach or super admin".
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff();
$$;
create or replace function public.is_super_user(uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and role = 'super_admin');
$$;
-- True when the caller manages this client: super admin, or the client's CURRENT coach.
create or replace function public.coaches(uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and (me.role = 'super_admin'
           or (me.role = 'coach' and exists (select 1 from public.profiles c where c.id = uid and c.coach_id = me.id)))
  );
$$;
-- Same, for storage paths "<uuid>/folder/file".
create or replace function public.coaches_path(p text) returns boolean language sql stable security definer set search_path = public as $$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then public.coaches(p::uuid) else false end;
$$;
create or replace function public.my_coach_id() returns uuid language sql stable security definer set search_path = public as $$
  select coach_id from public.profiles where id = auth.uid();
$$;
-- Signup form: check a coach code and show the coach's first name (works before login).
create or replace function public.coach_lookup(code text) returns text language sql stable security definer set search_path = public as $$
  select split_part(full_name, ' ', 1) from public.profiles
  where coach_code is not null and upper(coach_code) = upper(trim(code)) and role in ('coach', 'super_admin') and active is not false
  limit 1;
$$;
grant execute on function public.coach_lookup(text) to anon, authenticated;
grant execute on function public.is_super(), public.is_staff(), public.coaches(uuid), public.my_coach_id(), public.is_super_user(uuid) to authenticated;

-- ---------- 3. Assignment history (super admin only)
create table if not exists public.coach_assignments (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  coach_id    uuid references public.profiles(id) on delete set null,
  assigned_by uuid,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);
create index if not exists coach_assignments_user on public.coach_assignments (user_id, started_at desc);
alter table public.coach_assignments enable row level security;
revoke insert, update, delete on public.coach_assignments from authenticated, anon;
grant select on public.coach_assignments to authenticated;
drop policy if exists ca_read on public.coach_assignments;
create policy ca_read on public.coach_assignments for select using (public.is_super());

create or replace function public.track_coach_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.coach_id is not distinct from old.coach_id then return null; end if;
  update public.coach_assignments set ended_at = now() where user_id = new.id and ended_at is null;
  if new.coach_id is not null then
    insert into public.coach_assignments (user_id, coach_id, assigned_by) values (new.id, new.coach_id, auth.uid());
  end if;
  return null;
end $$;
drop trigger if exists track_coach_change on public.profiles;
create trigger track_coach_change after insert or update of coach_id on public.profiles for each row execute function public.track_coach_change();

-- Only the super admin may change role / plan / active / coach / coach code. Coaches may set juice amounts for their clients.
create or replace function public.protect_profile_fields() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_super() then return new; end if;
  new.role := old.role; new.plan_id := old.plan_id; new.active := old.active;
  new.coach_id := old.coach_id; new.coach_code := old.coach_code;
  if not public.coaches(old.id) then new.juice_group := old.juice_group; end if;
  return new;
end $$;

-- New signups: optional coach code (from the form or the coach's invite link) assigns the coach.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v_coach uuid;
begin
  select id into v_coach from public.profiles
   where coach_code is not null and upper(coach_code) = upper(trim(coalesce(new.raw_user_meta_data->>'coach_code', '')))
     and role in ('coach', 'super_admin') limit 1;
  insert into public.profiles (id, email, full_name, phone, plan_id, coach_id)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          new.raw_user_meta_data->>'phone',
          (select id from public.plans where name = 'Diet + Fitness'),
          v_coach)
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------- 4. Policies: "owner, or super admin, or the client's current coach"
do $$
declare t text;
begin
  foreach t in array array['meal_logs', 'weight_logs', 'habit_logs', 'workouts', 'workout_sets', 'lab_reports', 'lab_results'] loop
    execute format('drop policy if exists p_read on public.%I', t);
    execute format('drop policy if exists p_update on public.%I', t);
    execute format('drop policy if exists p_delete on public.%I', t);
    execute format('create policy p_read on public.%I for select using (user_id = auth.uid() or public.coaches(user_id))', t);
    execute format('create policy p_update on public.%I for update using (user_id = auth.uid() or public.coaches(user_id))', t);
    execute format('create policy p_delete on public.%I for delete using (user_id = auth.uid() or public.coaches(user_id))', t);
  end loop;
end $$;
drop policy if exists meal_read on public.meal_logs; drop policy if exists meal_update on public.meal_logs; drop policy if exists meal_delete on public.meal_logs;
drop policy if exists meal_write on public.meal_logs;
create policy meal_write on public.meal_logs for insert with check (public.coaches(user_id) or (user_id = auth.uid() and public.has_feature(auth.uid(), 'meals')));
drop policy if exists w_read on public.weight_logs; drop policy if exists w_update on public.weight_logs; drop policy if exists w_delete on public.weight_logs;
drop policy if exists w_write on public.weight_logs;
create policy w_write on public.weight_logs for insert with check (public.coaches(user_id) or (user_id = auth.uid() and public.has_feature(auth.uid(), 'weight')));
drop policy if exists h_read on public.habit_logs; drop policy if exists h_update on public.habit_logs;
drop policy if exists h_write on public.habit_logs;
create policy h_write on public.habit_logs for insert with check (public.coaches(user_id) or (user_id = auth.uid() and (public.has_feature(auth.uid(), 'habits') or public.has_feature(auth.uid(), 'supplements'))));
drop policy if exists wo_read on public.workouts; drop policy if exists wo_update on public.workouts; drop policy if exists wo_delete on public.workouts;
drop policy if exists wo_write on public.workouts;
create policy wo_write on public.workouts for insert with check (public.coaches(user_id) or (user_id = auth.uid() and public.has_feature(auth.uid(), 'gym')));
drop policy if exists ws_read on public.workout_sets; drop policy if exists ws_update on public.workout_sets; drop policy if exists ws_delete on public.workout_sets;
drop policy if exists ws_write on public.workout_sets;
create policy ws_write on public.workout_sets for insert with check (public.coaches(user_id) or (user_id = auth.uid() and public.has_feature(auth.uid(), 'gym')));
drop policy if exists lr_read on public.lab_reports; drop policy if exists lr_update on public.lab_reports; drop policy if exists lr_delete on public.lab_reports;
drop policy if exists lr_write on public.lab_reports;
create policy lr_write on public.lab_reports for insert with check (public.coaches(user_id) or (user_id = auth.uid() and public.has_feature(auth.uid(), 'labs')));
drop policy if exists lres_read on public.lab_results; drop policy if exists lres_update on public.lab_results; drop policy if exists lres_delete on public.lab_results;
drop policy if exists lres_write on public.lab_results;
create policy lres_write on public.lab_results for insert with check (public.coaches(user_id) or (user_id = auth.uid() and public.has_feature(auth.uid(), 'labs')));

-- comments: client + their current coach (+ super admin). Old coach's notes stay; their author profile is hidden from the new coach.
drop policy if exists c_read on public.comments; drop policy if exists c_write on public.comments; drop policy if exists c_delete on public.comments;
create policy c_read on public.comments for select using (user_id = auth.uid() or public.coaches(user_id));
create policy c_write on public.comments for insert with check (author_id = auth.uid() and (user_id = auth.uid() or public.coaches(user_id)));
create policy c_delete on public.comments for delete using (author_id = auth.uid() or public.coaches(user_id));

-- juice days
drop policy if exists jd_admin_all on public.juice_days;
create policy jd_admin_all on public.juice_days for all using (public.coaches(user_id)) with check (public.coaches(user_id));

-- diet plans: client plans → their coach; templates (user_id null) → super admin's are shared with all coaches, coaches' own are private
drop policy if exists dp_admin on public.diet_plans; drop policy if exists dp_staff on public.diet_plans; drop policy if exists dp_tpl_read on public.diet_plans;
create policy dp_staff on public.diet_plans for all
  using ((user_id is not null and public.coaches(user_id)) or (user_id is null and public.is_staff() and (public.is_super() or created_by = auth.uid())))
  with check ((user_id is not null and public.coaches(user_id)) or (user_id is null and public.is_staff() and (public.is_super() or coalesce(created_by, auth.uid()) = auth.uid())));
create policy dp_tpl_read on public.diet_plans for select using (user_id is null and public.is_staff() and (created_by = auth.uid() or public.is_super_user(created_by) or public.is_super()));

-- exercise library: shared; any coach can maintain it
drop policy if exists ex_admin on public.exercises; drop policy if exists ex_del on public.exercises; drop policy if exists ex_write on public.exercises;
create policy ex_admin on public.exercises for update using (public.is_staff());
create policy ex_del on public.exercises for delete using (public.is_staff());
create policy ex_write on public.exercises for insert with check (public.is_staff() or public.has_feature(auth.uid(), 'gym'));

-- subscription plans + per-client feature switches: super admin only (coaches can read)
drop policy if exists plans_admin on public.plans;
create policy plans_admin on public.plans for all using (public.is_super()) with check (public.is_super());
drop policy if exists uf_admin on public.user_features; drop policy if exists uf_read on public.user_features;
create policy uf_admin on public.user_features for all using (public.is_super()) with check (public.is_super());
create policy uf_read on public.user_features for select using (user_id = auth.uid() or public.coaches(user_id));

-- profiles: self, my current coach (so clients see their coach's name), clients I coach, super admin sees all
drop policy if exists profiles_self_read on public.profiles; drop policy if exists profiles_self_update on public.profiles; drop policy if exists profiles_admin_del on public.profiles;
create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.coaches(id) or id = public.my_coach_id());
create policy profiles_self_update on public.profiles for update using (id = auth.uid() or public.coaches(id));
create policy profiles_admin_del on public.profiles for delete using (public.is_super());

-- logs: activity → client's coach too; sign-ins (IP/location) → super admin + the client only
drop policy if exists al_read on public.activity_logs;
create policy al_read on public.activity_logs for select using (user_id = auth.uid() or public.coaches(user_id));
drop policy if exists le_read on public.login_events;
create policy le_read on public.login_events for select using (user_id = auth.uid() or public.is_super());

-- storage (photos, reports): owner folder, or that client's current coach / super admin
drop policy if exists media_read on storage.objects; drop policy if exists media_insert on storage.objects; drop policy if exists media_delete on storage.objects;
create policy media_read on storage.objects for select using (bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text or public.coaches_path((storage.foldername(name))[1])));
create policy media_insert on storage.objects for insert with check (bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text or public.coaches_path((storage.foldername(name))[1])));
create policy media_delete on storage.objects for delete using (bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text or public.coaches_path((storage.foldername(name))[1])));

-- ---------- 5. Client list view: respect RLS (it used to bypass it) and expose coach + signup date
drop view if exists public.user_activity;
create view public.user_activity with (security_invoker = true) as
select p.id as user_id, p.full_name, p.email, p.active, pl.name as plan_name,
  (select max(m.log_date) from public.meal_logs m where m.user_id = p.id) as last_meal,
  (select max(w.log_date) from public.weight_logs w where w.user_id = p.id) as last_weight,
  (select max(o.log_date) from public.workouts o where o.user_id = p.id) as last_workout,
  (select w.weight_kg from public.weight_logs w where w.user_id = p.id order by w.log_date desc limit 1) as latest_weight,
  (select w.weight_kg from public.weight_logs w where w.user_id = p.id order by w.log_date limit 1) as first_weight,
  (select count(*) from public.meal_logs m where m.user_id = p.id and m.log_date > current_date - 7) as meals_7d,
  (select count(*) filter (where m.followed) from public.meal_logs m where m.user_id = p.id and m.log_date > current_date - 7) as followed_7d,
  (select count(*) from public.workouts o where o.user_id = p.id and o.log_date > current_date - 7) as workouts_7d,
  p.coach_id, p.created_at, p.phone
from public.profiles p left join public.plans pl on pl.id = p.plan_id
where p.role = 'user';
grant select on public.user_activity to authenticated;

-- ---------- 6. Give every super admin a coach code (so they can coach too) and record existing assignments
update public.profiles
   set coach_code = upper(left(regexp_replace(split_part(coalesce(nullif(full_name, ''), email), ' ', 1), '[^A-Za-z]', '', 'g'), 6)) || lpad((floor(random() * 90) + 10)::int::text, 2, '0')
 where role = 'super_admin' and coach_code is null;

-- Existing clients without a coach stay with the super admin (same as before this change).
update public.profiles set coach_id = (select id from public.profiles where role = 'super_admin' order by created_at limit 1)
 where role = 'user' and coach_id is null and exists (select 1 from public.profiles where role = 'super_admin');
-- diet_plans.created_by should default to the creator
alter table public.diet_plans alter column created_by set default auth.uid();

select 'v6 ok' as status, (select json_agg(json_build_object('email', email, 'role', role, 'code', coach_code)) from public.profiles where role <> 'user') as staff;
