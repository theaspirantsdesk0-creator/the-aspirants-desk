-- Column privilege is combined with the trigger guard installed in the preceding migration.
-- Authenticated users may submit role updates, but only the site owner can change role values.
grant update (role) on public.profiles to authenticated;
