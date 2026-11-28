create table public.practice_question_bank (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (length(btrim(subject)) between 2 and 120),
  topic text not null default '' check (length(topic) <= 160),
  question_text text not null check (length(btrim(question_text)) between 10 and 3000),
  correct_answer text not null check (length(btrim(correct_answer)) between 1 and 1000),
  wrong_options jsonb not null default '[]'::jsonb
    check (jsonb_typeof(wrong_options) = 'array' and jsonb_array_length(wrong_options) = 3),
  explanation text not null check (length(btrim(explanation)) between 5 and 5000),
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  source_url text,
  source_title text,
  review_checks jsonb not null default '{"answer":false,"distractors":false,"explanation":false,"metadata":false,"duplicates":false}'::jsonb
    check (jsonb_typeof(review_checks) = 'object'),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index practice_question_bank_status_subject_idx
  on public.practice_question_bank(status, subject, created_at desc);
create index practice_question_bank_created_by_idx
  on public.practice_question_bank(created_by, created_at desc);

alter table public.practice_question_bank enable row level security;

revoke all on public.practice_question_bank from anon, authenticated;
grant select on public.practice_question_bank to anon, authenticated;
grant insert, update, delete on public.practice_question_bank to authenticated;

create policy practice_question_bank_public_published_read
  on public.practice_question_bank for select to anon
  using (status = 'published');

create policy practice_question_bank_authenticated_read
  on public.practice_question_bank for select to authenticated
  using (status = 'published' or (select private.is_desk_admin()));

create policy practice_question_bank_admin_insert
  on public.practice_question_bank for insert to authenticated
  with check ((select private.is_desk_admin()) and created_by = (select auth.uid()));

create policy practice_question_bank_admin_update
  on public.practice_question_bank for update to authenticated
  using ((select private.is_desk_admin()))
  with check ((select private.is_desk_admin()));

create policy practice_question_bank_admin_delete
  on public.practice_question_bank for delete to authenticated
  using ((select private.is_desk_admin()));

create or replace function private.guard_practice_question_publication()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $function$
begin
  if new.status = 'review' or new.status = 'published' then
    if coalesce(new.source_url, '') !~ '^https://[^[:space:]]+$'
       or nullif(btrim(new.source_title), '') is null
       or new.reviewed_by is null
       or new.reviewed_at is null
       or not coalesce((new.review_checks ->> 'answer')::boolean, false)
       or not coalesce((new.review_checks ->> 'distractors')::boolean, false)
       or not coalesce((new.review_checks ->> 'explanation')::boolean, false)
       or not coalesce((new.review_checks ->> 'metadata')::boolean, false)
       or not coalesce((new.review_checks ->> 'duplicates')::boolean, false) then
      raise exception 'Complete all five checks and record a source, reviewer and review time before review or publication'
        using errcode = '23514';
    end if;
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'review') then
    raise exception 'A question must pass the review stage before publication'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'published'
     and (new.subject, new.topic, new.question_text, new.correct_answer, new.wrong_options,
          new.explanation, new.difficulty, new.source_url, new.source_title)
         is distinct from
         (old.subject, old.topic, old.question_text, old.correct_answer, old.wrong_options,
          old.explanation, old.difficulty, old.source_url, old.source_title) then
    raise exception 'Move a published question back to draft before editing its content'
      using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function private.guard_practice_question_publication() from public, anon, authenticated;

drop trigger if exists guard_practice_question_publication_before_write on public.practice_question_bank;
create trigger guard_practice_question_publication_before_write
before insert or update on public.practice_question_bank
for each row execute function private.guard_practice_question_publication();
