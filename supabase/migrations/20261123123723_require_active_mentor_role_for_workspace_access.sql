create or replace function private.is_desk_mentor()
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'mentor');
$$;
revoke all on function private.is_desk_mentor() from public, anon;
grant execute on function private.is_desk_mentor() to authenticated;

drop policy if exists mentor_assignments_read_participants on public.mentor_assignments;
create policy mentor_assignments_read_participants on public.mentor_assignments for select to authenticated
using ((select private.is_desk_admin()) or ((select private.is_desk_mentor()) and mentor_id = (select auth.uid())) or learner_id = (select auth.uid()));

drop policy if exists mentor_reviews_read_participants on public.mentor_reviews;
create policy mentor_reviews_read_participants on public.mentor_reviews for select to authenticated
using ((select private.is_desk_admin()) or ((select private.is_desk_mentor()) and mentor_id = (select auth.uid())) or (learner_id = (select auth.uid()) and visibility = 'shared'));

drop policy if exists mentor_reviews_insert_assigned_mentor on public.mentor_reviews;
create policy mentor_reviews_insert_assigned_mentor on public.mentor_reviews for insert to authenticated
with check ((select private.is_desk_admin()) or (
 (select private.is_desk_mentor()) and mentor_id = (select auth.uid()) and exists (
  select 1 from public.mentor_assignments a where a.id = assignment_id and a.mentor_id = (select auth.uid()) and a.learner_id = mentor_reviews.learner_id
 )
));

drop policy if exists mentor_reviews_update_assigned_mentor on public.mentor_reviews;
create policy mentor_reviews_update_assigned_mentor on public.mentor_reviews for update to authenticated
using ((select private.is_desk_admin()) or (
 (select private.is_desk_mentor()) and mentor_id = (select auth.uid()) and exists (
  select 1 from public.mentor_assignments a where a.id = assignment_id and a.mentor_id = (select auth.uid())
 )
))
with check ((select private.is_desk_admin()) or (
 (select private.is_desk_mentor()) and mentor_id = (select auth.uid()) and exists (
  select 1 from public.mentor_assignments a where a.id = assignment_id and a.mentor_id = (select auth.uid()) and a.learner_id = mentor_reviews.learner_id
 )
));

drop policy if exists profiles_read_assigned_learners on public.profiles;
create policy profiles_read_assigned_learners on public.profiles for select to authenticated
using ((select private.is_desk_mentor()) and exists (
 select 1 from public.mentor_assignments a where a.mentor_id = (select auth.uid()) and a.learner_id = profiles.id
));
