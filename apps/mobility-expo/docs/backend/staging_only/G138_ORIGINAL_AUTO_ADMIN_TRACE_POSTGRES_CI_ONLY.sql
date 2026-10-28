-- G138 first authoritative Admin AUTO service trace. Disposable PostgreSQL16 ONLY.
-- One original G73 booked trip, immutable G3 status/events and G93 ledger.
-- No simulation of legal Driver acceptance, paid settlement or other services.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure(
  'public.mobility_stage_g75_admin_f1_receipt(uuid,uuid)') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g93_auto_ledger') IS NULL
 THEN RAISE EXCEPTION 'G138 original G75/G93 source unavailable'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g138_auto_trace_qa(_admin uuid,_trip uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
 WITH stamp AS MATERIALIZED (
  SELECT pg_catalog.floor(extract(epoch FROM
   pg_catalog.clock_timestamp())*1000)::bigint ms
 ), allowed AS MATERIALIZED (
  SELECT t.id,t.request_key,t.status::text status,t.revision,t.created_at,
   q.id quote_id,q.booking_key,t.passenger_id
  FROM public.mobility_stage_auto_demo_trips t
  JOIN public.mobility_stage_g72_auto_prequotes q
   ON q.trip_id=t.id AND q.booking_key=t.request_key
   AND q.passenger_id=t.passenger_id AND q.route_id IS NOT NULL
  WHERE t.id=_trip AND t.driver_id IS NULL
   AND t.status IN ('searching','cancelled')
   AND public.mobility_stage_g27_backoffice_role_of(_admin)='admin'
 ), actual AS (
  SELECT a.*,
   (SELECT pg_catalog.count(*) FROM public.mobility_stage_auto_demo_events e
    WHERE e.trip_id=a.id) n_events,
   (SELECT COALESCE(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
     'eventId',e.id,'serviceId',e.trip_id,
     'sequence',e.trip_revision,
     'status',CASE WHEN e.next_status='accepted' THEN 'assigned'
       ELSE e.next_status::text END,
     'at',pg_catalog.floor(extract(epoch FROM e.recorded_at)*1000)::bigint)
    ORDER BY e.trip_revision), '[]'::jsonb)
    FROM public.mobility_stage_auto_demo_events e
    WHERE e.trip_id=a.id) events,
   (SELECT pg_catalog.max(e.trip_revision)
    FROM public.mobility_stage_auto_demo_events e
    WHERE e.trip_id=a.id) max_event_revision
  FROM allowed a
 ), ledger AS (
  SELECT l.*,
   (SELECT pg_catalog.count(*) FROM public.mobility_stage_g93_auto_ledger_entries e
    WHERE e.quote_id=l.quote_id) n_entries,
   (SELECT COALESCE(pg_catalog.sum(
    CASE WHEN e.side='debit' THEN e.amount_gs ELSE -e.amount_gs END),0)
    FROM public.mobility_stage_g93_auto_ledger_entries e
    WHERE e.quote_id=l.quote_id) delta
  FROM public.mobility_stage_g93_auto_ledger l
 )
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','viewerId',_admin,
  'serviceId',a.id,'serviceKind','AUTO_RIDE',
  'bookingRequestKey',a.request_key,'quoteId',a.quote_id,
  'status',a.status,'revision',a.revision,
  'observedAt',s.ms,'expiresAt',s.ms+30000,
  'serverPersisted',true,'productionEnabled',false,
  'assignment',pg_catalog.jsonb_build_object(
    'state','NOT_ASSIGNABLE','legalGate','G38_BLOCKED'),
  'events',pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
     'eventId',a.id,'serviceId',a.id,'sequence',1,
     'status','searching',
     'at',pg_catalog.floor(extract(epoch FROM a.created_at)*1000)::bigint)
   )||a.events,
  'ledger',CASE WHEN l.quote_id IS NULL THEN NULL
   ELSE pg_catalog.jsonb_build_object(
    'serviceId',l.trip_id,'currency','PYG',
    'grossGs',l.original_fare_gs,
    'platformCommissionGs',l.nominal_commission_gs,
    'customerSubsidyGs',l.subsidy_gs,
    'driverPayoutGs',l.driver_receives_gs,
    'reconciliationStatus','PENDING') END)
 FROM actual a
 LEFT JOIN ledger l ON l.trip_id=a.id AND l.booking_key=a.request_key
  AND l.quote_id=a.quote_id AND l.passenger_id=a.passenger_id
 CROSS JOIN stamp s
 WHERE a.revision=a.n_events+1
  AND (a.revision=1 OR a.max_event_revision=a.revision)
  AND (a.status='searching' AND a.revision=1
   OR a.status='cancelled' AND a.revision>=2)
  AND (l.quote_id IS NULL OR
   l.n_entries=4 AND l.delta=0 AND
   l.customer_pays_gs+l.subsidy_gs=l.original_fare_gs AND
   l.driver_receives_gs+l.nominal_commission_gs=l.original_fare_gs)
 LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g138_auto_trace_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g138_auto_trace_qa(uuid,uuid)
 TO service_role;
COMMIT;
