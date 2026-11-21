-- Add private test-result history for learners.
-- Safe to run in an existing Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam text not null,
  test_name text not null,
  score numeric(8,2) not null,
  max_score numeric(8,2) not null,
  correct_count integer not null default 0 check (correct_count >= 0),
  wrong_count integer not null default 0 check (wrong_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists test_results_user_created_idx
  on public.test_results (user_id, created_at desc);

alter table public.test_results enable row level security;

drop policy if exists "test results self read" on public.test_results;
create policy "test results self read" on public.test_results
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "test results self insert" on public.test_results;
create policy "test results self insert" on public.test_results
  for insert to authenticated with check (user_id = auth.uid());

revoke all on public.test_results from anon;
grant select, insert on public.test_results to authenticated;
