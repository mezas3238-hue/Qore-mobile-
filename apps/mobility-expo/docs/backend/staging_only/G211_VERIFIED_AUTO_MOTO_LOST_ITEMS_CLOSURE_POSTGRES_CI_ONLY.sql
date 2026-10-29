-- G211: atomic, read-backed closure for ORIGINAL G198 AUTO and G200 MOTO cases.
-- Existing boolean close RPC cannot certify which state committed.
-- Strict disposable PostgreSQL16 only: never install in LIVE/production.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g198_close_case_qa(uuid,uuid,uuid,bigint,boolean)') IS NULL
 OR pg_catalog.to_regprocedure('public.mobility_stage_g200_close_case_qa(uuid,uuid,uuid,bigint,boolean)') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g198_lost_item_cases') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g200_lost_item_cases') IS NULL
 THEN RAISE EXCEPTION 'G211 refuses non-disposable or missing original case authorities'
 USING ERRCODE='P2110'; END IF;
END $guard$;
BEGIN;

CREATE FUNCTION public.mobility_stage_g211_g198_close_case_receipt_qa(
 _case uuid,_actor uuid,_session uuid,_iat_ms bigint,_block boolean
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE original public.mobility_stage_g198_lost_item_cases%ROWTYPE;
 persisted public.mobility_stage_g198_lost_item_cases%ROWTYPE;
 desired text; result boolean;
BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _block IS NULL
 THEN RAISE EXCEPTION 'G211 original 198 case closure unavailable'
 USING ERRCODE='P2111'; END IF;
 desired:=CASE WHEN _block THEN 'BLOCKED' ELSE 'CLOSED' END;
 -- Lock G42 session + original completed trip + participant's case row.
 -- This also rejects unrelated accounts and revoked sessions.
 original:=public.mobility_stage_g198_authorize_qa(
  _case,_actor,_session,_iat_ms,false);
 IF original.state='CLOSED' AND desired='CLOSED' THEN
  RETURN pg_catalog.jsonb_build_object(
   'mode','STAGING_DEMO_ONLY','caseId',_case,'state','CLOSED',
   'qaOnly',true,'productionEnabled',false);
 END IF;
 IF original.state<>'OPEN' OR original.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G211 case already terminal or expired'
 USING ERRCODE='P2112'; END IF;
 -- The old BOOLEAN receipt is not trusted. Execute it inside this SAME
 -- PostgreSQL transaction, under the existing row and G42 session locks.
 result:=public.mobility_stage_g198_close_case_qa(
  _case,_actor,_session,_iat_ms,_block);
 SELECT * INTO persisted FROM public.mobility_stage_g198_lost_item_cases
 WHERE case_id=_case FOR UPDATE;
 IF result IS DISTINCT FROM true OR NOT FOUND OR
  persisted.state IS DISTINCT FROM desired OR persisted.closed_at IS NULL OR
  persisted.trip_id IS DISTINCT FROM original.trip_id OR
  persisted.passenger_id IS DISTINCT FROM original.passenger_id OR
  persisted.driver_id IS DISTINCT FROM original.driver_id
 THEN RAISE EXCEPTION 'G211 unverified state; rollback original closure'
 USING ERRCODE='P2113'; END IF;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','caseId',_case,'state',persisted.state,
  'qaOnly',true,'productionEnabled',false);
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g211_g198_close_case_receipt_qa(
 uuid,uuid,uuid,bigint,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g211_g198_close_case_receipt_qa(
 uuid,uuid,uuid,bigint,boolean) TO service_role;

CREATE FUNCTION public.mobility_stage_g211_g200_close_case_receipt_qa(
 _case uuid,_actor uuid,_session uuid,_iat_ms bigint,_block boolean
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE original public.mobility_stage_g200_lost_item_cases%ROWTYPE;
 persisted public.mobility_stage_g200_lost_item_cases%ROWTYPE;
 desired text; result boolean;
BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _block IS NULL
 THEN RAISE EXCEPTION 'G211 original 200 case closure unavailable'
 USING ERRCODE='P2111'; END IF;
 desired:=CASE WHEN _block THEN 'BLOCKED' ELSE 'CLOSED' END;
 -- Lock G42 session + original completed trip + participant's case row.
 -- This also rejects unrelated accounts and revoked sessions.
 original:=public.mobility_stage_g200_authorize_qa(
  _case,_actor,_session,_iat_ms,false);
 IF original.state='CLOSED' AND desired='CLOSED' THEN
  RETURN pg_catalog.jsonb_build_object(
   'mode','STAGING_DEMO_ONLY','caseId',_case,'state','CLOSED',
   'qaOnly',true,'productionEnabled',false);
 END IF;
 IF original.state<>'OPEN' OR original.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G211 case already terminal or expired'
 USING ERRCODE='P2112'; END IF;
 -- The old BOOLEAN receipt is not trusted. Execute it inside this SAME
 -- PostgreSQL transaction, under the existing row and G42 session locks.
 result:=public.mobility_stage_g200_close_case_qa(
  _case,_actor,_session,_iat_ms,_block);
 SELECT * INTO persisted FROM public.mobility_stage_g200_lost_item_cases
 WHERE case_id=_case FOR UPDATE;
 IF result IS DISTINCT FROM true OR NOT FOUND OR
  persisted.state IS DISTINCT FROM desired OR persisted.closed_at IS NULL OR
  persisted.trip_id IS DISTINCT FROM original.trip_id OR
  persisted.passenger_id IS DISTINCT FROM original.passenger_id OR
  persisted.driver_id IS DISTINCT FROM original.driver_id
 THEN RAISE EXCEPTION 'G211 unverified state; rollback original closure'
 USING ERRCODE='P2113'; END IF;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','caseId',_case,'state',persisted.state,
  'qaOnly',true,'productionEnabled',false);
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g211_g200_close_case_receipt_qa(
 uuid,uuid,uuid,bigint,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g211_g200_close_case_receipt_qa(
 uuid,uuid,uuid,bigint,boolean) TO service_role;
COMMIT;
