-- Only source-verified, traceable questions may enter the public PYQ bank.
create or replace function private.guard_pyq_publication()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $function$
begin
  if new.is_published is true
     and (
       new.source_verified is distinct from true
       or nullif(btrim(new.source_reference), '') is null
       or nullif(btrim(new.question_text), '') is null
     ) then
    raise exception 'A PYQ must have a verified source reference and question text before publication'
      using errcode = '23514';
  end if;
  return new;
end;
$function$;

revoke all on function private.guard_pyq_publication() from public, anon, authenticated;

drop trigger if exists guard_pyq_publication_before_write on public.pyq_questions;
create trigger guard_pyq_publication_before_write
before insert or update of is_published, source_verified, source_reference, question_text
on public.pyq_questions
for each row execute function private.guard_pyq_publication();
