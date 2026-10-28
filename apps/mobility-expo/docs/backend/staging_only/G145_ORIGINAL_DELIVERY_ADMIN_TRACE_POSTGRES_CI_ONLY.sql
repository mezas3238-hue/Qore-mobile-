-- G145: source-backed Admin trace for original G5 priced deliveries only.
-- PostgreSQL16 disposable CI. No courier, PSP, LIVE or inferred quote.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g122_delivery_price_consents') IS NULL
 OR to_regclass('public.mobility_stage_deliveries') IS NULL
 OR to_regprocedure('public.mobility_stage_g27_backoffice_role_of(uuid)') IS NULL
 THEN RAISE EXCEPTION 'G145 refuses non-disposable or incomplete custody and quote source'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g145_delivery_trace_qa(
 _admin uuid,_delivery uuid
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
 WITH stamp AS MATERIALIZED (
  SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint ms
 ), source AS MATERIALIZED (
  SELECT d.id,d.request_key,d.sender_id,d.status::text status,d.revision,
   d.created_at,d.changed_at,d.requested_vehicle_kind,c.quote_id
  FROM public.mobility_stage_deliveries d
  JOIN public.mobility_stage_g122_delivery_price_consents c
   ON c.delivery_id=d.id AND c.sender_id=d.sender_id
    AND c.vehicle_kind=d.requested_vehicle_kind
  JOIN public.mobility_stage_fare_quotes q
   ON q.id=c.quote_id AND q.customer_id=d.sender_id
    AND q.subject_id=d.id AND q.subject_kind='DELIVERY'
    AND q.mode='DELIVERY' AND q.total_pyg=c.accepted_total_gs
    AND q.provider_pyg+q.commission_pyg=q.total_pyg
  JOIN public.mobility_stage_fare_rules r
   ON r.id=q.rule_id AND r.rule_key=c.accepted_fare_version
    AND r.mode='DELIVERY'
  JOIN public.mobility_stage_g122_delivery_rate_vehicle_qa vehicle
   ON vehicle.rule_id=r.id
    AND vehicle.vehicle_kind=d.requested_vehicle_kind
  WHERE pg_catalog.current_database()='qore_disposable_chain'
   AND pg_catalog.current_setting('application_name')='qore_ci_disposable_chain'
   AND d.id=_delivery AND d.courier_id IS NULL AND d.vehicle_id IS NULL
   AND d.proof_ref IS NULL
   AND (d.status='requested' AND d.revision=1
    OR d.status='cancelled' AND d.revision=2)
   AND public.mobility_stage_g27_backoffice_role_of(_admin)='admin'
 ), events AS MATERIALIZED (
  SELECT s.id,
   (SELECT count(*) FROM public.mobility_stage_delivery_events e
    WHERE e.delivery_id=s.id) n,
   (SELECT jsonb_agg(jsonb_build_object(
    'eventId',e.id,'serviceId',e.delivery_id,'sequence',e.delivery_revision,
    'status',e.next_status::text,
    'at',floor(extract(epoch FROM e.recorded_at)*1000)::bigint
   ) ORDER BY e.delivery_revision)
    FROM public.mobility_stage_delivery_events e
    WHERE e.delivery_id=s.id AND e.action='cancel'
     AND e.next_status='cancelled' AND e.actor_id=s.sender_id) cancelled_events
  FROM source s
 )
 SELECT jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','viewerId',_admin,
  'serviceId',s.id,'serviceKind',CASE
   WHEN s.requested_vehicle_kind='AUTO' THEN 'DELIVERY_AUTO'
   ELSE 'DELIVERY_MOTO' END,
  'bookingRequestKey',s.request_key,'quoteId',s.quote_id,
  'status',s.status,'revision',s.revision,
  'observedAt',stamp.ms,'expiresAt',stamp.ms+30000,
  'serverPersisted',true,'productionEnabled',false,
  'assignment',jsonb_build_object('state','NOT_ASSIGNABLE',
   'legalGate','G38_BLOCKED'),
  'events',jsonb_build_array(jsonb_build_object(
   'eventId',s.id,'serviceId',s.id,'sequence',1,'status','requested',
   'at',floor(extract(epoch FROM s.created_at)*1000)::bigint
  ))||COALESCE(e.cancelled_events,'[]'::jsonb),
  'ledger',NULL)
 FROM source s JOIN events e ON e.id=s.id CROSS JOIN stamp
 WHERE (s.status='requested' AND e.n=0)
    OR (s.status='cancelled' AND e.n=1
     AND jsonb_array_length(e.cancelled_events)=1
     AND s.changed_at>=s.created_at)
 LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g145_delivery_trace_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g145_delivery_trace_qa(uuid,uuid)
 TO service_role;
COMMIT;
