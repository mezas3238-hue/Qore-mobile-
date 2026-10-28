-- G113: backend-owned bounded due-work scheduler RPC for G112.
-- Pure PostgreSQL16 CI, never apply to remote Supabase.
-- No LIVE, no production eligibility inference, no on-device scheduling.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g112_run_booked_auto_dispatch_qa(uuid,uuid,uuid)') IS NULL
 OR to_regclass('public.mobility_stage_g85_auto_dispatch_jobs') IS NULL
 THEN RAISE EXCEPTION 'G113 refuses non-disposable or missing G112 worker'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g113_run_due_auto_batch_qa(_limit integer)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 job record; receipt jsonb; stage text;
 done_count integer:=0; wait_count integer:=0; offer_count integer:=0;
 close_count integer:=0; exhaust_count integer:=0;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _limit IS NULL OR _limit NOT BETWEEN 1 AND 10
 THEN RAISE EXCEPTION 'G113 requires a bounded CI dispatch budget'
  USING ERRCODE='P1131'; END IF;
 -- Never scan or claim undued jobs. A live offer remains intact until it
 -- expires or is explicitly declined. Claimed rows are isolated with
 -- SKIP LOCKED, even if another backend worker is active in parallel.
 FOR job IN
  SELECT j.passenger_id,j.booking_key,j.trip_id
  FROM public.mobility_stage_g85_auto_dispatch_jobs j
  JOIN public.mobility_stage_auto_demo_trips t ON t.id=j.trip_id
  LEFT JOIN public.mobility_stage_auto_demo_offers o ON o.id=j.offer_id
  WHERE
   (j.status IN ('PENDING','WAITING') AND
      j.next_attempt_at<=pg_catalog.clock_timestamp())
   OR (j.status='OFFERED' AND (
      t.status<>'searching' OR o.id IS NULL
      OR o.status<>'offered'
      OR o.expires_at<=pg_catalog.clock_timestamp()))
  ORDER BY j.next_attempt_at,j.created_at,j.booking_key
  LIMIT _limit
  FOR UPDATE OF j SKIP LOCKED
 LOOP
  -- G112 independently authenticates persisted G73 route/prequote/booking
  -- scope, locks the same job and trip, rechecks G71+G38 before any offer,
  -- and caps attempts and fanout. All SQL remains one atomic transaction.
  receipt:=public.mobility_stage_g112_run_booked_auto_dispatch_qa(
   job.passenger_id,job.booking_key,job.trip_id);
  IF jsonb_typeof(receipt)<>'object'
    OR receipt->>'mode'<>'STAGING_DEMO_ONLY'
    OR receipt->>'commercialEnabled'<>'false'
  THEN RAISE EXCEPTION 'G113 refused untrusted worker receipt'
   USING ERRCODE='P1131'; END IF;
  stage:=receipt->>'status';
  IF stage='WAITING' THEN wait_count:=wait_count+1;
  ELSIF stage='OFFERED' THEN offer_count:=offer_count+1;
  ELSIF stage='CLOSED' THEN close_count:=close_count+1;
  ELSIF stage='EXHAUSTED' THEN exhaust_count:=exhaust_count+1;
  ELSE RAISE EXCEPTION 'G113 unexpected due-job outcome'
   USING ERRCODE='P1131'; END IF;
  done_count:=done_count+1;
 END LOOP;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,
  'processed',done_count,'waiting',wait_count,'offered',offer_count,
  'closed',close_count,'exhausted',exhaust_count);
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g113_run_due_auto_batch_qa(integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g113_run_due_auto_batch_qa(integer)
 TO service_role;
COMMIT;
