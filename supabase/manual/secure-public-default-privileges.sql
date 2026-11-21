-- OPTIONAL FUTURE-OBJECT HARDENING ONLY.
-- This script does NOT change privileges on existing tables, functions or sequences.
-- It prevents future objects created by these roles in public from automatically
-- receiving Data API privileges. Each future migration must explicitly grant only
-- the privileges it needs and enable RLS for any exposed table.
--
-- The connected Supabase SQL tool could not apply ALTER DEFAULT PRIVILEGES because
-- its execution role lacks permission to change the owners' default ACLs.
-- Run this only from the Supabase SQL Editor as a database role that owns these
-- default privileges (normally postgres). If Supabase rejects the supabase_admin
-- block, do not attempt to bypass the permission boundary; ask the project owner
-- to review that block separately.

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

alter default privileges for role supabase_admin in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
