-- v8: recipe book. Safe to re-run. Requires v6 (is_staff, is_super, coaches).
-- status: private (only author + their coach + super admin) · pending (client asked to publish; staff review)
--         public (on the website, readable by anyone, incl. logged-out visitors) · rejected (sent back to author)
-- Staff (coach / super admin) can publish directly. A client's "public" request becomes "pending" until approved,
-- and editing an already-public client recipe sends it back to "pending".

alter table public.profiles add column if not exists diet_pref text;
alter table public.profiles drop constraint if exists profiles_diet_pref_check;
alter table public.profiles add constraint profiles_diet_pref_check check (diet_pref is null or diet_pref in ('veg', 'egg', 'nonveg'));

create table if not exists public.recipes (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique,
  title         text not null check (char_length(title) between 3 and 120),
  summary       text,
  diet          text not null default 'veg' check (diet in ('veg', 'egg', 'nonveg')),
  tags          text[] not null default '{}',
  meal_types    text[] not null default '{}',
  prep_min      int,
  cook_min      int,
  servings      int default 2,
  kcal          int,
  protein_g     numeric,
  carbs_g       numeric,
  fat_g         numeric,
  ingredients   jsonb not null default '[]',   -- [{ "qty": "1 cup", "item": "moong dal, soaked" }]
  steps         text[] not null default '{}',
  tips          text,
  image_path    text,                           -- path in public bucket 'recipes'
  source_name   text,
  source_url    text,
  author_id     uuid default auth.uid() references public.profiles(id) on delete set null,
  by_staff      boolean not null default false,
  status        text not null default 'private' check (status in ('private', 'pending', 'public', 'rejected')),
  review_note   text,
  reviewed_by   uuid,
  published_at  timestamptz,
  views         int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists recipes_status on public.recipes (status, published_at desc);
create index if not exists recipes_author on public.recipes (author_id);
create index if not exists recipes_tags on public.recipes using gin (tags);

-- slug, staff flag, moderation rules, timestamps
create or replace function public.recipe_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare staff boolean := auth.uid() is null or public.is_staff(); base text; n int := 0;
begin
  if tg_op = 'INSERT' then
    new.author_id := coalesce(new.author_id, auth.uid());
    new.by_staff := auth.uid() is null or public.is_staff();
    new.views := 0;
  else
    new.author_id := old.author_id; new.by_staff := old.by_staff; new.views := old.views;
  end if;
  if not staff then
    -- clients can't self-publish: public → pending; edits to a public recipe go back to review
    if new.status = 'public' and (tg_op = 'INSERT' or old.status <> 'public' or row(new.title, new.summary, new.ingredients, new.steps, new.image_path, new.tips) is distinct from row(old.title, old.summary, old.ingredients, old.steps, old.image_path, old.tips)) then
      new.status := 'pending';
    end if;
    if tg_op = 'UPDATE' then new.review_note := old.review_note; new.reviewed_by := old.reviewed_by; end if;
  else
    if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('public', 'rejected') then new.reviewed_by := auth.uid(); end if;
  end if;
  if new.status = 'public' and (tg_op = 'INSERT' or old.status <> 'public') then new.published_at := now(); end if;
  if new.status <> 'public' then new.published_at := null; end if;
  if new.slug is null or new.slug = '' or (tg_op = 'UPDATE' and new.title is distinct from old.title and old.status <> 'public') then
    base := trim(both '-' from regexp_replace(lower(new.title), '[^a-z0-9]+', '-', 'g'));
    if base = '' then base := 'recipe'; end if;
    new.slug := left(base, 70);
    while exists (select 1 from public.recipes where slug = new.slug and id <> new.id) loop
      n := n + 1; new.slug := left(base, 66) || '-' || n;
    end loop;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists recipe_guard on public.recipes;
create trigger recipe_guard before insert or update on public.recipes for each row execute function public.recipe_guard();

alter table public.recipes enable row level security;
grant select on public.recipes to anon;
grant select, insert, update, delete on public.recipes to authenticated;
drop policy if exists r_public on public.recipes;
create policy r_public on public.recipes for select using (status = 'public');
drop policy if exists r_own on public.recipes;
create policy r_own on public.recipes for select to authenticated using (author_id = auth.uid() or public.is_super() or (public.is_staff() and status = 'pending') or public.coaches(author_id));
drop policy if exists r_insert on public.recipes;
create policy r_insert on public.recipes for insert to authenticated with check (auth.uid() is not null and author_id = auth.uid());
drop policy if exists r_update on public.recipes;
create policy r_update on public.recipes for update to authenticated
  using (author_id = auth.uid() or public.is_super() or (public.is_staff() and status = 'pending'))
  with check (author_id = auth.uid() or public.is_staff());
drop policy if exists r_delete on public.recipes;
create policy r_delete on public.recipes for delete to authenticated using (author_id = auth.uid() or public.is_super());

-- public view counter (callable by logged-out visitors)
create or replace function public.recipe_view(p_slug text) returns void language sql security definer set search_path = public as $$
  update public.recipes set views = views + 1 where slug = p_slug and status = 'public';
$$;
grant execute on function public.recipe_view(text) to anon, authenticated;

-- public bucket for dish photos: anyone can view; signed-in users upload into their own folder
insert into storage.buckets (id, name, public) values ('recipes', 'recipes', true) on conflict (id) do update set public = true;
drop policy if exists recipes_img_read on storage.objects;
create policy recipes_img_read on storage.objects for select using (bucket_id = 'recipes');
drop policy if exists recipes_img_insert on storage.objects;
create policy recipes_img_insert on storage.objects for insert with check (bucket_id = 'recipes' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists recipes_img_delete on storage.objects;
create policy recipes_img_delete on storage.objects for delete using (bucket_id = 'recipes' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_super()));

select 'v8 ok' as status;
