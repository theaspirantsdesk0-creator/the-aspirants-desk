-- Migration: move_security_helpers_to_private_schema
-- Applied to project sqnpxlsprzbgnmgljigg on 2026-11-21.
-- These helpers must not be exposed as public Data API RPC endpoints.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.is_desk_admin() set schema private;
alter function public.get_pyq_answer(uuid) set schema private;

revoke all on function private.is_desk_admin() from public, anon, authenticated;
grant execute on function private.is_desk_admin() to authenticated;

revoke all on function private.get_pyq_answer(uuid) from public, anon, authenticated;

drop function if exists public.handle_new_user();
