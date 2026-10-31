-- QORE G252 Supabase PG17 STAGING: private, source-scoped Merchant inbox.
-- Run only against isolated qore-mobile-staging; no user/fixture created.
-- The backend MUST verify bearer with Supabase Auth.getUser and attest
-- original signed JWT subject/session/iat BEFORE calling this service_role RPC.
-- G247 checks actual auth.sessions existence; SQL cannot verify bearer alone.
DO $stage$
BEGIN
 IF to_regprocedure('public.mobility_stage_g156_merchant_inbox_qa(uuid,uuid,uuid,bigint)') IS NOT NULL
 OR to_regprocedure('public.mobility_stage_g42_session_active(uuid,uuid,bigint)') IS NULL
 OR to_regclass('public.mobility_stage_merchant_orders') IS NULL
 OR to_regclass('public.mobility_stage_merchant_staff') IS NULL
 OR to_regclass('public.mobility_stage_merchants') IS NULL
 OR (SELECT count(*) FROM auth.users)<>0
 THEN RAISE EXCEPTION 'G252 requires isolated empty STAGING merchant and G247 provider session schema'; END IF;
END $stage$;

CREATE FUNCTION public.mobility_stage_g156_merchant_inbox_qa(
 _actor uuid,_merchant uuid,_session uuid,_iat bigint
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE result_orders jsonb;
BEGIN
 IF _actor IS NULL OR _merchant IS NULL OR _session IS NULL OR
 _iat IS NULL OR
 NOT public.mobility_stage_g42_session_active(_actor,_session,_iat) OR
 NOT EXISTS(
  SELECT 1 FROM public.mobility_stage_merchant_staff s
  JOIN public.mobility_stage_merchants m ON m.id=s.merchant_id
  WHERE s.merchant_id=_merchant AND s.user_id=_actor AND s.active=true
  AND m.status='approved'
 )
 THEN RAISE EXCEPTION 'G252 merchant inbox not authorized'; END IF;

 SELECT pg_catalog.coalesce(
   pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'orderId',o.id,'branchId',o.branch_id,
    'status',o.status::text,'revision',o.revision,
    'vehicleKind',o.requested_vehicle_kind::text,
    'subtotalPyg',o.subtotal_pyg,'deliveryId',o.delivery_id,
    'lineCount',o.line_count,'itemUnits',o.item_units,
    'createdAt',o.created_at) ORDER BY o.created_at DESC,o.id DESC),
   '[]'::jsonb)
 INTO result_orders
 FROM (
  SELECT base.id,base.branch_id,base.status,base.revision,
  base.requested_vehicle_kind,base.subtotal_pyg,base.delivery_id,
  base.created_at,
  (SELECT count(*)::integer FROM public.mobility_stage_merchant_order_lines l
   WHERE l.order_id=base.id) AS line_count,
  (SELECT pg_catalog.coalesce(sum(l.quantity),0)::integer
   FROM public.mobility_stage_merchant_order_lines l
   WHERE l.order_id=base.id) AS item_units
  FROM public.mobility_stage_merchant_orders base
  WHERE base.merchant_id=_merchant
  ORDER BY base.created_at DESC,base.id DESC LIMIT 20
 ) o;

 RETURN pg_catalog.jsonb_build_object(
  'merchantId',_merchant,'orders',result_orders,
  'limit',20,'serverPersisted',true,
  'qaOnly',true,'productionEnabled',false);
END;
$body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g156_merchant_inbox_qa(uuid,uuid,uuid,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g156_merchant_inbox_qa(uuid,uuid,uuid,bigint)
 TO service_role;
-- Never grant table write or SELECT to public clients. G173 transactional
-- fulfillment, G187 completion and G150 order linking are NOT enabled here.
