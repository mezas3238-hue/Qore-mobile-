-- G146: original G45 Buyer commerce order -> Admin AAL2 read.
-- PostgreSQL16 disposable CI only, no checkout, PSP, payout or LIVE.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g45_order_receipts') IS NULL
 OR to_regprocedure('public.mobility_stage_g27_backoffice_role_of(uuid)') IS NULL
 THEN RAISE EXCEPTION 'G146 refuses non-disposable or incomplete commerce chain'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g146_commerce_trace_qa(
 _admin uuid,_order uuid
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
 WITH stamp AS MATERIALIZED (
  SELECT floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint ms
 ), source AS MATERIALIZED (
  SELECT o.id,o.request_key,o.buyer_id,o.branch_id,
   o.requested_vehicle_kind,o.status::text status,
   o.revision,o.created_at,o.changed_at,o.delivery_id,
   r.receipt_id,r.catalog_version,r.subtotal_pyg
  FROM public.mobility_stage_merchant_orders o
  JOIN public.mobility_stage_g45_order_receipts r
   ON r.order_id=o.id AND r.buyer_id=o.buyer_id
    AND r.request_key=o.request_key AND r.branch_id=o.branch_id
    AND r.subtotal_pyg=o.subtotal_pyg
    AND r.requested_vehicle_kind=o.requested_vehicle_kind
  WHERE pg_catalog.current_database()='qore_disposable_chain'
   AND pg_catalog.current_setting('application_name')='qore_ci_disposable_chain'
   AND o.id=_order AND o.delivery_id IS NULL
   AND ((o.status='requested' AND o.revision=1)
    OR (o.status='confirmed' AND o.revision=2)
    OR (o.status='preparing' AND o.revision=3)
    OR (o.status='ready' AND o.revision=4)
    OR (o.status='cancelled' AND o.revision BETWEEN 2 AND 4))
   AND public.mobility_stage_g27_backoffice_role_of(_admin)='admin'
 ), actions AS MATERIALIZED (
  SELECT s.id,
   (SELECT count(*) FROM public.mobility_stage_merchant_order_events e
    WHERE e.order_id=s.id) total,
   (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'eventId',e.id,'serviceId',e.order_id,
    'sequence',e.order_revision,'status',e.next_status::text,
    'at',floor(extract(epoch FROM e.recorded_at)*1000)::bigint
   ) ORDER BY e.order_revision)
   FROM public.mobility_stage_merchant_order_events e
   WHERE e.order_id=s.id AND e.action IN
    ('confirm','start_preparing','ready','cancel')
    AND e.next_status::text=CASE e.action
     WHEN 'confirm' THEN 'confirmed'
     WHEN 'start_preparing' THEN 'preparing'
     WHEN 'ready' THEN 'ready'
     WHEN 'cancel' THEN 'cancelled' END
    AND e.delivery_id IS NULL) state_events,
   (SELECT count(*) FROM public.mobility_stage_merchant_order_events e
    WHERE e.order_id=s.id AND e.action IN
     ('confirm','start_preparing','ready','cancel')
     AND e.next_status::text=CASE e.action
      WHEN 'confirm' THEN 'confirmed'
      WHEN 'start_preparing' THEN 'preparing'
      WHEN 'ready' THEN 'ready'
      WHEN 'cancel' THEN 'cancelled' END
     AND e.delivery_id IS NULL) valid_events
  FROM source s
 )
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','viewerId',_admin,
  'serviceId',s.id,'serviceKind','COMMERCE',
  'bookingRequestKey',s.request_key,
  'quoteId',NULL,'branchId',s.branch_id,
  'vehicleKind',s.requested_vehicle_kind::text,
  'orderSubtotalGs',s.subtotal_pyg,
  'status',s.status,'revision',s.revision,
  'observedAt',stamp.ms,'expiresAt',stamp.ms+30000,
  'serverPersisted',true,'productionEnabled',false,
  'assignment',pg_catalog.jsonb_build_object(
   'state','NOT_ASSIGNABLE','legalGate','G38_BLOCKED'),
  'events',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
   'eventId',s.id,'serviceId',s.id,'sequence',1,'status','requested',
   'at',floor(extract(epoch FROM s.created_at)*1000)::bigint
  ))||COALESCE(a.state_events,'[]'::jsonb),
  'ledger',NULL)
 FROM source s JOIN actions a ON a.id=s.id CROSS JOIN stamp
 WHERE s.revision BETWEEN 1 AND 4
  AND a.total=s.revision-1
  AND a.valid_events=a.total
  AND pg_catalog.jsonb_array_length(COALESCE(a.state_events,'[]'::jsonb))=a.total
  AND s.changed_at>=s.created_at
  AND (s.status='requested' OR s.status='confirmed'
   OR s.status='preparing' OR s.status='ready' OR s.status='cancelled')
 LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g146_commerce_trace_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g146_commerce_trace_qa(uuid,uuid)
 TO service_role;
COMMIT;
