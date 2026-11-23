-- Protect profile roles: users may edit their own display name, never their own role.
create or replace function private.guard_profile_role_changes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.role is distinct from old.role and not private.is_desk_admin() then
    raise exception 'Only the site owner can change account roles' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_profile_role_changes() from public, anon, authenticated;
drop trigger if exists guard_profile_role_changes on public.profiles;
create trigger guard_profile_role_changes before update on public.profiles
for each row execute function private.guard_profile_role_changes();

drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_update_self_non_privileged on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_self_non_privileged on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_update_admin on public.profiles for update to authenticated
using ((select private.is_desk_admin())) with check ((select private.is_desk_admin()));

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','learner','mentor')) not valid;
alter table public.profiles validate constraint profiles_role_check;

create table if not exists public.mentor_assignments (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (length(trim(subject)) between 2 and 120),
  goal text not null check (length(trim(goal)) between 3 and 2000),
  status text not null default 'active' check (status in ('active','completed','paused')),
  due_date date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (mentor_id <> learner_id)
);
create index if not exists mentor_assignments_mentor_idx on public.mentor_assignments(mentor_id, status, created_at desc);
create index if not exists mentor_assignments_learner_idx on public.mentor_assignments(learner_id, status, created_at desc);

create table if not exists public.mentor_reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.mentor_assignments(id) on delete cascade,
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  feedback text not null check (length(trim(feedback)) between 3 and 5000),
  rating smallint check (rating between 1 and 5),
  visibility text not null default 'shared' check (visibility in ('private','shared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mentor_reviews_assignment_idx on public.mentor_reviews(assignment_id, created_at desc);

alter table public.mentor_assignments enable row level security;
alter table public.mentor_reviews enable row level security;
grant select, insert, update, delete on public.mentor_assignments to authenticated;
grant select, insert, update, delete on public.mentor_reviews to authenticated;

create policy mentor_assignments_read_participants on public.mentor_assignments for select to authenticated
using ((select private.is_desk_admin()) or mentor_id = (select auth.uid()) or learner_id = (select auth.uid()));
create policy mentor_assignments_owner_insert on public.mentor_assignments for insert to authenticated
with check ((select private.is_desk_admin()) and created_by = (select auth.uid()));
create policy mentor_assignments_owner_update on public.mentor_assignments for update to authenticated
using ((select private.is_desk_admin())) with check ((select private.is_desk_admin()));
create policy mentor_assignments_owner_delete on public.mentor_assignments for delete to authenticated
using ((select private.is_desk_admin()));

create policy mentor_reviews_read_participants on public.mentor_reviews for select to authenticated
using ((select private.is_desk_admin()) or mentor_id = (select auth.uid()) or (learner_id = (select auth.uid()) and visibility = 'shared'));
create policy mentor_reviews_insert_assigned_mentor on public.mentor_reviews for insert to authenticated
with check ((select private.is_desk_admin()) or (
 mentor_id = (select auth.uid()) and exists (
  select 1 from public.mentor_assignments a where a.id = assignment_id and a.mentor_id = (select auth.uid()) and a.learner_id = mentor_reviews.learner_id
 )
));
create policy mentor_reviews_update_assigned_mentor on public.mentor_reviews for update to authenticated
using ((select private.is_desk_admin()) or (
 mentor_id = (select auth.uid()) and exists (
  select 1 from public.mentor_assignments a where a.id = assignment_id and a.mentor_id = (select auth.uid())
 )
))
with check ((select private.is_desk_admin()) or (
 mentor_id = (select auth.uid()) and exists (
  select 1 from public.mentor_assignments a where a.id = assignment_id and a.mentor_id = (select auth.uid()) and a.learner_id = mentor_reviews.learner_id
 )
));
