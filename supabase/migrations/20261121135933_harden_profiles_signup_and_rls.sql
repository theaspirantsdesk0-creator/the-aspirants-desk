-- Migration: harden_profiles_signup_and_rls
-- Applied to project sqnpxlsprzbgnmgljigg on 2026-11-21.
-- Preserves existing learner rows and the desk_on_auth_user_created trigger.

-- Remove the obsolete second auth trigger. The remaining desk trigger uses
-- desk_handle_new_user(), which does not reference the missing profiles.email column.
drop trigger if exists on_auth_user_created on auth.users;

-- Trigger-only functions must not be callable as ordinary client RPCs.
revoke execute on function public.desk_handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Restrict the admin helper to authenticated users.
revoke execute on function public.is_desk_admin() from public, anon;
grant execute on function public.is_desk_admin() to authenticated;

-- Answer keys are retrieved only through trusted backend operations.
revoke execute on function public.get_pyq_answer(uuid) from public, anon;
grant execute on function public.get_pyq_answer(uuid) to authenticated;

-- Pin the search path for SECURITY DEFINER functions.
alter function public.desk_handle_new_user() set search_path = pg_catalog, public;
alter function public.handle_new_user() set search_path = pg_catalog, public;
alter function public.is_desk_admin() set search_path = pg_catalog, public;
alter function public.get_pyq_answer(uuid) set search_path = pg_catalog, public;

-- Remove overlapping policy versions on public tables before creating
-- the intended least-privilege policies below.
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end
$$;

alter table public.admin_private_notes enable row level security;
alter table public.flashcards enable row level security;
alter table public.notes enable row level security;
alter table public.press enable row level security;
alter table public.profiles enable row level security;
alter table public.progress enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.pyq_answer_keys enable row level security;
alter table public.pyq_attempts enable row level security;
alter table public.pyq_questions enable row level security;
alter table public.pyqs enable row level security;
alter table public.test_results enable row level security;
alter table public.updates enable row level security;
alter table public.user_data enable row level security;

create policy admin_private_notes_admin_all
on public.admin_private_notes for all to authenticated
using ((select public.is_desk_admin()))
with check ((select public.is_desk_admin()));

-- Public study/reference content is readable; writes are admin-only.
create policy flashcards_public_read
on public.flashcards for select to anon, authenticated using (true);
create policy flashcards_admin_insert
on public.flashcards for insert to authenticated
with check ((select public.is_desk_admin()));
create policy flashcards_admin_update
on public.flashcards for update to authenticated
using ((select public.is_desk_admin()))
with check ((select public.is_desk_admin()));
create policy flashcards_admin_delete
on public.flashcards for delete to authenticated
using ((select public.is_desk_admin()));

create policy notes_public_read
on public.notes for select to anon, authenticated using (true);
create policy notes_admin_insert
on public.notes for insert to authenticated
with check ((select public.is_desk_admin()));
create policy notes_admin_update
on public.notes for update to authenticated
using ((select public.is_desk_admin()))
with check ((select public.is_desk_admin()));
create policy notes_admin_delete
on public.notes for delete to authenticated
using ((select public.is_desk_admin()));

create policy press_public_read
on public.press for select to anon, authenticated using (true);
create policy press_admin_insert
on public.press for insert to authenticated
with check ((select public.is_desk_admin()));
create policy press_admin_update
on public.press for update to authenticated
using ((select public.is_desk_admin()))
with check ((select public.is_desk_admin()));
create policy press_admin_delete
on public.press for delete to authenticated
using ((select public.is_desk_admin()));

create policy updates_public_read
on public.updates for select to anon, authenticated using (true);
create policy updates_admin_insert
on public.updates for insert to authenticated
with check ((select public.is_desk_admin()));
create policy updates_admin_update
on public.updates for update to authenticated
using ((select public.is_desk_admin()))
with check ((select public.is_desk_admin()));
create policy updates_admin_delete
on public.updates for delete to authenticated
using ((select public.is_desk_admin()));

create policy pyqs_public_read
on public.pyqs for select to anon, authenticated using (true);
create policy pyqs_admin_insert
on public.pyqs for insert to authenticated
with check ((select public.is_desk_admin()));
create policy pyqs_admin_update
on public.pyqs for update to authenticated
using ((select public.is_desk_admin()))
with check ((select public.is_desk_admin()));
create policy pyqs_admin_delete
on public.pyqs for delete to authenticated
using ((select public.is_desk_admin()));

create policy profiles_read_self_or_admin
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_desk_admin()));
create policy profiles_update_self
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy progress_read_self_or_admin
on public.progress for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_desk_admin()));
create policy progress_insert_self
on public.progress for insert to authenticated
with check (user_id = (select auth.uid()));
create policy progress_update_self
on public.progress for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy progress_delete_self
on public.progress for delete to authenticated
using (user_id = (select auth.uid()));

create policy user_data_owner_all
on public.user_data for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy push_subscriptions_select_own
on public.push_subscriptions for select to authenticated
using (user_id = (select auth.uid()));
create policy push_subscriptions_insert_own
on public.push_subscriptions for insert to authenticated
with check (user_id = (select auth.uid()));
create policy push_subscriptions_update_own
on public.push_subscriptions for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete_own
on public.push_subscriptions for delete to authenticated
using (user_id = (select auth.uid()));

create policy pyq_answer_keys_admin_all
on public.pyq_answer_keys for all to authenticated
using ((select public.is_desk_admin()))
with check ((select public.is_desk_admin()));

create policy pyq_attempts_read_self_or_admin
on public.pyq_attempts for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_desk_admin()));
create policy pyq_attempts_insert_self
on public.pyq_attempts for insert to authenticated
with check (user_id = (select auth.uid()));
create policy pyq_attempts_update_self
on public.pyq_attempts for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy pyq_questions_public_read
on public.pyq_questions for select to anon
using (is_published = true);
create policy pyq_questions_authenticated_read
on public.pyq_questions for select to authenticated
using (is_published = true or (select public.is_desk_admin()));
create policy pyq_questions_admin_insert
on public.pyq_questions for insert to authenticated
with check ((select public.is_desk_admin()));
create policy pyq_questions_admin_update
on public.pyq_questions for update to authenticated
using ((select public.is_desk_admin()))
with check ((select public.is_desk_admin()));
create policy pyq_questions_admin_delete
on public.pyq_questions for delete to authenticated
using ((select public.is_desk_admin()));

create policy test_results_read_self_or_admin
on public.test_results for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_desk_admin()));
create policy test_results_insert_self
on public.test_results for insert to authenticated
with check (user_id = (select auth.uid()));

-- Table grants are limited by these grants and the RLS policies above.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

grant select on public.flashcards, public.notes, public.press, public.updates, public.pyqs
to anon, authenticated;
grant insert, update, delete on public.flashcards, public.notes, public.press, public.updates, public.pyqs
to authenticated;

grant select on public.pyq_questions to anon, authenticated;
grant insert, update, delete on public.pyq_questions to authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select, insert, update, delete on public.user_data, public.progress, public.push_subscriptions
to authenticated;
grant select, insert, update, delete on public.admin_private_notes, public.pyq_answer_keys
to authenticated;
grant select, insert, update on public.pyq_attempts to authenticated;
grant select, insert on public.test_results to authenticated;

-- Cover foreign keys used to retrieve attempts and learner test history.
create index if not exists pyq_attempts_question_id_idx
on public.pyq_attempts(question_id);
create index if not exists test_results_user_created_idx
on public.test_results(user_id, created_at desc);
