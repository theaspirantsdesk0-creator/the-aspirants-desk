drop policy if exists profiles_read_assigned_learners on public.profiles;
drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_admin_or_assigned_learner
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select private.is_desk_admin())
  or (
    (select private.is_desk_mentor())
    and exists (
      select 1 from public.mentor_assignments a
      where a.mentor_id = (select auth.uid())
        and a.learner_id = profiles.id
    )
  )
);

drop policy if exists profiles_update_admin on public.profiles;
drop policy if exists profiles_update_self_non_privileged on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles for update to authenticated
using (id = (select auth.uid()) or (select private.is_desk_admin()))
with check (id = (select auth.uid()) or (select private.is_desk_admin()));
