-- G277: bounded automatic G113 dispatch runner for noncommercial STAGING.
-- Depends on reviewed G262 + G269; not a scheduler and not LIVE.
-- The backend G113 timer may call this ONLY after an explicit QA rollout.
-- Never select a driver here: reuse G269 scoped worker, legal checks and locks.
DO $prerequisite$ BEGIN
 IF to_regclass('public.mobility_stage_g269_auto_dispatch_jobs') IS NULL
 OR to_regprocedure('qore_stage_internal.mobility_stage_g112_run_booked_auto_dispatch_qa(uuid,uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G277 requires G269 queue and scoped worker'; END IF;
END $prerequisite$;

CREATE FUNCTION qore_stage_internal.mobility_stage_g113_run_due_auto_batch_qa(
 _limit integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE
 job record;
 result jsonb;
 outcome text;
 processed integer:=0;
 waiting integer:=0;
 offered integer:=0;
 closed integer:=0;
 exhausted integer:=0;
BEGIN
 IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 10
 THEN RAISE EXCEPTION 'G277 invalid bounded dispatch budget' USING ERRCODE='P2771'; END IF;
 -- SKIP LOCKED prevents two replicas from claiming the same queue row.
 -- Revisit OFFERED only if it is stale/expired or the underlying trip left
 -- searching; the single-trip G112 worker decides whether to close/reoffer.
 FOR job IN
  SELECT j.passenger_id,j.booking_key,j.trip_id
  FROM public.mobility_stage_g269_auto_dispatch_jobs j
  JOIN public.mobility_stage_auto_demo_trips t
    ON t.id=j.trip_id AND t.passenger_id=j.passenger_id
  LEFT JOIN public.mobility_stage_auto_demo_offers o ON o.id=j.offer_id
  WHERE (
    (j.status IN ('PENDING','WAITING')
      AND j.next_attempt_at<=pg_catalog.clock_timestamp())
    OR (j.status='OFFERED' AND (
      t.status<>'searching' OR o.id IS NULL OR
      o.status<>'offered' OR o.expires_at<=pg_catalog.clock_timestamp()))
  )
  ORDER BY j.next_attempt_at,j.created_at,j.booking_key
  LIMIT _limit
  FOR UPDATE OF j SKIP LOCKED
 LOOP
  result:=qore_stage_internal.mobility_stage_g112_run_booked_auto_dispatch_qa(
   job.passenger_id,job.booking_key,job.trip_id);
  outcome:=result->>'status';
  IF result->>'mode' IS DISTINCT FROM 'STAGING_DEMO_ONLY'
   OR result->>'commercialEnabled' IS DISTINCT FROM 'false'
   OR result->>'tripId' IS DISTINCT FROM job.trip_id::text
  THEN RAISE EXCEPTION 'G277 invalid G112 private receipt' USING ERRCODE='P2772'; END IF;
  CASE outcome
   WHEN 'WAITING' THEN waiting:=waiting+1;
   WHEN 'OFFERED' THEN offered:=offered+1;
   WHEN 'CLOSED' THEN closed:=closed+1;
   WHEN 'EXHAUSTED' THEN exhausted:=exhausted+1;
   ELSE RAISE EXCEPTION 'G277 unexpected G112 dispatch state %',outcome
      USING ERRCODE='P2772';
  END CASE;
  processed:=processed+1;
 END LOOP;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,
  'processed',processed,'waiting',waiting,'offered',offered,
  'closed',closed,'exhausted',exhausted);
END $f$;

CREATE FUNCTION public.mobility_stage_g113_run_due_auto_batch_qa(
 _limit integer
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.mobility_stage_g113_run_due_auto_batch_qa($1)
$f$;
REVOKE ALL ON FUNCTION public.mobility_stage_g113_run_due_auto_batch_qa(integer)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION qore_stage_internal.mobility_stage_g113_run_due_auto_batch_qa(integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g113_run_due_auto_batch_qa(integer)
 TO service_role;
GRANT EXECUTE ON FUNCTION qore_stage_internal.mobility_stage_g113_run_due_auto_batch_qa(integer)
 TO service_role;
