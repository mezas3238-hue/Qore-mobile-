-- G212: enable Admin D trace for an ORIGINAL G100/G118 MOTO booking only
-- when an accepted private G118 offer and each G118 Driver event exist.
-- Disposable PG16 ONLY. G118 legal issuance remains intentionally impossible;
-- this does NOT imply a commercial MOTO passenger permit, GPS or payment.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g142_moto_trace_qa(uuid,uuid)') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g118_moto_offers') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g118_moto_events') IS NULL
 THEN RAISE EXCEPTION 'G212 refuses non-disposable or incomplete G100/G118/G142 sources'; END IF;
END $guard$;
BEGIN;
CREATE OR REPLACE FUNCTION public.mobility_stage_g142_moto_trace_qa(_admin uuid,_trip uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
 WITH stamp AS MATERIALIZED(
  SELECT pg_catalog.floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint ms
 ), source AS MATERIALIZED(
  SELECT t.id,t.booking_key,t.quote_id,t.status,t.revision,t.driver_id,
   t.vehicle_id,t.accepted_offer_id,t.cancellation_event_id,
   t.created_at,t.updated_at,t.completed_at,
   q.fare_gs,q.nominal_commission_gs,q.subsidy_gs,
   q.driver_receives_gs,q.platform_retains_gs,q.customer_pays_gs,
   o.id accepted_offer,o.decision_key accepted_decision,
   o.created_at offer_created,
   (SELECT pg_catalog.count(*) FROM public.mobility_stage_g118_moto_events e
    WHERE e.trip_id=t.id) event_count,
   (SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
     'eventId',e.command_key,'serviceId',e.trip_id,'sequence',e.revision,
     'status',e.to_state,
     'at',pg_catalog.floor(extract(epoch FROM e.recorded_at)*1000)::bigint)
      ORDER BY e.revision),'[]'::jsonb)
    FROM public.mobility_stage_g118_moto_events e WHERE e.trip_id=t.id) events,
   (SELECT COALESCE(pg_catalog.bool_and(
     e.revision=CASE e.to_state WHEN 'arriving' THEN 3
      WHEN 'in_progress' THEN 4 WHEN 'completed' THEN 5 ELSE 0 END
     AND e.driver_id=t.driver_id
     AND e.recorded_at>=COALESCE(o.created_at,t.created_at)),true)
    FROM public.mobility_stage_g118_moto_events e WHERE e.trip_id=t.id) events_valid
  FROM public.mobility_stage_g100_moto_trips t
  JOIN public.mobility_stage_g100_moto_quotes q
   ON q.id=t.quote_id AND q.passenger_id=t.passenger_id
  LEFT JOIN public.mobility_stage_g118_moto_offers o
   ON o.id=t.accepted_offer_id AND o.trip_id=t.id
   AND o.driver_id=t.driver_id AND o.vehicle_id=t.vehicle_id
   AND o.status='accepted' AND o.decision_key IS NOT NULL
  WHERE t.id=_trip
   AND public.mobility_stage_g27_backoffice_role_of(_admin)='admin'
 ), balanced AS(
  SELECT s.*,
   (SELECT pg_catalog.count(*) FROM public.mobility_stage_g100_moto_entries e
    WHERE e.quote_id=s.quote_id AND e.phase='reserve') reserves,
   (SELECT pg_catalog.count(*) FROM public.mobility_stage_g100_moto_entries e
    WHERE e.quote_id=s.quote_id AND e.phase='reverse') reversals,
   (SELECT COALESCE(pg_catalog.sum(CASE WHEN e.side='debit'
     THEN e.amount_gs ELSE -e.amount_gs END),0)
    FROM public.mobility_stage_g100_moto_entries e
    WHERE e.quote_id=s.quote_id AND e.phase='reserve') reserve_delta,
   (SELECT COALESCE(pg_catalog.sum(CASE WHEN e.side='debit'
     THEN e.amount_gs ELSE -e.amount_gs END),0)
    FROM public.mobility_stage_g100_moto_entries e
    WHERE e.quote_id=s.quote_id AND e.phase='reverse') reverse_delta,
   (SELECT pg_catalog.count(*) FROM public.mobility_stage_g100_moto_entries e
    JOIN public.mobility_stage_g100_moto_entries v
     ON v.quote_id=e.quote_id AND v.phase='reverse'
     AND v.account=e.account
    WHERE e.quote_id=s.quote_id AND e.phase='reserve'
     AND (v.side=e.side OR v.amount_gs<>e.amount_gs)) invalid_reversals
  FROM source s
 )
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','viewerId',_admin,
  'serviceId',s.id,'serviceKind','MOTO_RIDE',
  'bookingRequestKey',s.booking_key,'quoteId',s.quote_id,
  'status',CASE WHEN s.status='accepted' THEN 'assigned' ELSE s.status END,
  'revision',s.revision,
  'observedAt',stamp.ms,'expiresAt',stamp.ms+30000,
  'serverPersisted',true,'productionEnabled',false,
  'assignment',pg_catalog.jsonb_build_object(
    'state',CASE WHEN s.driver_id IS NULL THEN 'NOT_ASSIGNABLE'
     WHEN s.status='completed' THEN 'QA_COMPLETED' ELSE 'QA_ACCEPTED' END,
    'legalGate',CASE WHEN s.driver_id IS NULL THEN 'G38_BLOCKED'
     ELSE 'EXTERNAL_NOT_CERTIFIED' END),
  'events',
   pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'eventId',s.id,'serviceId',s.id,'sequence',1,'status','searching',
    'at',pg_catalog.floor(extract(epoch FROM s.created_at)*1000)::bigint
   ))||
   CASE WHEN s.status='cancelled' THEN
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
     'eventId',s.cancellation_event_id,'serviceId',s.id,
     'sequence',2,'status','cancelled',
     'at',pg_catalog.floor(extract(epoch FROM s.updated_at)*1000)::bigint))
   WHEN s.driver_id IS NOT NULL THEN
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
     'eventId',s.accepted_decision,'serviceId',s.id,
     'sequence',2,'status','assigned',
     'at',pg_catalog.floor(extract(epoch FROM s.offer_created)*1000)::bigint))
    ||s.events
   ELSE '[]'::jsonb END,
  'ledger',pg_catalog.jsonb_build_object(
   'serviceId',s.id,'currency','PYG','grossGs',s.fare_gs,
   'platformCommissionGs',s.nominal_commission_gs,
   'customerSubsidyGs',s.subsidy_gs,
   'driverPayoutGs',s.driver_receives_gs,
   'reconciliationStatus','PENDING'))
 FROM balanced s CROSS JOIN stamp
 WHERE s.reserves=4 AND s.reserve_delta=0
  AND s.reversals=CASE WHEN s.status='cancelled' THEN 4 ELSE 0 END
  AND s.reverse_delta=0 AND s.invalid_reversals=0
  AND s.customer_pays_gs+s.subsidy_gs=s.fare_gs
  AND s.driver_receives_gs+s.nominal_commission_gs=s.fare_gs
  AND s.customer_pays_gs=s.driver_receives_gs+s.platform_retains_gs
  AND ((s.status='searching' AND s.revision=1 AND s.driver_id IS NULL
       AND s.accepted_offer_id IS NULL AND s.event_count=0)
   OR (s.status='cancelled' AND s.revision=2 AND s.driver_id IS NULL
       AND s.accepted_offer_id IS NULL AND s.event_count=0
       AND s.cancellation_event_id IS NOT NULL AND s.updated_at>=s.created_at)
   OR (s.status IN ('accepted','arriving','in_progress','completed')
       AND s.accepted_offer IS NOT NULL
       AND s.accepted_decision IS NOT NULL
       AND s.offer_created>=s.created_at
       AND s.event_count=s.revision-2
       AND s.revision=CASE s.status WHEN 'accepted' THEN 2
          WHEN 'arriving' THEN 3 WHEN 'in_progress' THEN 4
          WHEN 'completed' THEN 5 ELSE 0 END
       AND s.events_valid IS TRUE
       AND (s.status='completed')=(s.completed_at IS NOT NULL)
       AND (s.event_count=0 OR (s.events->>-1) IS NOT NULL)))
 LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g142_moto_trace_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g142_moto_trace_qa(uuid,uuid)
 TO service_role;
COMMIT;
