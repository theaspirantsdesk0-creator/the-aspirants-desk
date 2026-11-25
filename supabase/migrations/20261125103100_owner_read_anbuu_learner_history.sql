-- The verified owner may inspect learner Anbuu lesson history and mentor state.
-- These records remain inaccessible to learner and mentor client roles.
GRANT SELECT ON TABLE public.anbuu_lesson_history TO authenticated;
GRANT SELECT ON TABLE public.anbuu_mentor_state TO authenticated;

CREATE POLICY "anbuu_lesson_history_admin_read_all"
ON public.anbuu_lesson_history
FOR SELECT
TO authenticated
USING ((SELECT private.is_desk_admin()));

CREATE POLICY "anbuu_mentor_state_admin_read_all"
ON public.anbuu_mentor_state
FOR SELECT
TO authenticated
USING ((SELECT private.is_desk_admin()));