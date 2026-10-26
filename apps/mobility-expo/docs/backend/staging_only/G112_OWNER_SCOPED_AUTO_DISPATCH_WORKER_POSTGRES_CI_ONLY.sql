-- G112: a booked Passenger's first dispatch must never consume ANOTHER
-- Passenger's due G85 outbox row. Explicit owner+booking+trip scope only.
-- Bounded retries, serial row lock, G87 stale-offer replacement, G82/G38/G71
-- KYC/legal prerequisites. CI PostgreSQL16 ONLY. NO scheduler / LIVE.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g85_run_one_dispatch_qa()') IS NULL
 OR to_regprocedure('public.mobility_stage_g82_offer_first_eligible_auto_qa(uuid,uuid,uuid,integer)') IS NULL
 OR to_regclass('public.mobility_stage_g85_auto_dispatch_jobs') IS NULL
 THEN RAISE EXCEPTION 'G112 requires disposable G87/G85/G82 pipeline'; END IF;
END $guard$;
BEGIN;
CREATE FUNCTION public.mobility_stage_g112_run_booked_auto_dispatch_qa(
 _passenger_id uuid,_booking_key uuid,_trip_id uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 job public.mobility_stage_g85_auto_dispatch_jobs%ROWTYPE;
 trip_state public.mobility_stage_trip_status;
 prior_offer public.mobility_stage_auto_demo_offers%ROWTYPE;
 existing_offer uuid;created_offer uuid;
 fanout integer;result_status text;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _passenger_id IS NULL OR _booking_key IS NULL OR _trip_id IS NULL
 THEN RAISE EXCEPTION 'G112 nonlocal or invalid owner-bound booking'
  USING ERRCODE='P1121'; END IF;
 -- The G73 route, prequote and trip must STILL bind to this owner, key and
 -- selected service. This is not permission to dispatch arbitrary trip UUIDs.
 IF NOT EXISTS (
  SELECT 1 FROM public.mobility_stage_g72_auto_prequotes q
  JOIN public.mobility_stage_g73_auto_routes r ON
   r.id=q.route_id AND r.passenger_id=q.passenger_id
  JOIN public.mobility_stage_auto_demo_trips t ON
   t.id=q.trip_id AND t.passenger_id=q.passenger_id
   AND t.request_key=q.booking_key
   AND t.service=r.service AND t.origin_tag=r.origin_tag
   AND t.destination_tag=r.destination_tag
  WHERE q.passenger_id=_passenger_id
   AND q.booking_key=_booking_key AND q.trip_id=_trip_id
 ) THEN RAISE EXCEPTION 'G112 no verified original G73 booking'
  USING ERRCODE='P1121'; END IF;
 -- Unlike G85's GLOBAL worker, this only locks ONE authorized booking;
 -- neither another Passenger nor an older booking can consume this attempt.
 SELECT * INTO job FROM public.mobility_stage_g85_auto_dispatch_jobs j
 WHERE j.booking_key=_booking_key AND j.passenger_id=_passenger_id
  AND j.trip_id=_trip_id FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RAISE EXCEPTION 'G112 scoped queue absent or busy'
  USING ERRCODE='P1121'; END IF;
 SELECT t.status INTO trip_state FROM public.mobility_stage_auto_demo_trips t
 WHERE t.id=job.trip_id AND t.passenger_id=job.passenger_id
 AND t.request_key=job.booking_key FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G112 booking trip unavailable'
  USING ERRCODE='P1121'; END IF;
 IF trip_state<>'searching' THEN
  UPDATE public.mobility_stage_g85_auto_dispatch_jobs SET
   status='CLOSED',offer_id=NULL,updated_at=pg_catalog.clock_timestamp()
  WHERE booking_key=job.booking_key AND status<>'CLOSED';
  RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
   'commercialEnabled',false,'status','CLOSED','tripId',job.trip_id);
 END IF;
 IF job.status IN ('CLOSED','EXHAUSTED') THEN
  RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
   'commercialEnabled',false,'status',
   CASE WHEN job.status='EXHAUSTED' THEN 'EXHAUSTED' ELSE 'CLOSED' END,
   'tripId',job.trip_id);
 END IF;
 IF job.status='OFFERED' THEN
  SELECT * INTO prior_offer FROM public.mobility_stage_auto_demo_offers o
  WHERE o.id=job.offer_id AND o.trip_id=job.trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'G112 missing private offer'
   USING ERRCODE='P1121'; END IF;
  IF prior_offer.status='offered' AND
   prior_offer.expires_at>pg_catalog.clock_timestamp() THEN
   RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
    'commercialEnabled',false,'status','OFFERED','tripId',job.trip_id,
    'offerId',job.offer_id);
  END IF;
  -- G87 equivalent, scoped to this booked Passenger. Never revive a
  -- declined/expired offer or exceed fanout/attempt limits.
  SELECT count(*) INTO fanout FROM public.mobility_stage_auto_demo_offers o
   WHERE o.trip_id=job.trip_id;
  IF job.attempts>=12 OR fanout>=5 THEN
   UPDATE public.mobility_stage_g85_auto_dispatch_jobs SET
    status='EXHAUSTED',offer_id=NULL,
    updated_at=pg_catalog.clock_timestamp()
   WHERE booking_key=job.booking_key;
   RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
    'commercialEnabled',false,'status','EXHAUSTED','tripId',job.trip_id);
  END IF;
  UPDATE public.mobility_stage_g85_auto_dispatch_jobs SET
   status='WAITING',offer_id=NULL,offer_key=pg_catalog.gen_random_uuid(),
   next_attempt_at=pg_catalog.clock_timestamp(),
   updated_at=pg_catalog.clock_timestamp()
  WHERE booking_key=job.booking_key;
 END IF;
 -- The row lock remains held throughout G82 + queue update.
 SELECT * INTO job FROM public.mobility_stage_g85_auto_dispatch_jobs
 WHERE booking_key=_booking_key;
 IF job.status NOT IN ('PENDING','WAITING')
 THEN RAISE EXCEPTION 'G112 private queue state race'
  USING ERRCODE='P1121'; END IF;
 IF job.next_attempt_at>pg_catalog.clock_timestamp() THEN
  RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
   'commercialEnabled',false,'status','IDLE');
 END IF;
 IF job.attempts>=12 THEN
  UPDATE public.mobility_stage_g85_auto_dispatch_jobs SET
   status='EXHAUSTED',updated_at=pg_catalog.clock_timestamp()
  WHERE booking_key=job.booking_key;
  RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
   'commercialEnabled',false,'status','EXHAUSTED','tripId',job.trip_id);
 END IF;
 -- G84/G91 may already have an unexpired trusted offer. Never duplicate it.
 SELECT o.id INTO existing_offer FROM public.mobility_stage_auto_demo_offers o
 JOIN public.mobility_stage_auto_demo_push_outbox pushed ON
  pushed.offer_id=o.id AND pushed.driver_id=o.driver_id
 WHERE o.trip_id=job.trip_id AND o.status='offered'
 AND o.expires_at>pg_catalog.clock_timestamp()
 ORDER BY o.offered_at,o.id LIMIT 1;
 IF FOUND THEN created_offer:=existing_offer;
 ELSE
  created_offer:=public.mobility_stage_g82_offer_first_eligible_auto_qa(
   job.passenger_id,job.booking_key,job.offer_key,30);
 END IF;
 IF created_offer IS NULL THEN
  result_status:='WAITING';
  UPDATE public.mobility_stage_g85_auto_dispatch_jobs SET
   status='WAITING',attempts=attempts+1,
   next_attempt_at=pg_catalog.clock_timestamp()+interval '30 seconds',
   updated_at=pg_catalog.clock_timestamp()
  WHERE booking_key=job.booking_key;
 ELSE
  result_status:='OFFERED';
  UPDATE public.mobility_stage_g85_auto_dispatch_jobs SET
   status='OFFERED',offer_id=created_offer,attempts=attempts+1,
   updated_at=pg_catalog.clock_timestamp()
  WHERE booking_key=job.booking_key;
 END IF;
 RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
  'commercialEnabled',false,'status',result_status,
  'tripId',job.trip_id,'offerId',created_offer);
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g112_run_booked_auto_dispatch_qa(
 uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g112_run_booked_auto_dispatch_qa(
 uuid,uuid,uuid) TO service_role;
COMMIT;
