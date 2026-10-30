-- G217: Admin only verifies a G45 ready order with the same original G150
-- linked delivery after fully G10/G67/G187-proven G216 terminal receipt.
-- Never fake a new order state, a legal permit, a PSP charge or a customer GPS.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g216_completed_delivery_trace_qa(uuid,uuid)') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g45_order_receipts') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_merchant_order_events') IS NULL
 THEN RAISE EXCEPTION 'G217 missing isolated original commerce/cargo sources'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g217_commerce_terminal_admin_qa(
 _admin uuid,_order uuid
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $f$
 WITH stamp AS MATERIALIZED(
  SELECT pg_catalog.floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint ms
 ), original AS MATERIALIZED(
  SELECT o.id,o.request_key,o.buyer_id,o.branch_id,o.status,o.revision,
   o.delivery_id,o.created_at,o.changed_at,o.requested_vehicle_kind,
   r.receipt_id,r.subtotal_pyg,
   public.mobility_stage_g216_completed_delivery_trace_qa(
    _admin,o.delivery_id) AS proven_delivery
  FROM public.mobility_stage_merchant_orders o
  JOIN public.mobility_stage_g45_order_receipts r
   ON r.order_id=o.id AND r.request_key=o.request_key
    AND r.buyer_id=o.buyer_id AND r.branch_id=o.branch_id
    AND r.subtotal_pyg=o.subtotal_pyg
    AND r.requested_vehicle_kind=o.requested_vehicle_kind
  WHERE pg_catalog.current_database()='qore_disposable_chain'
   AND pg_catalog.current_setting('application_name')='qore_ci_disposable_chain'
   AND public.mobility_stage_g27_backoffice_role_of(_admin)='admin'
   AND o.id=_order AND o.delivery_id IS NOT NULL
   AND o.status='ready' AND o.revision=5
   AND o.changed_at>=o.created_at
   AND EXISTS(
    SELECT 1 FROM public.mobility_stage_deliveries d
    JOIN public.mobility_stage_g122_delivery_price_consents c
     ON c.delivery_id=d.id AND c.sender_id=d.sender_id
      AND c.vehicle_kind=d.requested_vehicle_kind
    WHERE d.id=o.delivery_id AND d.sender_id=o.buyer_id
     AND d.requested_vehicle_kind=o.requested_vehicle_kind
   )
 ), timeline AS MATERIALIZED (
  SELECT s.id,
   pg_catalog.count(e.id) n,
   pg_catalog.count(e.id) FILTER(WHERE
     e.order_revision=CASE e.action
       WHEN 'confirm' THEN 2
       WHEN 'start_preparing' THEN 3
       WHEN 'ready' THEN 4
       WHEN 'attach_delivery' THEN 5
       ELSE 0 END
     AND e.next_status::text=CASE e.action
       WHEN 'confirm' THEN 'confirmed'
       WHEN 'start_preparing' THEN 'preparing'
       WHEN 'ready' THEN 'ready'
       WHEN 'attach_delivery' THEN 'ready'
       ELSE '' END
     AND ((e.action='attach_delivery' AND e.delivery_id=s.delivery_id)
          OR (e.action<>'attach_delivery' AND e.delivery_id IS NULL))
     AND e.recorded_at>=s.created_at
   ) valid_events,
   pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'eventId',e.id,'serviceId',e.order_id,'sequence',e.order_revision,
    'status',e.next_status::text,
    'at',pg_catalog.floor(extract(epoch FROM e.recorded_at)*1000)::bigint
   ) ORDER BY e.order_revision) events
  FROM original s
  JOIN public.mobility_stage_merchant_order_events e ON e.order_id=s.id
  GROUP BY s.id
 )
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','viewerId',_admin,
  'serviceId',s.id,'serviceKind','COMMERCE',
  'bookingRequestKey',s.request_key,'quoteId',NULL,
  'status','ready','revision',5,'deliveryId',s.delivery_id,
  'vehicleKind',s.requested_vehicle_kind::text,
  'branchId',s.branch_id,'orderSubtotalGs',s.subtotal_pyg,
  'observedAt',stamp.ms,'expiresAt',stamp.ms+30000,
  'serverPersisted',true,'productionEnabled',false,
  'assignment',pg_catalog.jsonb_build_object(
    'state','NOT_ASSIGNABLE','legalGate','G38_BLOCKED'),
  'events',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
   'eventId',s.id,'serviceId',s.id,'sequence',1,'status','requested',
   'at',pg_catalog.floor(extract(epoch FROM s.created_at)*1000)::bigint
  ))||t.events,'ledger',NULL)
 FROM original s
 JOIN timeline t ON t.id=s.id CROSS JOIN stamp
 WHERE t.n=4 AND t.valid_events=4
  AND s.proven_delivery IS NOT NULL
  AND s.proven_delivery->>'serviceId'=s.delivery_id::text
  AND s.proven_delivery->>'serviceKind'=
    'DELIVERY_'||s.requested_vehicle_kind::text
  AND s.proven_delivery->>'status'='delivered'
  AND (s.proven_delivery->'assignment'->>'state')='QA_COMPLETED'
 LIMIT 1
$f$;
REVOKE ALL ON FUNCTION public.mobility_stage_g217_commerce_terminal_admin_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g217_commerce_terminal_admin_qa(uuid,uuid)
 TO service_role;
COMMIT;
