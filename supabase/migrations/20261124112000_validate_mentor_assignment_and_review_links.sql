-- Enforce mentor/learner role integrity in the database, not only in owner UI dropdowns.
-- Trigger functions run as invoker and are not callable as public RPC endpoints.
create or replace function public.validate_mentor_assignment_roles()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  mentor_role text;
  learner_role text;
begin
  if not private.is_desk_admin() then
    raise exception 'Only the site owner can manage mentor assignments' using errcode = '42501';
  end if;

  select p.role into mentor_role from public.profiles p where p.id = new.mentor_id;
  select p.role into learner_role from public.profiles p where p.id = new.learner_id;

  if mentor_role is distinct from 'mentor' then
    raise exception 'The selected account is not an approved mentor' using errcode = '23514';
  end if;
  if learner_role is distinct from 'learner' then
    raise exception 'The selected account is not a learner' using errcode = '23514';
  end if;
  if new.created_by is distinct from auth.uid() then
    raise exception 'Assignment creator must be the signed-in site owner' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_mentor_assignment_roles() from public, anon, authenticated;

drop trigger if exists validate_mentor_assignment_roles on public.mentor_assignments;
create trigger validate_mentor_assignment_roles
before insert or update of mentor_id, learner_id, created_by
on public.mentor_assignments
for each row execute function public.validate_mentor_assignment_roles();

-- A review must always refer to the learner on its selected assignment.
-- Mentors may review only their own assigned learner; the site owner may author an
-- administrative review but it must identify the signed-in owner as its author.
create or replace function public.validate_mentor_review_assignment()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  assigned_learner uuid;
  assigned_mentor uuid;
begin
  select a.learner_id, a.mentor_id
    into assigned_learner, assigned_mentor
  from public.mentor_assignments a
  where a.id = new.assignment_id;

  if assigned_learner is null then
    raise exception 'The selected mentoring assignment does not exist' using errcode = '23503';
  end if;

  if new.learner_id is distinct from assigned_learner then
    raise exception 'Review learner must match the selected assignment' using errcode = '23514';
  end if;

  if private.is_desk_admin() then
    if new.mentor_id is distinct from auth.uid() then
      raise exception 'Owner-authored reviews must identify the signed-in owner' using errcode = '42501';
    end if;
  elsif not private.is_desk_mentor()
     or new.mentor_id is distinct from auth.uid()
     or assigned_mentor is distinct from auth.uid() then
    raise exception 'Only the assigned mentor or site owner can write this review' using errcode = '42501';
  end if;

  return new;
end;
$$;
revoke all on function public.validate_mentor_review_assignment() from public, anon, authenticated;

drop trigger if exists validate_mentor_review_assignment on public.mentor_reviews;
create trigger validate_mentor_review_assignment
before insert or update of assignment_id, mentor_id, learner_id
on public.mentor_reviews
for each row execute function public.validate_mentor_review_assignment();
