-- G247 — real Supabase Auth session existence and same-transaction lock.
-- For QORE Mobile STAGING project mrjzxftsdxzepzbcuids only; never CI fixtures.
-- Only trusted server may invoke public wrappers via service_role, AFTER
-- Auth.getUser(bearer) verified the signed token and checked its subject.
-- Important: _user/_session/_iat_ms are NOT themselves authentication.
-- Server MUST independently verify JWT signature, subject, exp, session_id,
-- session non-anonymous and G38/G71/legality before sensitive changes.
DO $preflight$
BEGIN
 IF to_regclass('public.mobility_stage_auto_demo_trips') IS NULL
    OR to_regclass('public.mobility_stage_backoffice_roles') IS NULL
    OR to_regclass('auth.sessions') IS NULL
    OR (SELECT count(*) FROM auth.users)<>0
    OR to_regprocedure('public.mobility_stage_g42_session_active(uuid,uuid,bigint)') IS NOT NULL
    OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NOT NULL
 THEN RAISE EXCEPTION 'G247 isolated empty Supabase STAGING prerequisites not met'; END IF;
END $preflight$;

CREATE SCHEMA IF NOT EXISTS qore_private;
REVOKE ALL ON SCHEMA qore_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA qore_private TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA qore_private
 REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE FUNCTION qore_private.g247_provider_session_active(
 _user uuid,_session uuid,_iat_ms bigint
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path='' AS $body$
 SELECT COALESCE(
  _user IS NOT NULL AND _session IS NOT NULL
  AND _iat_ms BETWEEN 946684800000 AND 4102444800000
  AND pg_catalog.to_timestamp(_iat_ms/1000.0)
       <= pg_catalog.statement_timestamp()+INTERVAL '60 seconds'
  AND EXISTS(
   SELECT 1 FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id
   WHERE s.id=_session AND s.user_id=_user
    AND u.is_anonymous IS FALSE
    AND (u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL)
    AND u.deleted_at IS NULL
    AND (u.banned_until IS NULL OR u.banned_until<=pg_catalog.statement_timestamp())
    AND (s.not_after IS NULL OR s.not_after>pg_catalog.statement_timestamp())
    AND s.created_at<=pg_catalog.to_timestamp(_iat_ms/1000.0)+INTERVAL '60 seconds'
  ),false);
$body$;

CREATE FUNCTION qore_private.g247_lock_provider_session(
 _user uuid,_session uuid,_iat_ms bigint
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path='' SET lock_timeout='500ms'
AS $body$
DECLARE locked_session uuid;
BEGIN
 IF _user IS NULL OR _session IS NULL OR _iat_ms IS NULL
 THEN RETURN false; END IF;
 SELECT s.id INTO locked_session
 FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id
 WHERE s.id=_session AND s.user_id=_user
 FOR SHARE OF s,u;
 IF NOT FOUND THEN RETURN false; END IF;
 RETURN qore_private.g247_provider_session_active(_user,_session,_iat_ms);
END;
$body$;

REVOKE ALL ON FUNCTION qore_private.g247_provider_session_active(uuid,uuid,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION qore_private.g247_lock_provider_session(uuid,uuid,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION qore_private.g247_provider_session_active(uuid,uuid,bigint)
 TO service_role;
GRANT EXECUTE ON FUNCTION qore_private.g247_lock_provider_session(uuid,uuid,bigint)
 TO service_role;

-- Exposed RPC wrappers use caller permissions; NEVER SECURITY DEFINER in public.
CREATE FUNCTION public.mobility_stage_g42_session_active(
 _user uuid,_session uuid,_iat_ms bigint
) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path='' AS $body$
 SELECT qore_private.g247_provider_session_active(_user,_session,_iat_ms);
$body$;

CREATE FUNCTION public.mobility_stage_g42_lock_session(
 _user uuid,_session uuid,_iat_ms bigint
) RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path='' AS $body$
 SELECT qore_private.g247_lock_provider_session(_user,_session,_iat_ms);
$body$;

REVOKE ALL ON FUNCTION public.mobility_stage_g42_session_active(uuid,uuid,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g42_lock_session(uuid,uuid,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g42_session_active(uuid,uuid,bigint)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g42_lock_session(uuid,uuid,bigint)
 TO service_role;
