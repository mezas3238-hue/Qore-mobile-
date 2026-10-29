-- G173: original merchant mutations under a G42 transactional session fence.
-- PG16 disposable CI only. Never remote migration, LIVE, PSP, or KYC bypass.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR pg_catalog.to_regprocedure('public.mobility_stage_merchant_order_transition(uuid,uuid,text,uuid)') IS NULL
 OR pg_catalog.to_regprocedure('public.mobility_stage_merchant_order_attach_delivery(uuid,uuid,uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G173 needs disposable verified commerce and G42'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g173_merchant_transition_qa(
 _actor uuid,_session uuid,_iat bigint,_order uuid,_action text,_request uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE result uuid; staff_ok boolean:=false;
BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _actor IS NULL OR _session IS NULL OR _order IS NULL OR _request IS NULL
 OR _iat IS NULL OR _action NOT IN ('confirm','start_preparing','ready','hand_to_courier')
 OR NOT public.mobility_stage_g42_lock_session(_actor,_session,_iat)
 THEN RAISE EXCEPTION 'G173 verified merchant session denied' USING ERRCODE='P1731';
 END IF;
 -- Hold active original staff/merchant rows for the entire mutation,
 -- including idempotent ACK recovery. Former staff cannot replay old keys.
 SELECT true INTO staff_ok
 FROM public.mobility_stage_merchant_orders o
 JOIN public.mobility_stage_merchant_staff s ON s.merchant_id=o.merchant_id
 JOIN public.mobility_stage_merchants m ON m.id=o.merchant_id
 WHERE o.id=_order AND s.user_id=_actor AND s.active=true
 AND m.status='approved' FOR SHARE OF s,m;
 IF staff_ok IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'G173 original active merchant membership required'
   USING ERRCODE='P1732';
 END IF;
 result:=public.mobility_stage_merchant_order_transition(
  _order,_actor,_action,_request);
 IF result IS NULL THEN
  RAISE EXCEPTION 'G173 missing original transition' USING ERRCODE='P1731';
 END IF;
 RETURN result;
END $body$;
CREATE FUNCTION public.mobility_stage_g173_merchant_attach_qa(
 _actor uuid,_session uuid,_iat bigint,_order uuid,_delivery uuid,_request uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE result uuid; staff_ok boolean:=false;
BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _actor IS NULL OR _session IS NULL OR _order IS NULL OR _delivery IS NULL
 OR _request IS NULL OR _iat IS NULL
 OR NOT public.mobility_stage_g42_lock_session(_actor,_session,_iat)
 THEN RAISE EXCEPTION 'G173 verified staff session denied' USING ERRCODE='P1731';
 END IF;
 -- Original G150 price-consent and G6 same-order restrictions remain the
 -- sole delivery attachment authority. This adds session serialization only.
 -- Hold active original staff/merchant rows for the entire mutation,
 -- including idempotent ACK recovery. Former staff cannot replay old keys.
 SELECT true INTO staff_ok
 FROM public.mobility_stage_merchant_orders o
 JOIN public.mobility_stage_merchant_staff s ON s.merchant_id=o.merchant_id
 JOIN public.mobility_stage_merchants m ON m.id=o.merchant_id
 WHERE o.id=_order AND s.user_id=_actor AND s.active=true
 AND m.status='approved' FOR SHARE OF s,m;
 IF staff_ok IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'G173 original active merchant membership required'
   USING ERRCODE='P1732';
 END IF;
 result:=public.mobility_stage_merchant_order_attach_delivery(
  _order,_actor,_delivery,_request);
 IF result IS NULL THEN
  RAISE EXCEPTION 'G173 missing original delivery link' USING ERRCODE='P1731';
 END IF;
 RETURN result;
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g173_merchant_transition_qa(
 uuid,uuid,bigint,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g173_merchant_attach_qa(
 uuid,uuid,bigint,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g173_merchant_transition_qa(
 uuid,uuid,bigint,uuid,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g173_merchant_attach_qa(
 uuid,uuid,bigint,uuid,uuid,uuid) TO service_role;
COMMIT;
