-- Completing an Anbuu guided lesson queues one deterministic revision task.
-- This function runs only through the JWT-validated Edge Function using service_role.
CREATE OR REPLACE FUNCTION public.complete_anbuu_lesson_and_queue_revision(
  p_lesson_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_lesson record;
  v_tasks jsonb;
  v_task jsonb;
  v_lesson_json jsonb;
  v_state_json jsonb;
  v_task_id text;
  v_task_exists boolean;
  v_task_created boolean := false;
  v_due_date text := (CURRENT_DATE + 1)::text;
BEGIN
  IF p_lesson_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Lesson and user are required';
  END IF;

  SELECT id, user_id, track, subject, topic, level, status, created_at, updated_at, completed_at
    INTO v_lesson
    FROM public.anbuu_lesson_history
    WHERE id = p_lesson_id AND user_id = p_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found for this learner';
  END IF;

  UPDATE public.anbuu_lesson_history
    SET status = 'completed', updated_at = now(), completed_at = now()
    WHERE id = p_lesson_id AND user_id = p_user_id
    RETURNING to_jsonb(public.anbuu_lesson_history.*) INTO v_lesson_json;

  v_task_id := 'lesson-review-' || p_lesson_id::text;
  v_task := jsonb_build_object(
    'id', v_task_id,
    'title', 'Review: ' || v_lesson.subject || CASE WHEN coalesce(v_lesson.topic, '') = '' THEN '' ELSE ' — ' || v_lesson.topic END,
    'description', 'Use active recall to review this completed Anbuu lesson, then answer a few practice questions.',
    'due_date', v_due_date,
    'status', 'pending'
  );

  SELECT pending_tasks INTO v_tasks
    FROM public.anbuu_mentor_state
    WHERE user_id = p_user_id
    FOR UPDATE;

  v_tasks := coalesce(v_tasks, '[]'::jsonb);
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_tasks) AS task(value)
    WHERE task.value->>'id' = v_task_id
  ) INTO v_task_exists;

  IF v_task_exists THEN
    SELECT coalesce(jsonb_agg(
      CASE WHEN item.value->>'id' = v_task_id
        THEN jsonb_set(jsonb_set(item.value, '{status}', '"pending"'::jsonb), '{due_date}', to_jsonb(v_due_date))
        ELSE item.value
      END ORDER BY item.ordinality
    ), '[]'::jsonb)
    INTO v_tasks
    FROM jsonb_array_elements(v_tasks) WITH ORDINALITY AS item(value, ordinality);
  ELSE
    IF jsonb_array_length(v_tasks) >= 40 THEN
      SELECT coalesce(jsonb_agg(item.value ORDER BY item.ordinality), '[]'::jsonb)
        INTO v_tasks
        FROM (
          SELECT value, ordinality
          FROM jsonb_array_elements(v_tasks) WITH ORDINALITY
          ORDER BY ordinality DESC
          LIMIT 39
        ) AS item;
    END IF;
    v_tasks := v_tasks || jsonb_build_array(v_task);
    v_task_created := true;
  END IF;

  INSERT INTO public.anbuu_mentor_state (user_id, pending_tasks, updated_at)
    VALUES (p_user_id, v_tasks, now())
    ON CONFLICT (user_id) DO UPDATE
      SET pending_tasks = EXCLUDED.pending_tasks, updated_at = EXCLUDED.updated_at;

  SELECT to_jsonb(state_row) INTO v_state_json
    FROM (
      SELECT active_study_plan, doubt_log, pending_tasks
      FROM public.anbuu_mentor_state
      WHERE user_id = p_user_id
    ) AS state_row;

  RETURN jsonb_build_object(
    'lesson', v_lesson_json,
    'mentorState', v_state_json,
    'revisionTaskCreated', v_task_created,
    'revisionTaskId', v_task_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_anbuu_lesson_and_queue_revision(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_anbuu_lesson_and_queue_revision(uuid, uuid)
  TO service_role;
