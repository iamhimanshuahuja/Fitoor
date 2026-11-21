-- v10: cheat meals + record of Terms / Privacy acceptance.
-- Cheat meal = guilt-free planned treat. followed stays null, so it counts neither on nor off plan.
alter table public.meal_logs add column if not exists cheat boolean not null default false;
-- Cheat DAY is stored in habit_logs.habits.cheat_day (jsonb, no column needed).

-- Which version of the Terms & Privacy Policy the person agreed to, and when.
alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

-- Clients/coaches may set their own acceptance, but never someone else's, and never clear it back to an older version.
create or replace function public.guard_terms() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.terms_version is distinct from old.terms_version or new.terms_accepted_at is distinct from old.terms_accepted_at)
     and auth.uid() is not null and auth.uid() <> new.id then
    new.terms_version := old.terms_version; new.terms_accepted_at := old.terms_accepted_at;   -- coaches can't accept for a client
  end if;
  if new.terms_version is distinct from old.terms_version and new.terms_version is not null then
    new.terms_accepted_at := now();                                                         -- server time, not the browser's
  end if;
  return new;
end $$;
drop trigger if exists guard_terms on public.profiles;
create trigger guard_terms before update on public.profiles for each row execute function public.guard_terms();

select 'v10 ok' as status;
