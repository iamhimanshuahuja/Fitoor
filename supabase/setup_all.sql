-- Fitoor: schema + default diet template in ONE file. Paste all of this into Supabase > SQL Editor and click Run.

-- =====================================================================
-- Fitoor — Supabase schema
-- Run this whole file once in Supabase Dashboard > SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Plans & features (admin enables/disables features per plan / per user)
-- Feature keys: diet, meals, meal_photos, weight, gym, labs, habits, supplements, ai
-- ---------------------------------------------------------------------
create table if not exists public.plans (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  features    text[] not null default '{}',
  created_at  timestamptz not null default now()
);

insert into public.plans (name, description, features) values
  ('Diet Only',      'Diet plan, meal logging and weight',           array['diet','meals','meal_photos','weight','habits']),
  ('Diet + Fitness', 'Everything in Diet plus gym tracking',         array['diet','meals','meal_photos','weight','habits','gym','supplements']),
  ('Full',           'Diet, fitness, lab reports and AI features',   array['diet','meals','meal_photos','weight','habits','gym','supplements','labs','ai'])
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  full_name      text,
  email          text,
  phone          text,
  role           text not null default 'user' check (role in ('user','admin')),
  plan_id        uuid references public.plans(id),
  gender         text,
  dob            date,
  height_cm      numeric,
  start_weight   numeric,
  target_weight  numeric,
  goal           text,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists public.user_features (
  user_id  uuid references public.profiles(id) on delete cascade,
  feature  text not null,
  enabled  boolean not null,
  primary key (user_id, feature)
);

-- Helper: is current user an admin? (security definer avoids RLS recursion)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Helper: does a user have a feature? Per-user override wins, else plan.
create or replace function public.has_feature(uid uuid, feat text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select enabled from public.user_features where user_id = uid and feature = feat),
    (select feat = any(pl.features) from public.profiles p join public.plans pl on pl.id = p.plan_id where p.id = uid),
    false
  );
$$;

-- Effective feature list for the logged-in user (used by the app menu)
create or replace function public.my_features() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(f), '{}') from unnest(array['diet','meals','meal_photos','weight','gym','labs','habits','supplements','ai']) f
  where public.has_feature(auth.uid(), f);
$$;

-- Create a profile automatically on signup (default plan: Diet + Fitness)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, plan_id)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    (select id from public.plans where name = 'Diet + Fitness')
  ) on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users must not promote themselves or change their own plan
create or replace function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null in the SQL editor / service role: allow those
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.plan_id := old.plan_id;
    new.active := old.active;
  end if;
  return new;
end; $$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------
-- Diet plans (created/updated by admin, one active per user)
-- slots: [{ "key":"early_morning", "label":"Early Morning", "title":"Detox water",
--           "items":["..."], "avoid":["..."] }, ...]
-- ---------------------------------------------------------------------
create table if not exists public.diet_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,  -- null = template
  title       text not null,
  is_active   boolean not null default true,
  is_template boolean not null default false,
  slots       jsonb not null default '[]',
  guidelines  text[] not null default '{}',
  notes       text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Daily logs
-- ---------------------------------------------------------------------
create table if not exists public.meal_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  log_date     date not null default current_date,
  slot         text not null,                 -- early_morning, before_breakfast, breakfast, lunch, evening, dinner, bedtime, other
  description  text,
  photo_path   text,                          -- storage path in bucket 'media'
  eaten_at     timestamptz not null default now(),
  followed     boolean,                       -- user's own "on plan?" tick
  kcal         numeric, protein_g numeric, carbs_g numeric, fat_g numeric,
  ai           jsonb,                         -- raw AI estimate {items, kcal, plan_check...}
  created_at   timestamptz not null default now()
);
create index if not exists meal_logs_user_date on public.meal_logs(user_id, log_date);

create table if not exists public.weight_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  log_date    date not null default current_date,
  weight_kg   numeric not null check (weight_kg > 0 and weight_kg < 400),
  waist_cm    numeric,
  photo_path  text,
  source      text not null default 'manual' check (source in ('manual','ai')),
  note        text,
  created_at  timestamptz not null default now(),
  unique (user_id, log_date)
);

create table if not exists public.habit_logs (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  log_date  date not null default current_date,
  habits    jsonb not null default '{}',      -- {"detox_water":true,"nuts":true,"water_glasses":8,...}
  supplements jsonb not null default '{}',    -- {"whey":true,"pre_workout":false,...}
  primary key (user_id, log_date)
);

-- ---------------------------------------------------------------------
-- Gym
-- ---------------------------------------------------------------------
create table if not exists public.exercises (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  muscle_group  text not null,     -- chest, back, legs, shoulders, arms, core, full_body, cardio
  equipment     text not null,     -- barbell, dumbbell, machine, cable, bodyweight, cardio_machine, other
  kind          text not null default 'strength' check (kind in ('strength','cardio','mobility')),
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

insert into public.exercises (name, muscle_group, equipment, kind) values
  ('Treadmill','cardio','cardio_machine','cardio'),
  ('Incline Treadmill Walk','cardio','cardio_machine','cardio'),
  ('Stationary Cycle','cardio','cardio_machine','cardio'),
  ('Elliptical / Cross Trainer','cardio','cardio_machine','cardio'),
  ('Rowing Machine','cardio','cardio_machine','cardio'),
  ('Stretching','full_body','bodyweight','mobility'),
  ('Bodyweight Squat','legs','bodyweight','strength'),
  ('Push-up','chest','bodyweight','strength'),
  ('Plank','core','bodyweight','strength'),
  ('Crunches','core','bodyweight','strength'),
  ('Barbell Bench Press','chest','barbell','strength'),
  ('Incline Dumbbell Press','chest','dumbbell','strength'),
  ('Chest Press Machine','chest','machine','strength'),
  ('Pec Deck / Fly Machine','chest','machine','strength'),
  ('Cable Crossover','chest','cable','strength'),
  ('Lat Pulldown','back','machine','strength'),
  ('Seated Cable Row','back','cable','strength'),
  ('Dumbbell Row','back','dumbbell','strength'),
  ('Deadlift','back','barbell','strength'),
  ('Assisted Pull-up Machine','back','machine','strength'),
  ('Shoulder Press (Dumbbell)','shoulders','dumbbell','strength'),
  ('Shoulder Press Machine','shoulders','machine','strength'),
  ('Lateral Raise','shoulders','dumbbell','strength'),
  ('Barbell Curl','arms','barbell','strength'),
  ('Dumbbell Curl','arms','dumbbell','strength'),
  ('Tricep Pushdown','arms','cable','strength'),
  ('Barbell Squat','legs','barbell','strength'),
  ('Leg Press','legs','machine','strength'),
  ('Leg Extension','legs','machine','strength'),
  ('Leg Curl','legs','machine','strength'),
  ('Calf Raise Machine','legs','machine','strength'),
  ('Smith Machine Squat','legs','machine','strength')
on conflict (name) do nothing;

create table if not exists public.workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  log_date     date not null default current_date,
  day_label    text,             -- Push / Pull / Legs / Full body / Cardio ...
  duration_min numeric,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists workouts_user_date on public.workouts(user_id, log_date);

create table if not exists public.workout_sets (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references public.workouts(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  exercise_id  uuid not null references public.exercises(id),
  set_no       int not null default 1,
  reps         int,
  weight_kg    numeric,
  duration_min numeric,
  distance_km  numeric,
  incline      numeric,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Lab reports — one report per date, many results, compare date-wise
-- ---------------------------------------------------------------------
create table if not exists public.lab_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  report_date  date not null,
  lab_name     text,
  file_path    text,
  notes        text,
  created_at   timestamptz not null default now()
);

create table if not exists public.lab_results (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.lab_reports(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  panel       text,                  -- Lipid Profile, Liver Function Test, ...
  test_name   text not null,
  value       numeric,
  value_text  text,                  -- for non-numeric results (Nil, Negative...)
  unit        text,
  ref_low     numeric,
  ref_high    numeric,
  ref_text    text,
  flag        text check (flag in ('low','high','normal'))
);
create index if not exists lab_results_user_test on public.lab_results(user_id, test_name);

-- ---------------------------------------------------------------------
-- Comments / health notes (admin <-> user)
-- ---------------------------------------------------------------------
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,  -- whose record
  author_id  uuid not null references public.profiles(id),
  log_date   date,
  context    text not null default 'general' check (context in ('general','meal','weight','workout','lab','health')),
  ref_id     uuid,
  body       text not null,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.plans          enable row level security;
alter table public.profiles       enable row level security;
alter table public.user_features  enable row level security;
alter table public.diet_plans     enable row level security;
alter table public.meal_logs      enable row level security;
alter table public.weight_logs    enable row level security;
alter table public.habit_logs     enable row level security;
alter table public.exercises      enable row level security;
alter table public.workouts       enable row level security;
alter table public.workout_sets   enable row level security;
alter table public.lab_reports    enable row level security;
alter table public.lab_results    enable row level security;
alter table public.comments       enable row level security;

-- Drop old policies so the file can be re-run
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- plans: everyone signed-in reads, admin writes
create policy plans_read  on public.plans for select to authenticated using (true);
create policy plans_admin on public.plans for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- profiles
create policy profiles_self_read   on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_admin_del   on public.profiles for delete to authenticated using (public.is_admin());

-- user_features
create policy uf_read  on public.user_features for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy uf_admin on public.user_features for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- diet_plans: user reads own active plan (feature 'diet'); admin all
create policy dp_read  on public.diet_plans for select to authenticated
  using (public.is_admin() or (user_id = auth.uid() and public.has_feature(auth.uid(),'diet')));
create policy dp_admin on public.diet_plans for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Generic owner policies, gated by feature for writes
create policy meal_read   on public.meal_logs for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy meal_write  on public.meal_logs for insert to authenticated with check (user_id = auth.uid() and public.has_feature(auth.uid(),'meals'));
create policy meal_update on public.meal_logs for update to authenticated using (user_id = auth.uid() or public.is_admin());
create policy meal_delete on public.meal_logs for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create policy w_read   on public.weight_logs for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy w_write  on public.weight_logs for insert to authenticated with check (user_id = auth.uid() and public.has_feature(auth.uid(),'weight'));
create policy w_update on public.weight_logs for update to authenticated using (user_id = auth.uid() or public.is_admin());
create policy w_delete on public.weight_logs for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create policy h_read  on public.habit_logs for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy h_write on public.habit_logs for insert to authenticated with check (user_id = auth.uid() and (public.has_feature(auth.uid(),'habits') or public.has_feature(auth.uid(),'supplements')));
create policy h_update on public.habit_logs for update to authenticated using (user_id = auth.uid() or public.is_admin());

create policy ex_read  on public.exercises for select to authenticated using (true);
create policy ex_write on public.exercises for insert to authenticated with check (public.is_admin() or public.has_feature(auth.uid(),'gym'));
create policy ex_admin on public.exercises for update to authenticated using (public.is_admin());
create policy ex_del   on public.exercises for delete to authenticated using (public.is_admin());

create policy wo_read   on public.workouts for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy wo_write  on public.workouts for insert to authenticated with check (user_id = auth.uid() and public.has_feature(auth.uid(),'gym'));
create policy wo_update on public.workouts for update to authenticated using (user_id = auth.uid() or public.is_admin());
create policy wo_delete on public.workouts for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create policy ws_read   on public.workout_sets for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy ws_write  on public.workout_sets for insert to authenticated with check (user_id = auth.uid() and public.has_feature(auth.uid(),'gym'));
create policy ws_update on public.workout_sets for update to authenticated using (user_id = auth.uid() or public.is_admin());
create policy ws_delete on public.workout_sets for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create policy lr_read   on public.lab_reports for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy lr_write  on public.lab_reports for insert to authenticated with check ((user_id = auth.uid() and public.has_feature(auth.uid(),'labs')) or public.is_admin());
create policy lr_update on public.lab_reports for update to authenticated using (user_id = auth.uid() or public.is_admin());
create policy lr_delete on public.lab_reports for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create policy lres_read   on public.lab_results for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy lres_write  on public.lab_results for insert to authenticated with check ((user_id = auth.uid() and public.has_feature(auth.uid(),'labs')) or public.is_admin());
create policy lres_update on public.lab_results for update to authenticated using (user_id = auth.uid() or public.is_admin());
create policy lres_delete on public.lab_results for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- comments: both sides read; user can reply on own record; admin anywhere
create policy c_read   on public.comments for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy c_write  on public.comments for insert to authenticated with check (author_id = auth.uid() and (user_id = auth.uid() or public.is_admin()));
create policy c_delete on public.comments for delete to authenticated using (author_id = auth.uid() or public.is_admin());

-- =====================================================================
-- Storage: private bucket 'media', files under <user_id>/...
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 5242880)
on conflict (id) do nothing;

drop policy if exists media_read   on storage.objects;
drop policy if exists media_insert on storage.objects;
drop policy if exists media_delete on storage.objects;

create policy media_read on storage.objects for select to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- =====================================================================
-- Admin analytics view (admin-only via RLS on base tables + security_invoker)
-- =====================================================================
create or replace view public.user_activity with (security_invoker = on) as
select
  p.id as user_id, p.full_name, p.email, p.active, pl.name as plan_name,
  (select max(log_date) from public.meal_logs m where m.user_id = p.id)   as last_meal,
  (select max(log_date) from public.weight_logs w where w.user_id = p.id) as last_weight,
  (select max(log_date) from public.workouts o where o.user_id = p.id)    as last_workout,
  (select weight_kg from public.weight_logs w where w.user_id = p.id order by log_date desc limit 1) as latest_weight,
  (select weight_kg from public.weight_logs w where w.user_id = p.id order by log_date asc  limit 1) as first_weight,
  (select count(*) from public.meal_logs m where m.user_id = p.id and m.log_date > current_date - 7) as meals_7d,
  (select count(*) filter (where followed) from public.meal_logs m where m.user_id = p.id and m.log_date > current_date - 7) as followed_7d,
  (select count(*) from public.workouts o where o.user_id = p.id and o.log_date > current_date - 7) as workouts_7d
from public.profiles p left join public.plans pl on pl.id = p.plan_id
where p.role = 'user';

-- =====================================================================
-- Make yourself admin (run after you sign up, with your email):
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- =====================================================================
-- Default diet template (from the "Alkaline diet with high-protein breakfast and light dinners" chart).
-- Admin can copy this template to any user from the Admin > User > Diet plan screen.
insert into public.diet_plans (user_id, title, is_template, is_active, slots, guidelines)
select null, 'Alkaline diet — high-protein breakfast, light dinner', true, true,
'[
 {"key":"early_morning","label":"Early Morning","title":"Detox water",
  "items":["1 tsp mix — methi, cinnamon, saunf, jeera"],"avoid":[]},
 {"key":"before_breakfast","label":"Before Breakfast","title":"Herbal / green smoothie",
  "items":["Major greens (cucumber / bottle gourd / ash gourd) — 1 cup","Minor greens (coriander / mint / curry / paan / tulsi) — 5-10 leaves","Fruit — 1/2 apple / guava / peach / pear","Pinch of cinnamon and black salt","Blend to chutney consistency, add 1 cup water and lemon"],
  "avoid":["Milk tea","Coffee"]},
 {"key":"breakfast","label":"Breakfast","title":"High-protein breakfast",
  "items":["Besan chilla (veg / paneer stuffing)","Boiled / steamed sprout or chana salad — 1 bowl","Overnight soaked oats — 1 bowl","Avocado toast — 2 slices","Paneer paratha / dal paratha","Moong dal idli — veg fried / sambhar","Add green chutney daily"],
  "avoid":["Poha","Upma","Vermicelli","Breads","Macaroni"]},
 {"key":"lunch","label":"Lunch","title":"25% plate rule (divide plate in 4 parts)",
  "items":["Salads","Cooked seasonal veg","Dal / chana / rajma / paneer / peanut curd","Rice or roti"],
  "avoid":["Large portions"]},
 {"key":"evening","label":"Evening","title":"Light snacks",
  "items":["Tea — green / black / coffee / saunf water / rosemary / chamomile","Nuts — soaked 10 almonds + 3 walnuts","Mixed seeds — 1-2 tsp","If still hungry: handful of makhana / roasted chana / peanuts"],
  "avoid":["Tea with biscuits","Namkeens","Bakery"]},
 {"key":"dinner","label":"Dinner","title":"Light dinner",
  "items":["Veg soup","Moong dal soup","Boiled / sautéed veggies","Quinoa pulao (if very hungry)"],
  "avoid":["Heavy meals","Pizza","Pasta","Rice","Paratha"]},
 {"key":"bedtime","label":"Post Dinner / Bed time","title":"Lukewarm water",
  "items":["Lukewarm water"],"avoid":["Coffee"]}
]'::jsonb,
array['Maintain proper hydration','Do not skip meals','Maintain 12 hr fasting gap from dinner to breakfast','Daily walk and climb stairs','Practice NOD as shared — 2 times (morning and before bedtime)','Avoid refined products / breads / outside eating']
where not exists (select 1 from public.diet_plans where is_template and title like 'Alkaline diet%');

-- ===== API grants (see supabase/grants.sql) =====
-- Explicit API grants (newer Supabase projects don't auto-grant tables created via SQL).
-- RLS policies still decide which ROWS each user sees.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant execute on functions to authenticated, service_role;
