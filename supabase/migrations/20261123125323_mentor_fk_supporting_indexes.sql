create index if not exists mentor_assignments_created_by_idx on public.mentor_assignments(created_by);
create index if not exists mentor_reviews_learner_id_idx on public.mentor_reviews(learner_id);
create index if not exists mentor_reviews_mentor_id_idx on public.mentor_reviews(mentor_id);
