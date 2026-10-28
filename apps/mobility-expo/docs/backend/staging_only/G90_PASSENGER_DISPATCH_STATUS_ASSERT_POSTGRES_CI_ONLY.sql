-- G90 end-to-end G73 real booking -> G85 pending/backoff/exhaustion
-- and no-cross-passenger leak, on disposable PostgreSQL only.
BEGIN;
SET LOCAL statement_timeout='50s';
DO $check$
DECLARE p uuid:='90900000-0000-4909-8909-000000000001';
 b uuid:='90900000-0000-4909-8909-000000000012';
 rt uuid;qt uuid;trip uuid;result jsonb;
BEGIN
 INSERT INTO auth.users(id) VALUES(p);
 rt:=public.mobility_stage_g73_route(p,
  '90900000-0000-4909-8909-000000000010','economico',
  'CENTRO_FIXTURE','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 qt:=public.mobility_stage_g73_quote(p,rt,
  '90900000-0000-4909-8909-000000000011');
 trip:=public.mobility_stage_g73_book(p,qt,b);
 result:=public.mobility_stage_g90_passenger_dispatch_status_qa(p,b);
 IF result->>'dispatchState'<>'SEARCHING_DRIVER'
 OR result->>'tripId'<>trip::text OR result->>'offerPendingAcceptance'<>'false'
 OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(result))<>9
 OR result ? 'driverId' OR result ? 'offerId' OR result ? 'vehicleId'
 OR public.mobility_stage_g90_passenger_dispatch_status_qa(
  '90900000-0000-4909-8909-000000000002',b) IS NOT NULL
 OR public.mobility_stage_g90_passenger_dispatch_status_qa(p,
  '90900000-0000-4909-8909-000000000022') IS NOT NULL
 THEN RAISE EXCEPTION 'G90 insecure pending Passenger receipt'; END IF;
END $check$;
DO $priv$
BEGIN
 IF has_function_privilege('authenticated',
  'public.mobility_stage_g90_passenger_dispatch_status_qa(uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_g90_passenger_dispatch_status_qa(uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.mobility_stage_g90_passenger_dispatch_status_qa(uuid,uuid)','EXECUTE')
 OR has_table_privilege('service_role',
  'public.mobility_stage_g85_auto_dispatch_jobs','SELECT')
 THEN RAISE EXCEPTION 'G90 direct private dispatch authority leak'; END IF;
END $priv$;
UPDATE public.mobility_vehicles SET review_status='suspended'
 WHERE vehicle_kind='AUTO' AND review_status='approved';
SET LOCAL ROLE service_role;
DO $waiting$
DECLARE r jsonb;q jsonb;
BEGIN
 r:=public.mobility_stage_g85_run_one_dispatch_qa();
 q:=public.mobility_stage_g90_passenger_dispatch_status_qa(
  '90900000-0000-4909-8909-000000000001',
  '90900000-0000-4909-8909-000000000012');
 IF r->>'status'<>'WAITING' OR q->>'dispatchState'<>'RETRY_PENDING'
 OR q->>'attempts'<>'1' OR q->>'offerPendingAcceptance'<>'false'
 THEN RAISE EXCEPTION 'G90 failed G85 private waiting backoff'; END IF;
END $waiting$;
RESET ROLE;
UPDATE public.mobility_stage_g85_auto_dispatch_jobs
 SET attempts=12,next_attempt_at=pg_catalog.clock_timestamp()-interval '1 second'
 WHERE booking_key='90900000-0000-4909-8909-000000000012';
SET LOCAL ROLE service_role;
DO $exhausted$
DECLARE r jsonb;q jsonb;
BEGIN
 r:=public.mobility_stage_g85_run_one_dispatch_qa();
 q:=public.mobility_stage_g90_passenger_dispatch_status_qa(
  '90900000-0000-4909-8909-000000000001',
  '90900000-0000-4909-8909-000000000012');
 IF r->>'status'<>'EXHAUSTED' OR q->>'dispatchState'<>'SEARCH_EXHAUSTED'
 OR q->>'attempts'<>'12' OR q->>'tripState'<>'searching'
 THEN RAISE EXCEPTION 'G90 falsely reported an eligible Driver after exhaustion'; END IF;
END $exhausted$;
RESET ROLE;
ROLLBACK;
