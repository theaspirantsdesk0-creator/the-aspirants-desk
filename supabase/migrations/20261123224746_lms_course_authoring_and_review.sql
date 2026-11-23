create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 4 and 140),
  summary text not null check (char_length(trim(summary)) between 10 and 1200),
  category text not null default 'General' check (char_length(trim(category)) between 2 and 80),
  level text not null default 'beginner' check (level in ('beginner','intermediate','advanced')),
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 600),
  outcomes jsonb not null default '[]'::jsonb
    check (case when jsonb_typeof(outcomes) = 'array' then jsonb_array_length(outcomes) between 1 and 12 else false end),
  lessons jsonb not null default '[]'::jsonb
    check (case when jsonb_typeof(lessons) = 'array' then jsonb_array_length(lessons) between 1 and 30 else false end),
  status text not null default 'draft' check (status in ('draft','pending_review','published','rejected','archived')),
  review_note text check (review_note is null or char_length(review_note) <= 1200),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courses_status_created_idx
  on public.courses(status, created_at desc);
create index if not exists courses_author_status_idx
  on public.courses(created_by, status, updated_at desc);

alter table public.courses enable row level security;
revoke all on table public.courses from anon, authenticated;
grant usage on schema private to authenticated;
grant select on public.courses to authenticated;
grant insert (created_by, title, summary, category, level, duration_minutes, outcomes, lessons)
  on public.courses to authenticated;
grant update (title, summary, category, level, duration_minutes, outcomes, lessons, status, review_note, reviewed_by, reviewed_at, updated_at)
  on public.courses to authenticated;

create policy courses_read_published_owner_admin
  on public.courses for select to authenticated
  using (status = 'published' or created_by = (select auth.uid()) or (select private.is_desk_admin()));

create policy courses_insert_mentor_or_admin
  on public.courses for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and ((select private.is_desk_mentor()) or (select private.is_desk_admin()))
  );

create policy courses_update_author_or_admin
  on public.courses for update to authenticated
  using (
    (select private.is_desk_admin())
    or (
      (select private.is_desk_mentor())
      and created_by = (select auth.uid())
      and status in ('draft','rejected')
    )
  )
  with check (
    (select private.is_desk_admin())
    or (
      (select private.is_desk_mentor())
      and created_by = (select auth.uid())
      and status in ('draft','rejected','pending_review')
    )
  );

create or replace function public.guard_course_workflow()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Course ownership cannot be changed' using errcode = '42501';
  end if;

  if not private.is_desk_admin() then
    if not private.is_desk_mentor() then
      raise exception 'Only active mentors or the site owner may edit courses' using errcode = '42501';
    end if;

    if new.status is distinct from old.status then
      if old.status in ('draft','rejected') and new.status = 'pending_review' then
        new.review_note := null;
        new.reviewed_by := null;
        new.reviewed_at := null;
      else
        raise exception 'Mentors may only submit draft or rejected courses for review' using errcode = '42501';
      end if;
    elsif new.review_note is distinct from old.review_note
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'Only the site owner may change course review details' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_course_workflow() from public, anon, authenticated;
drop trigger if exists guard_course_workflow on public.courses;
create trigger guard_course_workflow
  before update on public.courses
  for each row execute function public.guard_course_workflow();
