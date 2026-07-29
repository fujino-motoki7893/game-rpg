-- One row per player, keyed by their Supabase Auth user id (anonymous or
-- upgraded). The whole GameSave blob is stored as-is in `data`; the client
-- is the source of truth for its shape, this table just persists it.
create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  save_version integer not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

-- RLS policies below only restrict *which rows* a query can touch — Postgres
-- still requires a table-level grant before `authenticated` (the role
-- Supabase's anonymous auth sessions run as) can hit the table at all.
grant select, insert, update on public.saves to authenticated;

-- Each user may only ever read/write their own row. Safe to call from the
-- browser with the public anon key because of this.
create policy "saves_select_own" on public.saves
  for select using (auth.uid() = user_id);

create policy "saves_insert_own" on public.saves
  for insert with check (auth.uid() = user_id);

create policy "saves_update_own" on public.saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
