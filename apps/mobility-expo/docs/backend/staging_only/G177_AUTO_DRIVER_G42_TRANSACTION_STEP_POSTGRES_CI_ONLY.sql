-- G177 — original G3 AUTO Driver step with independent G42 transaction.
-- Disposable PostgreSQL16 ONLY. Never migrate to LIVE or production.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR pg_catalog.to_regprocedure('public.mobility_stage_auto_demo_transition(uuid,uuid,public.mobility_stage_trip_status,uuid)') IS NULL
 OR pg_catalog.to_regclass('public.user_roles') IS NULL
 THEN RAISE EXCEPTION 'G177 refuses non-disposable or incomplete original G3/G42 chain'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g177_driver_auto_step_qa(
 _driver uuid,_session uuid,_iat bigint,_trip uuid,_event text,_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE target public.mobility_stage_trip_status;
 roles integer:=0; the_role text; event_id uuid;
BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _driver IS NULL OR _session IS NULL OR _iat IS NULL
 OR _trip IS NULL OR _key IS NULL
 OR _event NOT IN ('arrive','pickup','complete')
 THEN RAISE EXCEPTION 'G177 invalid original Driver command'
  USING ERRCODE='P1771'; END IF;
 -- Source-owned role is exact; dual-role and missing-role actors cannot
 -- drive, regardless of what a client JWT might claim.
 SELECT count(*),min(role::text) INTO roles,the_role
 FROM public.user_roles WHERE user_id=_driver;
 IF roles<>1 OR the_role<>'driver' THEN
  RAISE EXCEPTION 'G177 Driver exclusive role required'
   USING ERRCODE='P1771';
 END IF;
 -- Hold original grant row through the G3 mutation COMMIT. Revocation
 -- races serialize instead of trusting an earlier HTTP token check.
 IF NOT public.mobility_stage_g42_lock_session(_driver,_session,_iat) THEN
  RAISE EXCEPTION 'G177 source provider session revoked'
   USING ERRCODE='P1771';
 END IF;
 target:=CASE _event
  WHEN 'arrive' THEN 'arriving'::public.mobility_stage_trip_status
  WHEN 'pickup' THEN 'in_progress'::public.mobility_stage_trip_status
  WHEN 'complete' THEN 'completed'::public.mobility_stage_trip_status
  ELSE NULL END;
 -- Original G3 checks exact assigned driver, ordered state and idempotency;
 -- G38/G71 cannot be bypassed: this function never assigns a new driver.
 event_id:=public.mobility_stage_auto_demo_transition(
  _trip,_driver,target,_key);
 IF event_id IS NULL THEN
  RAISE EXCEPTION 'G177 original G3 transition missing'
   USING ERRCODE='P1771';
 END IF;
 RETURN event_id;
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g177_driver_auto_step_qa(
 uuid,uuid,bigint,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g177_driver_auto_step_qa(
 uuid,uuid,bigint,uuid,text,uuid) TO service_role;
COMMIT;
