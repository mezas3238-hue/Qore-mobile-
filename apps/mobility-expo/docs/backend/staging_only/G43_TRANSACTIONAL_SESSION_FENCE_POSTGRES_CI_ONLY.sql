-- G43 / A24: transactional session fence proof in PostgreSQL 16 disposable chain.
-- This is an unexposed QA-only operation, NOT an HTTP RPC or real provider sync.
-- A verified JWT in middleware alone does NOT fence concurrent revocation.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 THEN RAISE EXCEPTION 'G43 refuses non-disposable or incomplete G42 chain'; END IF;
END $guard$;
BEGIN;
-- Deliberately disconnected from trips, incidents, orders and financial tables.
CREATE TABLE public.mobility_stage_g43_guarded_effects (
 effect_id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 session_id uuid NOT NULL,
 token_iat_ms bigint NOT NULL CHECK (token_iat_ms BETWEEN 0 AND 9999999999999),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
ALTER TABLE public.mobility_stage_g43_guarded_effects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g43_guarded_effects
 FROM PUBLIC,anon,authenticated,service_role;
-- The DB owner alone can call this disposable probe. No EXECUTE grant to
-- service_role: parameters are not a proof of caller identity.
CREATE FUNCTION public.mobility_stage_g43_guarded_probe(
 _effect uuid,_actor uuid,_session uuid,_token_iat_ms bigint
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
BEGIN
 IF _effect IS NULL OR _actor IS NULL OR _session IS NULL
 OR _token_iat_ms IS NULL
 OR NOT public.mobility_stage_g42_lock_session(_actor,_session,_token_iat_ms)
 THEN RAISE EXCEPTION 'G43 session not authorized at transactional write'
  USING ERRCODE='G4301'; END IF;
 -- Lock acquired above is retained until the CALLER TRANSACTION ends.
 -- A concurrent UPDATE revoked_at must wait for this transaction to commit.
 INSERT INTO public.mobility_stage_g43_guarded_effects(
  effect_id,user_id,session_id,token_iat_ms
 ) VALUES (_effect,_actor,_session,_token_iat_ms);
 RETURN true;
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g43_guarded_probe(uuid,uuid,uuid,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
