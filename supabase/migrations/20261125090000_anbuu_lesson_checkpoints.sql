-- Persist the learner's three guided-lesson checkpoints across devices.
ALTER TABLE public.anbuu_lesson_history
  ADD COLUMN IF NOT EXISTS checkpoint_completed text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.anbuu_lesson_history
  DROP CONSTRAINT IF EXISTS anbuu_lesson_checkpoint_values_check;

ALTER TABLE public.anbuu_lesson_history
  ADD CONSTRAINT anbuu_lesson_checkpoint_values_check
  CHECK (checkpoint_completed <@ ARRAY['concept', 'practice', 'recap']::text[]);

CREATE OR REPLACE FUNCTION public.set_anbuu_lesson_checkpoint(
  p_lesson_id uuid,
  p_user_id uuid,
  p_checkpoint text,
  p_completed boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_lesson_json jsonb;
BEGIN
  IF p_lesson_id IS NULL OR p_user_id IS NULL
     OR p_checkpoint IS NULL
     OR p_checkpoint NOT IN ('concept', 'practice', 'recap')
     OR p_completed IS NULL THEN
    RAISE EXCEPTION 'A valid lesson, learner, checkpoint and completion state are required';
  END IF;

  UPDATE public.anbuu_lesson_history
  SET checkpoint_completed = CASE
        WHEN p_completed AND NOT (p_checkpoint = ANY(checkpoint_completed))
          THEN array_append(checkpoint_completed, p_checkpoint)
        WHEN NOT p_completed
          THEN array_remove(checkpoint_completed, p_checkpoint)
        ELSE checkpoint_completed
      END,
      updated_at = now()
  WHERE id = p_lesson_id
    AND user_id = p_user_id
    AND status <> 'completed'
  RETURNING to_jsonb(public.anbuu_lesson_history.*) INTO v_lesson_json;

  RETURN v_lesson_json;
END;
$$;

REVOKE ALL ON FUNCTION public.set_anbuu_lesson_checkpoint(uuid, uuid, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_anbuu_lesson_checkpoint(uuid, uuid, text, boolean)
  TO service_role;
