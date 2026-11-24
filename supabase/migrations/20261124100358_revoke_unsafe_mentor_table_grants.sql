-- These mentor records are strictly for authenticated participants and the site owner.
-- RLS policies remain the row-level authorization boundary; remove unsafe role-level
-- grants that RLS cannot constrain (notably TRUNCATE).
REVOKE ALL PRIVILEGES ON TABLE public.mentor_assignments, public.mentor_reviews FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.mentor_assignments, public.mentor_reviews FROM authenticated;
