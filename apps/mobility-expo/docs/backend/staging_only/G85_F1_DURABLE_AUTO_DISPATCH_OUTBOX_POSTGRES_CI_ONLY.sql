-- G85: durable server-only dispatch continuation after a G73 committed
-- Passenger booking. PostgreSQL16 ephemeral QA ONLY. NEVER remote / LIVE.
-- G84 may create an offer immediately; this queue reconciles it instead of
-- minting another. Worker invocation is explicit: NO scheduler is deployed.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g82_offer_first_eligible_auto_qa(uuid,uuid,uuid,integer)') IS NULL
 OR to_regclass('public.mobility_stage_g73_auto_routes') IS NULL
 THEN RAISE EXCEPTION 'G85 requires disposable G73/G82 chain'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g85_auto_dispatch_jobs (
 booking_key uuid PRIMARY KEY,
 passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 trip_id uuid NOT NULL UNIQUE REFERENCES public.mobility_stage_auto_demo_trips(id) ON DELETE RESTRICT,
 offer_key uuid NOT NULL UNIQUE DEFAULT pg_catalog.gen_random_uuid(),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN
  ('PENDING','WAITING','OFFERED','CLOSED')),
 offer_id uuid UNIQUE REFERENCES public.mobility_stage_auto_demo_offers(id) ON DELETE RESTRICT,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 12),
 next_attempt_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 CHECK ((status='OFFERED')=(offer_id IS NOT NULL))
);
CREATE INDEX mobility_stage_g85_due_auto_jobs ON
 public.mobility_stage_g85_auto_dispatch_jobs(next_attempt_at,created_at,booking_key)
 WHERE status IN ('PENDING','WAITING');
ALTER TABLE public.mobility_stage_g85_auto_dispatch_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g85_auto_dispatch_jobs
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mobility_stage_g85_enqueue_on_book()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF TG_OP<>'UPDATE' OR TG_TABLE_SCHEMA<>'public'
 OR TG_TABLE_NAME<>'mobility_stage_g72_auto_prequotes'
 THEN RAISE EXCEPTION 'G85 invalid trigger origin' USING ERRCODE='P8501'; END IF;
 IF NEW.trip_id IS NOT NULL AND OLD.trip_id IS NULL THEN
  IF NEW.booking_key IS NULL OR NEW.route_id IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.mobility_stage_auto_demo_trips t
   JOIN public.mobility_stage_g73_auto_routes r
    ON r.id=NEW.route_id AND r.passenger_id=NEW.passenger_id
   WHERE t.id=NEW.trip_id AND t.passenger_id=NEW.passenger_id
   AND t.request_key=NEW.booking_key AND t.service=r.service
   AND t.origin_tag=r.origin_tag AND t.destination_tag=r.destination_tag)
  THEN RAISE EXCEPTION 'G85 booking not bound to trusted G73 route'
   USING ERRCODE='P8501'; END IF;
  INSERT INTO public.mobility_stage_g85_auto_dispatch_jobs(
   booking_key,passenger_id,trip_id)
  VALUES(NEW.booking_key,NEW.passenger_id,NEW.trip_id);
 ELSIF NEW.booking_key IS DISTINCT FROM OLD.booking_key
 OR NEW.trip_id IS DISTINCT FROM OLD.trip_id
 THEN RAISE EXCEPTION 'G85 unexpected booking mutation' USING ERRCODE='P8501'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER mobility_stage_g85_verified_book_enqueue
 AFTER UPDATE OF booking_key,trip_id
 ON public.mobility_stage_g72_auto_prequotes
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g85_enqueue_on_book();

CREATE FUNCTION public.mobility_stage_g85_run_one_dispatch_qa()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 job public.mobility_stage_g85_auto_dispatch_jobs%ROWTYPE;
 trip_state public.mobility_stage_trip_status;
 existing_offer uuid;
 created_offer uuid;
 result_status text;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G85 no remote worker' USING ERRCODE='P8501'; END IF;
 -- Only one worker can claim a job. Keep the lock through G82, including
 -- its offer/outbox INSERT; any error rolls all of it back atomically.
 SELECT * INTO job FROM public.mobility_stage_g85_auto_dispatch_jobs
 WHERE status IN ('PENDING','WAITING')
 AND next_attempt_at<=pg_catalog.clock_timestamp()
 ORDER BY next_attempt_at,created_at,booking_key LIMIT 1
 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN
  RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
   'commercialEnabled',false,'status','IDLE'); END IF;
 SELECT status INTO trip_state FROM public.mobility_stage_auto_demo_trips
 WHERE id=job.trip_id AND passenger_id=job.passenger_id
 AND request_key=job.booking_key FOR UPDATE;
 IF NOT FOUND OR trip_state<>'searching' THEN
  UPDATE public.mobility_stage_g85_auto_dispatch_jobs
   SET status='CLOSED',updated_at=pg_catalog.clock_timestamp()
  WHERE booking_key=job.booking_key;
  RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
   'commercialEnabled',false,'status','CLOSED','tripId',job.trip_id);
 END IF;
 -- G84 may already have committed an offer with a DIFFERENT deterministic
 -- key. Reconcile that one instead of issuing duplicate offers.
 SELECT o.id INTO existing_offer
 FROM public.mobility_stage_auto_demo_offers o
 WHERE o.trip_id=job.trip_id
 AND o.status='offered' AND o.expires_at>pg_catalog.clock_timestamp()
 ORDER BY o.offered_at,o.id LIMIT 1;
 IF FOUND THEN
  created_offer:=existing_offer;
 ELSE
  created_offer:=public.mobility_stage_g82_offer_first_eligible_auto_qa(
   job.passenger_id,job.booking_key,job.offer_key,30);
 END IF;
 IF created_offer IS NULL THEN
  result_status:='WAITING';
  UPDATE public.mobility_stage_g85_auto_dispatch_jobs
   SET status='WAITING',attempts=attempts+1,
    next_attempt_at=pg_catalog.clock_timestamp()+interval '30 seconds',
    updated_at=pg_catalog.clock_timestamp()
   WHERE booking_key=job.booking_key;
 ELSE
  result_status:='OFFERED';
  UPDATE public.mobility_stage_g85_auto_dispatch_jobs
   SET status='OFFERED',offer_id=created_offer,
    attempts=attempts+1,updated_at=pg_catalog.clock_timestamp()
   WHERE booking_key=job.booking_key;
 END IF;
 RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
  'commercialEnabled',false,'status',result_status,'tripId',job.trip_id,
  'offerId',created_offer);
END $fn$;

REVOKE ALL ON FUNCTION public.mobility_stage_g85_enqueue_on_book()
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g85_run_one_dispatch_qa()
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g85_run_one_dispatch_qa()
 TO service_role;
COMMIT;
