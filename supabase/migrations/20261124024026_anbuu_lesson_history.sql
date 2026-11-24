create table public.anbuu_lesson_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track text not null check (track in ('gs', 'optional', 'literature')),
  subject text not null check (char_length(btrim(subject)) between 1 and 120),
  topic text not null default '' check (char_length(topic) <= 160),
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  status text not null default 'in_progress' check (status in ('in_progress', 'paused', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index anbuu_lesson_history_user_updated_idx
  on public.anbuu_lesson_history (user_id, updated_at desc);
alter table public.anbuu_lesson_history enable row level security;
revoke all on table public.anbuu_lesson_history from public, anon, authenticated;
grant all on table public.anbuu_lesson_history to service_role;
