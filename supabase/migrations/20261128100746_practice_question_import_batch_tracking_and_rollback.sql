create table public.practice_question_import_batches (
  id uuid primary key default gen_random_uuid(),
  batch_name text not null default 'Question import',
  file_name text,
  source_total integer not null default 0 check (source_total >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  invalid_count integer not null default 0 check (invalid_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  status text not null default 'importing'
    check (status in ('importing','completed','partial','failed','rolled_back')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  rolled_back_at timestamptz,
  rollback_count integer not null default 0 check (rollback_count >= 0),
  rollback_note text,
  import_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(import_summary) = 'object')
);
create index practice_question_import_batches_created_idx
  on public.practice_question_import_batches(created_at desc);
alter table public.practice_question_bank
  add column import_batch_id uuid references public.practice_question_import_batches(id) on delete set null,
  add column import_batch_row integer check (import_batch_row is null or import_batch_row > 0);
create index practice_question_bank_import_batch_idx
  on public.practice_question_bank(import_batch_id, import_batch_row)
  where import_batch_id is not null;

alter table public.practice_question_import_batches enable row level security;
revoke all on public.practice_question_import_batches from anon, authenticated;
grant select, insert, update on public.practice_question_import_batches to authenticated;

create policy practice_question_import_batches_admin_read
  on public.practice_question_import_batches for select to authenticated
  using ((select private.is_desk_admin()));
create policy practice_question_import_batches_admin_insert
  on public.practice_question_import_batches for insert to authenticated
  with check ((select private.is_desk_admin()) and created_by = (select auth.uid()));
create policy practice_question_import_batches_admin_update
  on public.practice_question_import_batches for update to authenticated
  using ((select private.is_desk_admin()))
  with check ((select private.is_desk_admin()));

create or replace function public.rollback_practice_question_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $function$
declare
  batch_row public.practice_question_import_batches;
  total_rows integer;
  blocked_rows integer;
  archived_rows integer;
begin
  if auth.uid() is null or not private.is_desk_admin() then
    raise exception 'Owner/admin access is required to roll back an import batch'
      using errcode = '42501';
  end if;

  select * into batch_row
  from public.practice_question_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'Import batch was not found' using errcode = 'P0002';
  end if;
  if batch_row.status = 'rolled_back' then
    raise exception 'This import batch has already been rolled back' using errcode = '55000';
  end if;
  if batch_row.status = 'importing' then
    raise exception 'An import batch cannot be rolled back while it is still importing' using errcode = '55000';
  end if;

  select count(*) into total_rows
  from public.practice_question_bank
  where import_batch_id = p_batch_id;

  select count(*) into blocked_rows
  from public.practice_question_bank
  where import_batch_id = p_batch_id
    and status <> 'draft';

  if blocked_rows > 0 then
    raise exception 'Rollback blocked: % question(s) have moved beyond Draft. No records were changed.',
      blocked_rows using errcode = '55000';
  end if;

  update public.practice_question_bank
  set status = 'archived'
  where import_batch_id = p_batch_id
    and status = 'draft';

  get diagnostics archived_rows = row_count;

  update public.practice_question_import_batches
  set status = 'rolled_back',
      rolled_back_at = now(),
      rollback_count = archived_rows,
      rollback_note = 'Draft records from this batch archived by owner rollback.'
  where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'records_found', total_rows,
    'records_archived', archived_rows,
    'status', 'rolled_back'
  );
end;
$function$;

revoke all on function public.rollback_practice_question_import_batch(uuid) from public, anon;
grant execute on function public.rollback_practice_question_import_batch(uuid) to authenticated;
