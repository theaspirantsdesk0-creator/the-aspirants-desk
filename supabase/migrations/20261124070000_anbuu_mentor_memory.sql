-- Anbuu mentor memory: one private, per-user state record.
-- All access is mediated by the authenticated ai-assistant Edge Function.
CREATE TABLE IF NOT EXISTS private.anbuu_mentor_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_study_plan jsonb,
  doubt_log jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(doubt_log) = 'array'),
  pending_tasks jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(pending_tasks) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT anbuu_plan_object_check
    CHECK (active_study_plan IS NULL OR jsonb_typeof(active_study_plan) = 'object')
);

REVOKE ALL ON TABLE private.anbuu_mentor_state FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE private.anbuu_mentor_state TO service_role;
