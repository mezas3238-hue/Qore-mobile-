-- G214: close original AUTO G198 and MOTO G200 lost-item conversations
-- with one atomic, actor-bound, READ-BACKED SQL receipt. Previously the HTTP
-- bridge refused every close because G198/G200 return only boolean; a separate
-- read after blocking is deliberately denied. No PII, LIVE or money involved.
-- Disposable PostgreSQL16 ONLY.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g198_close_case_qa(uuid,uuid,uuid,bigint,boolean)') IS NULL
 OR pg_catalog.to_regprocedure('public.mobility_stage_g200_close_case_qa(uuid,uuid,uuid,bigint,boolean)') IS NULL
 THEN RAISE EXCEPTION 'G214 requires disposable completed G198/G200 original cases'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g214_close_g198_case_qa(
 _case uuid,_actor uuid,_session uuid,_iat_ms bigint,_block boolean)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE found_state text; was_closed boolean; target_state text;
BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _block IS NULL OR _case IS NULL OR _actor IS NULL OR _session IS NULL
 OR _iat_ms NOT BETWEEN 0 AND 9999999999999
 THEN RAISE EXCEPTION 'G214 invalid AUTO closure context' USING ERRCODE='P2141'; END IF;
 target_state:=CASE WHEN _block THEN 'BLOCKED' ELSE 'CLOSED' END;
 -- Existing G198 SQL locks original case, G42 grant, participant and role.
 was_closed:=public.mobility_stage_g198_close_case_qa(
  _case,_actor,_session,_iat_ms,_block);
 IF was_closed IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'G214 AUTO unverified close outcome' USING ERRCODE='P2141'; END IF;
 -- SAME SQL transaction. A second HTTP GET would fail for BLOCKED by design.
 SELECT c.state INTO found_state FROM public.mobility_stage_g198_lost_item_cases c
 WHERE c.case_id=_case
 AND _actor IN (c.passenger_id,c.driver_id)
 AND c.state=target_state AND c.closed_at IS NOT NULL
 FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'G214 AUTO closure not persisted' USING ERRCODE='P2141'; END IF;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','caseId',_case,'state',found_state,
  'qaOnly',true,'productionEnabled',false);
END $fn$;
CREATE FUNCTION public.mobility_stage_g214_close_g200_case_qa(
 _case uuid,_actor uuid,_session uuid,_iat_ms bigint,_block boolean)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE found_state text; was_closed boolean; target_state text;
BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _block IS NULL OR _case IS NULL OR _actor IS NULL OR _session IS NULL
 OR _iat_ms NOT BETWEEN 0 AND 9999999999999
 THEN RAISE EXCEPTION 'G214 invalid MOTO closure context' USING ERRCODE='P2141'; END IF;
 target_state:=CASE WHEN _block THEN 'BLOCKED' ELSE 'CLOSED' END;
 was_closed:=public.mobility_stage_g200_close_case_qa(
  _case,_actor,_session,_iat_ms,_block);
 IF was_closed IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'G214 MOTO unverified close outcome' USING ERRCODE='P2141'; END IF;
 SELECT c.state INTO found_state FROM public.mobility_stage_g200_lost_item_cases c
 WHERE c.case_id=_case
 AND _actor IN (c.passenger_id,c.driver_id)
 AND c.state=target_state AND c.closed_at IS NOT NULL
 FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'G214 MOTO closure not persisted' USING ERRCODE='P2141'; END IF;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','caseId',_case,'state',found_state,
  'qaOnly',true,'productionEnabled',false);
END $fn$;
REVOKE ALL ON FUNCTION
 public.mobility_stage_g214_close_g198_case_qa(uuid,uuid,uuid,bigint,boolean),
 public.mobility_stage_g214_close_g200_case_qa(uuid,uuid,uuid,bigint,boolean)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION
 public.mobility_stage_g214_close_g198_case_qa(uuid,uuid,uuid,bigint,boolean),
 public.mobility_stage_g214_close_g200_case_qa(uuid,uuid,uuid,bigint,boolean)
 TO service_role;
COMMIT;
