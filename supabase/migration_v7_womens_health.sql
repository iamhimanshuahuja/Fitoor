-- v7: women's health (optional). Safe to re-run. Requires v6 (public.coaches()).
-- Visible to: the client, their current coach, and the super admin (same rule as all other health data).

alter table public.profiles add column if not exists pcos text;
alter table public.profiles add column if not exists pregnancy text;
alter table public.profiles add column if not exists due_date date;
alter table public.profiles add column if not exists track_cycle boolean not null default false;
alter table public.profiles add column if not exists wh_updated_at timestamptz;
alter table public.profiles drop constraint if exists profiles_pcos_check;
alter table public.profiles add constraint profiles_pcos_check check (pcos is null or pcos in ('yes', 'no', 'not_sure'));
alter table public.profiles drop constraint if exists profiles_pregnancy_check;
alter table public.profiles add constraint profiles_pregnancy_check check (pregnancy is null or pregnancy in ('no', 'trying', 'pregnant', 'postpartum', 'breastfeeding'));

create table if not exists public.period_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  start_date  date not null,
  end_date    date,
  flow        text check (flow is null or flow in ('light', 'medium', 'heavy')),
  symptoms    text[] not null default '{}',
  notes       text,
  created_at  timestamptz not null default now(),
  unique (user_id, start_date),
  check (end_date is null or end_date >= start_date)
);
create index if not exists period_logs_user on public.period_logs (user_id, start_date desc);
alter table public.period_logs enable row level security;
grant select, insert, update, delete on public.period_logs to authenticated;
drop policy if exists pl_read on public.period_logs;   create policy pl_read   on public.period_logs for select using (user_id = auth.uid() or public.coaches(user_id));
drop policy if exists pl_write on public.period_logs;  create policy pl_write  on public.period_logs for insert with check (user_id = auth.uid() or public.coaches(user_id));
drop policy if exists pl_update on public.period_logs; create policy pl_update on public.period_logs for update using (user_id = auth.uid() or public.coaches(user_id));
drop policy if exists pl_delete on public.period_logs; create policy pl_delete on public.period_logs for delete using (user_id = auth.uid() or public.coaches(user_id));

-- activity log (generic trigger from v5)
drop trigger if exists log_activity on public.period_logs;
create trigger log_activity after insert or update or delete on public.period_logs for each row execute function public.log_activity();

select 'v7 ok' as status;
