-- v16: AI chat review for the super admin.
-- Every "Log by chat" and "Ask AI" exchange (text only, never photos) is kept for 30 days so the super admin
-- can check quality and misuse. Written only by the ai edge function (service role); readable only by the super admin.
-- Rows older than 30 days are deleted by the ai function itself.

create table if not exists public.ai_messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid not null references public.profiles(id) on delete cascade,   -- who asked
  subject_id  uuid references public.profiles(id) on delete set null,           -- Ask AI about a client: that client
  role        text,                 -- asker's role at the time: user | coach | super_admin
  task        text not null check (task in ('chat', 'ask')),
  prompt      text,                 -- what they typed (max 2,000 chars)
  photo       boolean not null default false,  -- a photo was attached (the photo itself is not kept)
  reply       text,                 -- what the AI answered (max 4,000 chars)
  actions     jsonb,                -- chat: cards suggested [{type, date, …short}]
  status      text not null default 'ok' check (status in ('ok', 'off_topic', 'error', 'limit', 'upgrade')),
  error       text,
  ms          integer
);
create index if not exists ai_messages_created_idx on public.ai_messages (created_at desc);
create index if not exists ai_messages_user_idx on public.ai_messages (user_id, created_at desc);

alter table public.ai_messages enable row level security;
drop policy if exists ai_messages_super_read on public.ai_messages;
create policy ai_messages_super_read on public.ai_messages for select to authenticated using (public.is_super());
-- no insert/update/delete policies: only the service role (edge function) writes and prunes.
revoke all on public.ai_messages from anon;
grant select on public.ai_messages to authenticated;

delete from public.ai_messages where created_at < now() - interval '30 days';
select 'v16 ok' as status;
