-- The Aspirant's Desk — Supabase setup
-- Run this entire file in Supabase Dashboard > SQL Editor > New query.
-- Never put a service_role key in config.js or in this website.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Learner',
  role text not null default 'learner' check (role in ('learner','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), 'Learner'), 'learner')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  summary jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.updates (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  category text not null,
  title text not null,
  note text not null default '',
  link text not null default '',
  key_date date,
  created_at timestamptz not null default now()
);
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.press (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('press','pib')),
  date date,
  paper text not null default '',
  section text not null default '',
  title text not null,
  link text not null default '',
  what_happened text not null default '',
  explanation text not null default '',
  upsc_angle text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.admin_private_notes (
  id integer primary key check (id = 1),
  content text not null default '',
  updated_at timestamptz not null default now()
);

create or replace function public.is_desk_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'); $$;

alter table public.profiles enable row level security;
alter table public.user_data enable row level security;
alter table public.progress enable row level security;
alter table public.updates enable row level security;
alter table public.notes enable row level security;
alter table public.press enable row level security;
alter table public.admin_private_notes enable row level security;

drop policy if exists "profile self or admin read" on public.profiles;
create policy "profile self or admin read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_desk_admin());
drop policy if exists "user data self read" on public.user_data;
create policy "user data self read" on public.user_data for select to authenticated using (user_id = auth.uid());
drop policy if exists "user data self insert" on public.user_data;
create policy "user data self insert" on public.user_data for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "user data self update" on public.user_data;
create policy "user data self update" on public.user_data for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "progress self or admin read" on public.progress;
create policy "progress self or admin read" on public.progress for select to authenticated using (user_id = auth.uid() or public.is_desk_admin());
drop policy if exists "progress self insert" on public.progress;
create policy "progress self insert" on public.progress for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "progress self update" on public.progress;
create policy "progress self update" on public.progress for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "published updates public read" on public.updates;
create policy "published updates public read" on public.updates for select to anon, authenticated using (true);
drop policy if exists "admin manage updates" on public.updates;
create policy "admin manage updates" on public.updates for all to authenticated using (public.is_desk_admin()) with check (public.is_desk_admin());
drop policy if exists "published notes public read" on public.notes;
create policy "published notes public read" on public.notes for select to anon, authenticated using (true);
drop policy if exists "admin manage notes" on public.notes;
create policy "admin manage notes" on public.notes for all to authenticated using (public.is_desk_admin()) with check (public.is_desk_admin());
drop policy if exists "published press public read" on public.press;
create policy "published press public read" on public.press for select to anon, authenticated using (true);
drop policy if exists "admin manage press" on public.press;
create policy "admin manage press" on public.press for all to authenticated using (public.is_desk_admin()) with check (public.is_desk_admin());
drop policy if exists "admin private notes only" on public.admin_private_notes;
create policy "admin private notes only" on public.admin_private_notes for all to authenticated using (public.is_desk_admin()) with check (public.is_desk_admin());

-- Enable realtime for live notifications and the admin's progress dashboard.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='updates') then alter publication supabase_realtime add table public.updates; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notes') then alter publication supabase_realtime add table public.notes; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='press') then alter publication supabase_realtime add table public.press; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='progress') then alter publication supabase_realtime add table public.progress; end if;
end $$;

-- IMPORTANT: after creating your first learner account, copy its UUID from
-- Authentication > Users, then run the command below with YOUR UUID:
-- update public.profiles set role='admin' where id='PASTE-YOUR-USER-UUID-HERE';
-- Do not make a public admin-registration form.

-- API grants; Row Level Security above still decides which rows each role can access.
grant usage on schema public to anon, authenticated;
grant select on public.updates, public.notes, public.press to anon, authenticated;
grant insert, update, delete on public.updates, public.notes, public.press to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.user_data to authenticated;
grant select, insert, update on public.progress to authenticated;
grant select, insert, update, delete on public.admin_private_notes to authenticated;
