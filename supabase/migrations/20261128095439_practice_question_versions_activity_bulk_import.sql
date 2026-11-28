-- Immutable version snapshots, reviewer activity and duplicate guard for the practice bank.
create table public.practice_question_versions (
 id uuid primary key default gen_random_uuid(),
 question_id uuid references public.practice_question_bank(id) on delete set null,
 question_key uuid not null,
 version_no integer not null check (version_no > 0),
 event_type text not null check (event_type in ('created','updated','submitted_for_review','published','archived','returned_to_draft','deleted')),
 snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
 actor_id uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(question_key, version_no)
);
create index practice_question_versions_question_idx on public.practice_question_versions(question_key, version_no desc);
create table public.practice_question_activity (
 id uuid primary key default gen_random_uuid(),
 question_id uuid references public.practice_question_bank(id) on delete set null,
 question_key uuid not null,
 event_type text not null check (event_type in ('created','updated','submitted_for_review','published','archived','returned_to_draft','deleted')),
 actor_id uuid references public.profiles(id) on delete set null,
 details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
 created_at timestamptz not null default now()
);
create index practice_question_activity_question_idx on public.practice_question_activity(question_key, created_at desc);
alter table public.practice_question_versions enable row level security;
alter table public.practice_question_activity enable row level security;
revoke all on public.practice_question_versions, public.practice_question_activity from anon, authenticated;
grant select on public.practice_question_versions, public.practice_question_activity to authenticated;
create policy practice_question_versions_admin_read on public.practice_question_versions for select to authenticated using ((select private.is_desk_admin()));
create policy practice_question_activity_admin_read on public.practice_question_activity for select to authenticated using ((select private.is_desk_admin()));
create unique index practice_question_bank_no_active_exact_duplicates
 on public.practice_question_bank(lower(btrim(subject)),lower(regexp_replace(btrim(question_text),'[^[:alnum:]]+',' ','g')))
 where status <> 'archived';
create or replace function private.capture_practice_question_history()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private
as $function$
declare
 row_data public.practice_question_bank;
 question_uuid uuid;
 old_status text;
 new_status text;
 action_name text;
 next_version integer;
 snapshot_data jsonb;
 actor uuid;
begin
 actor := auth.uid();
 if tg_op = 'DELETE' then row_data:=old; question_uuid:=old.id; old_status:=old.status; new_status:=null; action_name:='deleted';
 elsif tg_op = 'INSERT' then row_data:=new; question_uuid:=new.id; old_status:=null; new_status:=new.status; action_name:='created';
 else
  row_data:=new; question_uuid:=new.id; old_status:=old.status; new_status:=new.status;
  if (to_jsonb(new)-'updated_at')=(to_jsonb(old)-'updated_at') then return new; end if;
  if old.status is distinct from new.status and new.status='review' then action_name:='submitted_for_review';
  elsif old.status is distinct from new.status and new.status='published' then action_name:='published';
  elsif old.status is distinct from new.status and new.status='archived' then action_name:='archived';
  elsif old.status is distinct from new.status and old.status='published' and new.status='draft' then action_name:='returned_to_draft';
  else action_name:='updated'; end if;
 end if;
 select coalesce(max(v.version_no),0)+1 into next_version from public.practice_question_versions v where v.question_key=question_uuid;
 snapshot_data:=jsonb_build_object('subject',row_data.subject,'topic',row_data.topic,'question_text',row_data.question_text,'correct_answer',row_data.correct_answer,'wrong_options',row_data.wrong_options,'explanation',row_data.explanation,'difficulty',row_data.difficulty,'status',row_data.status,'source_url',row_data.source_url,'source_title',row_data.source_title,'review_checks',row_data.review_checks,'reviewed_by',row_data.reviewed_by,'reviewed_at',row_data.reviewed_at,'created_by',row_data.created_by,'updated_at',row_data.updated_at);
 insert into public.practice_question_versions(question_id,question_key,version_no,event_type,snapshot,actor_id)
 values(case when tg_op='DELETE' then null else question_uuid end,question_uuid,next_version,action_name,snapshot_data,actor);
 insert into public.practice_question_activity(question_id,question_key,event_type,actor_id,details)
 values(case when tg_op='DELETE' then null else question_uuid end,question_uuid,action_name,actor,jsonb_build_object('from_status',old_status,'to_status',new_status,'subject',row_data.subject,'question_preview',left(row_data.question_text,180),'version_no',next_version));
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$function$;
revoke all on function private.capture_practice_question_history() from public,anon,authenticated;
drop trigger if exists capture_practice_question_history_after_write on public.practice_question_bank;
create trigger capture_practice_question_history_after_write after insert or update or delete on public.practice_question_bank for each row execute function private.capture_practice_question_history();
