-- Supporting indexes for foreign keys used by the practice-question review,
-- import-batch history, and question-version activity workflows.
-- Applied to production migration 20261128121418.

create index if not exists practice_question_activity_actor_id_idx
  on public.practice_question_activity (actor_id);

create index if not exists practice_question_activity_question_id_idx
  on public.practice_question_activity (question_id);

create index if not exists practice_question_bank_reviewed_by_idx
  on public.practice_question_bank (reviewed_by);

create index if not exists practice_question_import_batches_created_by_idx
  on public.practice_question_import_batches (created_by);

create index if not exists practice_question_versions_actor_id_idx
  on public.practice_question_versions (actor_id);

create index if not exists practice_question_versions_question_id_idx
  on public.practice_question_versions (question_id);
