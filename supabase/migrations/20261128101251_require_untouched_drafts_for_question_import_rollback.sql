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
  from public.practice_question_bank q
  where q.import_batch_id = p_batch_id
    and (
      q.status <> 'draft'
      or not exists (
        select 1 from public.practice_question_versions v
        where v.question_key = q.id and v.event_type = 'created'
      )
      or exists (
        select 1 from public.practice_question_versions v
        where v.question_key = q.id and v.event_type <> 'created'
      )
    );

  if blocked_rows > 0 then
    raise exception 'Rollback blocked: % question(s) have been edited, reviewed, published or otherwise changed since import. No records were changed.',
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
      rollback_note = 'Only untouched draft records from this batch were archived by owner rollback.'
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
