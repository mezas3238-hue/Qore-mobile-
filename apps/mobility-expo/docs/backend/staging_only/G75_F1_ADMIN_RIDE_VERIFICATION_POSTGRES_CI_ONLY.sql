-- G75: Admin F1 verification receipt from the SAME G73 quote and G3 trip.
-- Disposable PG16 QA ONLY, no external Auth, no deployment and no payments.
DO $g$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g73_booking_receipt(uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g27_backoffice_role_of(uuid)') IS NULL
 THEN RAISE EXCEPTION 'G75 requires disposable G73 and exclusive G27 Admin'; END IF;
END $g$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g75_admin_f1_receipt(
 _admin_id uuid,_trip_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
 WITH stamp AS MATERIALIZED (
   SELECT floor(extract(epoch from pg_catalog.clock_timestamp())*1000)::bigint AS ms
 )
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY',
  'commercialEnabled',false,
  'viewerId',_admin_id,'tripId',t.id,
  'routeId',q.route_id,'quoteId',q.id,
  'passengerId',t.passenger_id,
  'bookingRequestKey',q.booking_key,
  'service',t.service,'currency','PYG',
  'amountGs',q.total_pyg,'fareVersion',f.rule_key,
  'revision',t.revision,
  'status',CASE WHEN t.status='accepted' THEN 'assigned' ELSE t.status::text END,
  'assignmentPersisted',(t.driver_id IS NOT NULL),
  'driverId',CASE WHEN t.status IN ('accepted','arriving','in_progress')
                   THEN t.driver_id ELSE NULL::uuid END,
  'observedAt',stamp.ms,
  'expiresAt',stamp.ms+30000,
  'serverPersisted',true)
 FROM public.mobility_stage_auto_demo_trips t
 JOIN public.mobility_stage_g72_auto_prequotes q
   ON q.trip_id=t.id AND q.passenger_id=t.passenger_id
 JOIN public.mobility_stage_g73_auto_routes r
   ON r.id=q.route_id AND r.passenger_id=t.passenger_id
 JOIN public.mobility_stage_fare_rules f ON f.id=q.rule_id
 CROSS JOIN stamp
 WHERE t.id=_trip_id AND _admin_id IS NOT NULL
 AND public.mobility_stage_g27_backoffice_role_of(_admin_id)='admin'
 AND q.booking_key=t.request_key
 LIMIT 1
$f$;
REVOKE ALL ON FUNCTION public.mobility_stage_g75_admin_f1_receipt(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g75_admin_f1_receipt(uuid,uuid)
 TO service_role;
COMMIT;
