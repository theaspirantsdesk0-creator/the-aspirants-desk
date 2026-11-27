-- Require complete source evidence before an official PYQ can be published.
alter table public.pyq_questions
  drop constraint if exists pyq_questions_publication_requires_upsc_source;

alter table public.pyq_questions
  add constraint pyq_questions_publication_requires_upsc_source
  check (
    not is_published
    or (
      source_verified = true
      and nullif(btrim(question_number), '') is not null
      and source_verified_at is not null
      and nullif(btrim(source_verification_method), '') is not null
      and source_reference ~ '^https://(www[.])?upsc[.]gov[.]in(/|$)'
    )
  );
