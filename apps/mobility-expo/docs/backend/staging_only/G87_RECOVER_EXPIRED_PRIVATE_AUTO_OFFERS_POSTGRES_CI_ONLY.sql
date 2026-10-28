-- G87: expired or declined G85 private offers MUST NOT strand searching G73 trips.
-- Disposable PostgreSQL16 QA ONLY; never run remotely / LIVE.
-- Keep G85 API unchanged for existing bounded manual worker; wrap its core.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g85_run_one_dispatch_qa()') IS NULL
 OR to_regclass('public.mobility_stage_g85_auto_dispatch_jobs') IS NULL
 THEN RAISE EXCEPTION 'G87 refuses non-disposable or incomplete G85 SQL'; END IF;
END $guard$;
BEGIN;
ALTER FUNCTION public.mobility_stage_g85_run_one_dispatch_qa()
 RENAME TO mobility_stage_g87_dispatch_core_qa;
REVOKE ALL ON FUNCTION public.mobility_stage_g87_dispatch_core_qa()
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mobility_stage_g85_run_one_dispatch_qa()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 job public.mobility_stage_g85_auto_dispatch_jobs%ROWTYPE;
 status_now public.mobility_stage_trip_status;
 current_offer public.mobility_stage_auto_demo_offers%ROWTYPE;
 fanout integer;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G87 not a production dispatch worker' USING ERRCODE='P8701'; END IF;
 -- The first stored offer may have been declined, expired, or its trip
 -- canceled/assigned. Claim only eligible stale jobs; never disturb an active
 -- unexpired offer or another concurrent G85 worker.
 SELECT j.* INTO job
 FROM public.mobility_stage_g85_auto_dispatch_jobs j
 JOIN public.mobility_stage_auto_demo_offers o ON o.id=j.offer_id
 JOIN public.mobility_stage_auto_demo_trips t ON t.id=j.trip_id
 WHERE j.status='OFFERED' AND
  (t.status<>'searching' OR o.status<>'offered'
   OR o.expires_at<=pg_catalog.clock_timestamp())
 ORDER BY o.expires_at,j.created_at,j.booking_key
 LIMIT 1 FOR UPDATE OF j SKIP LOCKED;
 IF FOUND THEN
  -- Lock trip before offer, matching G4 acceptance's lock order.
  SELECT status INTO status_now
   FROM public.mobility_stage_auto_demo_trips
   WHERE id=job.trip_id AND passenger_id=job.passenger_id
   AND request_key=job.booking_key FOR UPDATE;
  SELECT * INTO current_offer
   FROM public.mobility_stage_auto_demo_offers
   WHERE id=job.offer_id AND trip_id=job.trip_id FOR UPDATE;
  IF NOT FOUND OR status_now IS NULL OR status_now<>'searching' THEN
   UPDATE public.mobility_stage_g85_auto_dispatch_jobs
    SET status='CLOSED',offer_id=NULL,
     updated_at=pg_catalog.clock_timestamp()
   WHERE booking_key=job.booking_key;
  ELSIF current_offer.status<>'offered'
    OR current_offer.expires_at<=pg_catalog.clock_timestamp() THEN
   SELECT count(*) INTO fanout
   FROM public.mobility_stage_auto_demo_offers WHERE trip_id=job.trip_id;
   IF job.attempts>=12 OR fanout>=5 THEN
    UPDATE public.mobility_stage_g85_auto_dispatch_jobs
     SET status='EXHAUSTED',offer_id=NULL,
      updated_at=pg_catalog.clock_timestamp()
    WHERE booking_key=job.booking_key;
   ELSE
    -- Fresh offer key is essential: G82 intentionally replays old keys and
    -- would otherwise resurrect the expired offer, keeping the queue stuck.
    UPDATE public.mobility_stage_g85_auto_dispatch_jobs
     SET status='WAITING',offer_id=NULL,
      offer_key=pg_catalog.gen_random_uuid(),
      next_attempt_at=pg_catalog.clock_timestamp(),
      updated_at=pg_catalog.clock_timestamp()
    WHERE booking_key=job.booking_key;
   END IF;
  END IF;
 END IF;
 -- The original G85 SQL still performs SKIP LOCKED claim, candidate KYC
 -- checks, backoff and at-most-once durable G4 offer/outbox insertion.
 RETURN public.mobility_stage_g87_dispatch_core_qa();
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g85_run_one_dispatch_qa()
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g85_run_one_dispatch_qa()
 TO service_role;
COMMIT;
