-- G142 MOTO Passenger Admin trace: original G100 booking and 4+4 entries.
-- Disposable PostgreSQL16 only. No Driver, PSP, LIVE, GPS, geofence approval.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g100_moto_trips') IS NULL
 OR to_regclass('public.mobility_stage_g100_moto_entries') IS NULL
 OR to_regprocedure('public.mobility_stage_g27_backoffice_role_of(uuid)') IS NULL
 THEN RAISE EXCEPTION 'G142 requires authentic disposable G100/G27'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g142_moto_trace_qa(_admin uuid,_trip uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
 WITH stamp AS MATERIALIZED(
  SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint ms
 ), source AS MATERIALIZED(
  SELECT t.id,t.booking_key,t.quote_id,t.status,t.revision,
   t.cancellation_event_id,t.created_at,t.updated_at,
   q.fare_gs,q.nominal_commission_gs,q.subsidy_gs,
   q.driver_receives_gs,q.platform_retains_gs,q.customer_pays_gs
  FROM public.mobility_stage_g100_moto_trips t
  JOIN public.mobility_stage_g100_moto_quotes q
   ON q.id=t.quote_id AND q.passenger_id=t.passenger_id
  WHERE t.id=_trip AND t.status IN ('searching','cancelled')
   AND public.mobility_stage_g27_backoffice_role_of(_admin)='admin'
   AND t.revision=CASE WHEN t.status='searching' THEN 1 ELSE 2 END
 ), balanced AS(
  SELECT s.*,
   (SELECT count(*) FROM public.mobility_stage_g100_moto_entries e
    WHERE e.quote_id=s.quote_id AND e.phase='reserve') reserves,
   (SELECT count(*) FROM public.mobility_stage_g100_moto_entries e
    WHERE e.quote_id=s.quote_id AND e.phase='reverse') reversals,
   (SELECT COALESCE(sum(CASE WHEN e.side='debit' THEN e.amount_gs
                            ELSE -e.amount_gs END),0)
    FROM public.mobility_stage_g100_moto_entries e
    WHERE e.quote_id=s.quote_id AND e.phase='reserve') reserve_delta,
   (SELECT COALESCE(sum(CASE WHEN e.side='debit' THEN e.amount_gs
                            ELSE -e.amount_gs END),0)
    FROM public.mobility_stage_g100_moto_entries e
    WHERE e.quote_id=s.quote_id AND e.phase='reverse') reverse_delta,
   (SELECT count(*) FROM public.mobility_stage_g100_moto_entries e
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
  'status',s.status,'revision',s.revision,
  'observedAt',stamp.ms,'expiresAt',stamp.ms+30000,
  'serverPersisted',true,'productionEnabled',false,
  'assignment',pg_catalog.jsonb_build_object(
    'state','NOT_ASSIGNABLE','legalGate','G38_BLOCKED'),
  'events',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'eventId',s.id,'serviceId',s.id,'sequence',1,'status','searching',
    'at',floor(extract(epoch FROM s.created_at)*1000)::bigint
   )) || CASE WHEN s.status='cancelled' THEN
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
     'eventId',s.cancellation_event_id,'serviceId',s.id,
     'sequence',2,'status','cancelled',
     'at',floor(extract(epoch FROM s.updated_at)*1000)::bigint))
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
  AND (s.status<>'cancelled' OR
   s.cancellation_event_id IS NOT NULL AND s.updated_at>=s.created_at)
 LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g142_moto_trace_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g142_moto_trace_qa(uuid,uuid)
 TO service_role;
COMMIT;
