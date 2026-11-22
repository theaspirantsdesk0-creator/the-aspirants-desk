-- Applied to Supabase project sqnpxlsprzbgnmgljigg as migration role_aware_ai_assistant.
-- Roles are assigned only through an administrator-controlled RPC.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('learner','mentor','admin'));
REVOKE UPDATE (role) ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.admin_set_profile_role(p_user_id uuid,p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_desk_admin() THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 IF p_role NOT IN ('learner','mentor','admin') THEN RAISE EXCEPTION 'Invalid profile role' USING ERRCODE='22023'; END IF;
 UPDATE public.profiles SET role=p_role WHERE id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found' USING ERRCODE='P0002'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_profile_role(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_role(uuid,text) TO authenticated;
CREATE TABLE IF NOT EXISTS private.ai_daily_usage(user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,usage_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,message_count integer NOT NULL DEFAULT 0 CHECK(message_count>=0),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,usage_date));
ALTER TABLE private.ai_daily_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.ai_daily_usage FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE private.ai_daily_usage TO service_role;
CREATE OR REPLACE FUNCTION public.consume_ai_daily_quota(p_user_id uuid,p_daily_limit integer DEFAULT 20)
RETURNS TABLE(allowed boolean,remaining integer,used integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,private AS $$
DECLARE v_jwt_role text; v_count integer; v_today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
 v_jwt_role:=COALESCE(NULLIF(current_setting('request.jwt.claim.role',true),''),NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role','');
 IF v_jwt_role<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 IF p_user_id IS NULL OR p_daily_limit<1 OR p_daily_limit>50 THEN RAISE EXCEPTION 'Invalid quota request' USING ERRCODE='22023'; END IF;
 INSERT INTO private.ai_daily_usage AS usage(user_id,usage_date,message_count,updated_at) VALUES(p_user_id,v_today,1,now())
 ON CONFLICT(user_id,usage_date) DO UPDATE SET message_count=usage.message_count+1,updated_at=now()
 WHERE usage.message_count<p_daily_limit RETURNING message_count INTO v_count;
 IF v_count IS NULL THEN SELECT usage.message_count INTO v_count FROM private.ai_daily_usage usage WHERE usage.user_id=p_user_id AND usage.usage_date=v_today; RETURN QUERY SELECT false,0,COALESCE(v_count,p_daily_limit);
 ELSE RETURN QUERY SELECT true,GREATEST(0,p_daily_limit-v_count),v_count; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.consume_ai_daily_quota(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_daily_quota(uuid,integer) TO service_role;
