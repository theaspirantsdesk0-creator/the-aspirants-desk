-- Lock down public role-assignment RPC. Roles are assigned by project administrators.
DROP FUNCTION IF EXISTS public.admin_set_profile_role(uuid, text);
