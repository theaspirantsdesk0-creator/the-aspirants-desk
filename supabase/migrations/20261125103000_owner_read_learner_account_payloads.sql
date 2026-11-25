-- Let the verified site owner review learner-owned account payloads from the owner console.
-- Learners retain full access only to their own row through user_data_owner_all.
-- This adds read-only admin visibility; it does not grant admins write/delete access.
CREATE POLICY "user_data_admin_read_all"
ON public.user_data
FOR SELECT
TO authenticated
USING ((SELECT private.is_desk_admin()));