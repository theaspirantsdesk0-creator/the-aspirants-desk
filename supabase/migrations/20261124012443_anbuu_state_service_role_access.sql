-- Keep learner mentor state inaccessible to browser roles.
-- The Edge Function accesses this public-schema table with service_role only.
CREATE TABLE IF NOT EXISTS public.anbuu_mentor_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_study_plan jsonb,
  doubt_log jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(doubt_log) = 'array'),
  pending_tasks jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(pending_tasks) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT anbuu_public_plan_object_check
    CHECK (active_study_plan IS NULL OR jsonb_typeof(active_study_plan) = 'object')
);
ALTER TABLE public.anbuu_mentor_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.anbuu_mentor_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.anbuu_mentor_state TO service_role;
CREATE POLICY "Service role manages Anbuu mentor state"
  ON public.anbuu_mentor_state
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
