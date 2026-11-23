-- Support owner review lookups and joins on the reviewer foreign key.
create index if not exists courses_reviewed_by_idx
  on public.courses (reviewed_by);
