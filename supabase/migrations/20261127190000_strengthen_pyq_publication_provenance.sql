-- Add provenance fields and publication guardrails for official UPSC PYQs.
alter table public.pyq_questions
  add column if not exists question_number text,
  add column if not exists source_verified_at timestamptz,
  add column if not exists source_verification_method text;

create index if not exists pyq_questions_published_lookup_idx
  on public.pyq_questions (exam_year desc, stage, paper)
  where is_published = true and source_verified = true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pyq_questions'::regclass
      and conname = 'pyq_questions_publication_requires_upsc_source'
  ) then
    alter table public.pyq_questions
      add constraint pyq_questions_publication_requires_upsc_source
      check (
        not is_published
        or (
          source_verified = true
          and source_reference ~ '^https://(www[.])?upsc[.]gov[.]in(/|$)'
        )
      );
  end if;
end
$$;
