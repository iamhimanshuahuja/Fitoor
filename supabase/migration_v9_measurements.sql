-- v9: body measurements (inches) — neck, chest, arm, waist, belly, hips, thigh, calf.
-- Stored in INCHES. One row per user per date. Same access as weight: owner or their current coach (super admin sees all).
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  neck numeric(5,2), chest numeric(5,2), arm numeric(5,2), waist numeric(5,2),
  belly numeric(5,2), hips numeric(5,2), thigh numeric(5,2), calf numeric(5,2),
  note text check (char_length(note) <= 300),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);
create index if not exists body_measurements_user_date on public.body_measurements(user_id, log_date);

do $$ declare c text; begin
  foreach c in array array['neck','chest','arm','waist','belly','hips','thigh','calf'] loop
    execute format('alter table public.body_measurements drop constraint if exists bm_%s_range', c);
    execute format('alter table public.body_measurements add constraint bm_%s_range check (%I is null or (%I > 3 and %I < 90))', c, c, c, c);
  end loop;
end $$;

create or replace function public.bm_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists bm_touch on public.body_measurements;
create trigger bm_touch before update on public.body_measurements for each row execute function public.bm_touch();

alter table public.body_measurements enable row level security;
grant select, insert, update, delete on public.body_measurements to authenticated;

drop policy if exists bm_read on public.body_measurements;
create policy bm_read on public.body_measurements for select to authenticated using (user_id = auth.uid() or public.coaches(user_id));
drop policy if exists bm_insert on public.body_measurements;
create policy bm_insert on public.body_measurements for insert to authenticated
  with check (public.coaches(user_id) or (user_id = auth.uid() and public.has_feature(auth.uid(), 'weight')));
drop policy if exists bm_update on public.body_measurements;
create policy bm_update on public.body_measurements for update to authenticated
  using (user_id = auth.uid() or public.coaches(user_id)) with check (user_id = auth.uid() or public.coaches(user_id));
drop policy if exists bm_delete on public.body_measurements;
create policy bm_delete on public.body_measurements for delete to authenticated using (user_id = auth.uid() or public.coaches(user_id));

-- activity log (coach Activity tab)
drop trigger if exists log_activity on public.body_measurements;
create trigger log_activity after insert or update or delete on public.body_measurements for each row execute function public.log_activity();

select 'v9 ok' as status;
