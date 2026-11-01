-- CI_ONLY G275: disposable PostgreSQL 17 contract for the exact G113 SQL
-- extracted from g269_private_scoped_auto_dispatch_pg17.sql.
-- NEVER execute on Supabase, Railway or a persistent database.
\set ON_ERROR_STOP on
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_g275_ci' THEN
  RAISE EXCEPTION 'G275 CI_ONLY refuses non-disposable database';
 END IF;
END $guard$;

CREATE SCHEMA qore_stage_internal;
CREATE TABLE public.mobility_stage_g269_auto_dispatch_jobs(
 booking_key uuid PRIMARY KEY,
 passenger_id uuid NOT NULL,
 trip_id uuid NOT NULL,
 status text NOT NULL,
 next_attempt_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL
);
CREATE TABLE qore_stage_internal.g275_mock_calls(
 booking_key uuid PRIMARY KEY,
 attempts integer NOT NULL DEFAULT 0
);
CREATE FUNCTION qore_stage_internal.mobility_stage_g112_run_booked_auto_dispatch_qa(
 _passenger_id uuid,_booking_key uuid,_trip_id uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SET search_path='' AS $stub$
DECLARE next_status text; was_offered boolean;
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM public.mobility_stage_g269_auto_dispatch_jobs j
  WHERE j.passenger_id=_passenger_id AND j.booking_key=_booking_key
   AND j.trip_id=_trip_id)
 THEN RAISE EXCEPTION 'G275 fixture scope mismatch'; END IF;
 SELECT j.status='OFFERED' INTO was_offered
 FROM public.mobility_stage_g269_auto_dispatch_jobs j
 WHERE j.booking_key=_booking_key;
 UPDATE qore_stage_internal.g275_mock_calls
 SET attempts=attempts+1 WHERE booking_key=_booking_key;
 IF NOT FOUND THEN RAISE EXCEPTION 'G275 fixture not registered'; END IF;
 -- Gives overlapping CI transactions time to exercise SKIP LOCKED.
 PERFORM pg_catalog.pg_sleep(0.03);
 next_status:=CASE WHEN was_offered THEN 'WAITING' ELSE
  CASE _booking_key
  WHEN '00000000-0000-4000-8000-000000000001'::uuid THEN 'WAITING'
  WHEN '00000000-0000-4000-8000-000000000002'::uuid THEN 'OFFERED'
  ELSE 'CLOSED' END END;
 UPDATE public.mobility_stage_g269_auto_dispatch_jobs
 SET status=CASE next_status
  WHEN 'WAITING' THEN 'WAITING'
  WHEN 'OFFERED' THEN 'OFFERED'
  ELSE 'CLOSED' END,
  next_attempt_at=pg_catalog.clock_timestamp()+interval '60 seconds'
 WHERE booking_key=_booking_key;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,
  'status',next_status,'tripId',_trip_id,
  'offerId',CASE WHEN next_status='OFFERED'
   THEN '00000000-0000-4000-8000-000000000999'::uuid ELSE NULL END);
END $stub$;

-- Source under test must be extracted unchanged from GitHub migration.
\i /tmp/g275_g113.sql

INSERT INTO public.mobility_stage_g269_auto_dispatch_jobs
 (booking_key,passenger_id,trip_id,status,next_attempt_at,created_at)
SELECT ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 ('00000000-0000-4000-8000-'||lpad((i+100)::text,12,'0'))::uuid,
 ('00000000-0000-4000-8000-'||lpad((i+200)::text,12,'0'))::uuid,
 'PENDING',
 CASE WHEN i=4 THEN pg_catalog.clock_timestamp()+interval '1 hour'
  ELSE pg_catalog.clock_timestamp()-interval '1 minute' END,
 pg_catalog.clock_timestamp()-interval '10 minutes'+i*interval '1 second'
FROM pg_catalog.generate_series(1,4) AS i;
INSERT INTO qore_stage_internal.g275_mock_calls(booking_key)
 SELECT booking_key FROM public.mobility_stage_g269_auto_dispatch_jobs;

DO $test$
DECLARE r jsonb; rejected boolean; n integer;
BEGIN
 FOREACH n IN ARRAY ARRAY[0,11,-1] LOOP
  rejected:=false;
  BEGIN
   PERFORM qore_stage_internal.mobility_stage_g113_run_due_auto_batch_qa(n);
  EXCEPTION WHEN SQLSTATE 'P2694' THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'G275 invalid budget % accepted',n; END IF;
 END LOOP;
 rejected:=false;
 BEGIN
  PERFORM qore_stage_internal.mobility_stage_g113_run_due_auto_batch_qa(NULL);
 EXCEPTION WHEN SQLSTATE 'P2694' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G275 null budget accepted'; END IF;

 r:=qore_stage_internal.mobility_stage_g113_run_due_auto_batch_qa(2);
 IF r IS DISTINCT FROM '{"mode":"STAGING_DEMO_ONLY","commercialEnabled":false,"processed":2,"waiting":1,"offered":1,"closed":0,"exhausted":0}'::jsonb
 THEN RAISE EXCEPTION 'G275 incorrect first bounded batch: %',r; END IF;
 r:=qore_stage_internal.mobility_stage_g113_run_due_auto_batch_qa(10);
 IF r IS DISTINCT FROM '{"mode":"STAGING_DEMO_ONLY","commercialEnabled":false,"processed":1,"waiting":0,"offered":0,"closed":1,"exhausted":0}'::jsonb
 THEN RAISE EXCEPTION 'G275 incorrect second due batch: %',r; END IF;
 r:=qore_stage_internal.mobility_stage_g113_run_due_auto_batch_qa(10);
 IF r->>'processed' IS DISTINCT FROM '0'
 THEN RAISE EXCEPTION 'G275 duplicate immediate execution: %',r; END IF;
 IF (SELECT count(*) FROM qore_stage_internal.g275_mock_calls
  WHERE attempts=1)<>3
 OR (SELECT attempts FROM qore_stage_internal.g275_mock_calls
  WHERE booking_key='00000000-0000-4000-8000-000000000004'::uuid)<>0
 THEN RAISE EXCEPTION 'G275 future job processed or duplicate attempt'; END IF;
 IF r ? 'bookingKey' OR r ? 'tripId' OR r ? 'driverId' OR r ? 'passengerId'
 THEN RAISE EXCEPTION 'G275 batch leaked actor or trip IDs'; END IF;
 -- An OFFERED row must remain dormant before deadline, then become due
 -- and flow back to WAITING so another eligible Driver could be matched.
 UPDATE public.mobility_stage_g269_auto_dispatch_jobs
 SET next_attempt_at=pg_catalog.clock_timestamp()-interval '2 seconds'
 WHERE booking_key='00000000-0000-4000-8000-000000000002'::uuid
  AND status='OFFERED';
 IF NOT FOUND THEN RAISE EXCEPTION 'G276 fixture has no outstanding offer'; END IF;
 r:=qore_stage_internal.mobility_stage_g113_run_due_auto_batch_qa(5);
 IF r->>'processed' IS DISTINCT FROM '1'
  OR r->>'waiting' IS DISTINCT FROM '1'
  OR r->>'offered' IS DISTINCT FROM '0'
  OR (SELECT attempts FROM qore_stage_internal.g275_mock_calls
      WHERE booking_key='00000000-0000-4000-8000-000000000002'::uuid)<>2
  OR (SELECT status FROM public.mobility_stage_g269_auto_dispatch_jobs
      WHERE booking_key='00000000-0000-4000-8000-000000000002'::uuid)<>'WAITING'
 THEN RAISE EXCEPTION 'G276 expired OFFERED job did not resume: %',r; END IF;
 r:=qore_stage_internal.mobility_stage_g113_run_due_auto_batch_qa(5);
 IF r->>'processed' IS DISTINCT FROM '0'
 THEN RAISE EXCEPTION 'G276 just-retried job was dispatched twice: %',r; END IF;
 RAISE NOTICE 'G276 expired OFFERED -> WAITING once, bounded and idempotent PASS';
 RAISE NOTICE 'G275 disposable PG17 bounded due queue + negative budgets PASS';
END $test$;
