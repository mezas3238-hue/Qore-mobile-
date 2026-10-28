-- G144: recover the ORIGINAL G45 Buyer reservation after a lost HTTP ACK.
-- Disposable PostgreSQL16 ONLY; no payment, dispatch, merchant confirmation or LIVE.
DO $gate$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g45_reserve_order_qa(uuid,uuid,bigint,uuid,uuid,bigint,public.mobility_vehicle_kind,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'G144 requires disposable G45 chain'; END IF;
END $gate$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g144_recover_order_qa(
 _buyer uuid,_session uuid,_iat_ms bigint,_request_key uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE rec RECORD;
BEGIN
 IF _buyer IS NULL OR _session IS NULL OR _iat_ms IS NULL OR _request_key IS NULL
 OR NOT public.mobility_stage_g42_lock_session(_buyer,_session,_iat_ms)
 OR NOT EXISTS (SELECT 1 FROM public.user_roles
   WHERE user_id=_buyer AND role='passenger'::public.app_role)
 OR EXISTS (SELECT 1 FROM public.user_roles
   WHERE user_id=_buyer AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'G144 buyer session denied' USING ERRCODE='G4501'; END IF;
 SELECT r.receipt_id,r.order_id,r.request_key,r.branch_id,
   r.catalog_version,r.subtotal_pyg,o.status,o.revision,o.delivery_id
 INTO rec FROM public.mobility_stage_g45_order_receipts r
 JOIN public.mobility_stage_merchant_orders o
   ON o.id=r.order_id AND o.buyer_id=r.buyer_id
   AND o.request_key=r.request_key AND o.branch_id=r.branch_id
   AND o.subtotal_pyg=r.subtotal_pyg
   AND o.requested_vehicle_kind=r.requested_vehicle_kind
 WHERE r.request_key=_request_key AND r.buyer_id=_buyer;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN pg_catalog.jsonb_build_object(
  'receiptId',rec.receipt_id,'orderId',rec.order_id,
  'requestKey',rec.request_key,'branchId',rec.branch_id,
  'catalogVersion',rec.catalog_version,'subtotalPyg',rec.subtotal_pyg,
  'receiptStatus','QA_RESERVED_NO_PAYMENT',
  'orderEnabled',false,'productionEnabled',false,
  'status',rec.status::text,'revision',rec.revision,
  'deliveryId',rec.delivery_id
 );
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g144_recover_order_qa(uuid,uuid,bigint,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
