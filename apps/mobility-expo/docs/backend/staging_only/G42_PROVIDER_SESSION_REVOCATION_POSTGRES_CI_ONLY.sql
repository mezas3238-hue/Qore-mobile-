-- G42 A23 — provider-sourced session revocation boundary in PG16 disposable.
-- This table is NOT a self-service session issuer. The QA owner seeds records.
-- No real Supabase/GCP deployment, no browser grants, no credential storage.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g41_admin_incident_triage_page(uuid,bigint,text,integer,text,text)') IS NULL
 THEN RAISE EXCEPTION 'G42 refuses non-disposable/incomplete G41 chain'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g42_provider_session_grants (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 session_id uuid NOT NULL,
 provider_confirmed_at timestamptz NOT NULL,
 token_allowed_from timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 revoked_at timestamptz,
 evidence_kind text NOT NULL CHECK (
   evidence_kind='QA_SYNTHETIC_PROVIDER_SESSION_ONLY'),
 revision bigint NOT NULL DEFAULT 1 CHECK (revision>0),
 PRIMARY KEY(user_id,session_id),
 CHECK(valid_until>provider_confirmed_at),
 CHECK(token_allowed_from>=provider_confirmed_at),
 CHECK(token_allowed_from<valid_until),
 CHECK(revoked_at IS NULL OR revoked_at>=provider_confirmed_at)
);
CREATE INDEX mobility_stage_g42_session_revocation_probe
 ON public.mobility_stage_g42_provider_session_grants(session_id,user_id)
 WHERE revoked_at IS NULL;
ALTER TABLE public.mobility_stage_g42_provider_session_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g42_provider_session_grants
 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mobility_stage_g42_session_active(
 _user uuid,_session uuid,_iat_ms bigint DEFAULT NULL
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $q$
 SELECT COALESCE(EXISTS(
  SELECT 1 FROM public.mobility_stage_g42_provider_session_grants g
  WHERE g.user_id=_user AND g.session_id=_session
  AND g.revoked_at IS NULL
  AND g.provider_confirmed_at<=pg_catalog.statement_timestamp()
  AND g.valid_until>pg_catalog.statement_timestamp()
  AND (_iat_ms IS NULL OR (
   _iat_ms BETWEEN 0 AND 9999999999999
   AND pg_catalog.to_timestamp(_iat_ms/1000.0)>=g.token_allowed_from
   AND pg_catalog.to_timestamp(_iat_ms/1000.0)<g.valid_until
  ))
 ),false)
$q$;
-- An in-transaction guard holds the grant row through the protected
-- transaction; merely checking this from a separate HTTP request cannot
-- guarantee revocation atomicity with unrelated updates.
CREATE FUNCTION public.mobility_stage_g42_lock_session(
 _user uuid,_session uuid,_iat_ms bigint
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $q$
DECLARE found_grant boolean:=false;
BEGIN
 SELECT true INTO found_grant
 FROM public.mobility_stage_g42_provider_session_grants g
 WHERE g.user_id=_user AND g.session_id=_session
  AND g.revoked_at IS NULL
  AND g.valid_until>pg_catalog.clock_timestamp()
  AND _iat_ms BETWEEN 0 AND 9999999999999
  AND pg_catalog.to_timestamp(_iat_ms/1000.0)>=g.token_allowed_from
  AND pg_catalog.to_timestamp(_iat_ms/1000.0)<g.valid_until
 FOR SHARE;
 RETURN COALESCE(found_grant,false);
END $q$;
REVOKE ALL ON FUNCTION public.mobility_stage_g42_session_active(uuid,uuid,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g42_lock_session(uuid,uuid,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g42_session_active(uuid,uuid,bigint)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g42_lock_session(uuid,uuid,bigint)
 TO service_role;
COMMIT;
