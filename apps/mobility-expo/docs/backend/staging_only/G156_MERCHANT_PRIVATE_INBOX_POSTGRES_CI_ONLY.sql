-- G156: private merchant inbox, original G45 receipts. PG16 disposable CI only.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g45_order_receipts') IS NULL
 THEN RAISE EXCEPTION 'G156 refuses non-disposable incomplete chain'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g156_merchant_inbox_qa(
 _actor uuid,_merchant uuid,_session uuid,_iat bigint
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE allowed boolean:=false; orders jsonb;
BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _actor IS NULL OR _merchant IS NULL OR _session IS NULL OR _iat IS NULL
 OR NOT public.mobility_stage_g42_lock_session(_actor,_session,_iat)
 THEN RAISE EXCEPTION 'G156 merchant verified session required'
 USING ERRCODE='P1561'; END IF;
 SELECT true INTO allowed FROM public.mobility_stage_merchant_staff s
 JOIN public.mobility_stage_merchants m ON m.id=s.merchant_id
 WHERE s.user_id=_actor AND s.merchant_id=_merchant
  AND s.active=true AND m.status='approved' FOR SHARE OF s,m;
 IF allowed IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'G156 merchant staff access denied' USING ERRCODE='P1561'; END IF;
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'orderId',x.id,'branchId',x.branch_id,'status',x.status,
  'revision',x.revision,'vehicleKind',x.requested_vehicle_kind,
  'subtotalPyg',x.subtotal_pyg,'deliveryId',x.delivery_id,
  'lineCount',x.line_count,'itemUnits',x.item_units,
  'createdAt',x.created_at
 ) ORDER BY x.created_at DESC,x.id DESC),'[]'::jsonb)
 INTO orders FROM (
  SELECT o.id,o.branch_id,o.status,o.revision,o.requested_vehicle_kind,
   o.subtotal_pyg,o.delivery_id,o.created_at,
   (SELECT pg_catalog.count(*)::integer FROM public.mobility_stage_merchant_order_lines l
    WHERE l.order_id=o.id) AS line_count,
   (SELECT COALESCE(pg_catalog.sum(l.quantity),0)::integer
    FROM public.mobility_stage_merchant_order_lines l
    WHERE l.order_id=o.id) AS item_units
  FROM public.mobility_stage_merchant_orders o
  JOIN public.mobility_stage_g45_order_receipts r ON r.order_id=o.id
   AND r.request_key=o.request_key AND r.buyer_id=o.buyer_id
   AND r.branch_id=o.branch_id AND r.subtotal_pyg=o.subtotal_pyg
   AND r.requested_vehicle_kind=o.requested_vehicle_kind
  WHERE o.merchant_id=_merchant
  ORDER BY o.created_at DESC,o.id DESC LIMIT 20
 ) x;
 RETURN pg_catalog.jsonb_build_object('merchantId',_merchant,
  'orders',orders,'limit',20,'serverPersisted',true,
  'qaOnly',true,'productionEnabled',false);
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g156_merchant_inbox_qa(uuid,uuid,uuid,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g156_merchant_inbox_qa(uuid,uuid,uuid,bigint)
 TO service_role;
COMMIT;
