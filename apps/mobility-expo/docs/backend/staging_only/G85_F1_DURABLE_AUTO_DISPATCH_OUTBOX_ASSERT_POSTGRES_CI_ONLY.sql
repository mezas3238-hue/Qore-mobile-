-- G85 persisted queue, duplicate BOOK prevention and no-candidate backoff.
-- All synthetic mutations rollback, never authorize a real Driver.
DO $g$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g85_auto_dispatch_jobs') IS NULL
 OR to_regprocedure('public.mobility_stage_g85_run_one_dispatch_qa()') IS NULL
 THEN RAISE EXCEPTION 'G85 cannot test outside disposable DB'; END IF;
 IF has_table_privilege('service_role',
  'public.mobility_stage_g85_auto_dispatch_jobs','SELECT')
 OR has_table_privilege('authenticated',
  'public.mobility_stage_g85_auto_dispatch_jobs','UPDATE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g85_run_one_dispatch_qa()','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.mobility_stage_g85_run_one_dispatch_qa()','EXECUTE')
 THEN RAISE EXCEPTION 'G85 grants expose internal dispatch'; END IF;
END $g$;
BEGIN;
SET LOCAL statement_timeout='75s';
INSERT INTO auth.users(id) VALUES ('85850000-0000-4858-8858-000000000001');
DO $book$
DECLARE
 p uuid:='85850000-0000-4858-8858-000000000001';
 b uuid:='85850000-0000-4858-8858-000000000012';
 r uuid;q uuid;t uuid;t2 uuid;
BEGIN
 r:=public.mobility_stage_g73_route(p,
  '85850000-0000-4858-8858-000000000010','economico',
  'CENTRO_FIXTURE','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 q:=public.mobility_stage_g73_quote(p,r,
  '85850000-0000-4858-8858-000000000011');
 t:=public.mobility_stage_g73_book(p,q,b);
 t2:=public.mobility_stage_g73_book(p,q,b);
 IF t IS NULL OR t2<>t OR
 (SELECT count(*) FROM public.mobility_stage_g85_auto_dispatch_jobs
 WHERE trip_id=t AND booking_key=b AND passenger_id=p AND status='PENDING')<>1
 THEN RAISE EXCEPTION 'G85 missed or duplicated committed booking outbox'; END IF;
END $book$;
-- Nobody qualifies in this deliberately isolated QA fixture. Do not weaken
-- KYC to create a fake positive: G81 tests prove positive offer reconciliation.
UPDATE public.mobility_vehicles SET review_status='suspended'
 WHERE vehicle_kind='AUTO' AND review_status='approved';
SET LOCAL ROLE service_role;
DO $run$
DECLARE receipt jsonb;second jsonb;
BEGIN
 receipt:=public.mobility_stage_g85_run_one_dispatch_qa();
 IF receipt->>'mode'<>'STAGING_DEMO_ONLY'
 OR receipt->>'commercialEnabled'<>'false' OR receipt->>'status'<>'WAITING'
 OR receipt->>'offerId' IS NOT NULL
 THEN RAISE EXCEPTION 'G85 no eligible Driver did not persist retry'; END IF;
 second:=public.mobility_stage_g85_run_one_dispatch_qa();
 IF second->>'status'<>'IDLE'
 THEN RAISE EXCEPTION 'G85 violated backoff after unavailable Driver'; END IF;
END $run$;
RESET ROLE;
DO $validate$
DECLARE
 b uuid:='85850000-0000-4858-8858-000000000012';
 t uuid;
BEGIN
 SELECT trip_id INTO t FROM public.mobility_stage_g85_auto_dispatch_jobs
 WHERE booking_key=b AND status='WAITING' AND attempts=1
 AND next_attempt_at>pg_catalog.clock_timestamp();
 IF t IS NULL OR EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_offers
 WHERE trip_id=t)
 THEN RAISE EXCEPTION 'G85 waiting generated unauthorized offer'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_g85_auto_dispatch_jobs
 WHERE booking_key=b)<>1
 THEN RAISE EXCEPTION 'G85 duplicate queue records'; END IF;
 RAISE NOTICE 'G85 PASS: G73 durable queue, retry backoff, no unauthorized offer';
END $validate$;
ROLLBACK;
