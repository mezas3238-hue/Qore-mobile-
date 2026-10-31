-- G269: private AUTO dispatch continuation for Supabase STAGING PG17 ONLY.
-- Never copy CI_ONLY synthetic G85/G90/G112 SQL to Supabase.
-- No geographic approximation: operator must independently verify road distance
-- using a configured route provider before registering a pickup proof.
-- No ACTIVE Driver without consent, legal preflight, valid vehicle, and RIDE radius.
-- No production, payments, synthetic KYC, fake riders, or automatic public LISTEN.

DO $g$ BEGIN
 IF to_regclass('public.mobility_stage_g262_auto_prequotes') IS NULL
 OR to_regclass('public.mobility_stage_g73_auto_routes') IS NULL
 OR to_regclass('public.mobility_stage_auto_demo_trips') IS NULL
 OR to_regclass('public.mobility_stage_auto_demo_offers') IS NULL
 OR to_regclass('public.mobility_stage_auto_demo_push_outbox') IS NULL
 OR to_regclass('public.mobility_stage_g263_pickup_preferences') IS NULL
 OR to_regclass('public.driver_locations') IS NULL
 OR to_regclass('public.mobility_location_consents') IS NULL
 OR to_regprocedure('public.mobility_stage_auto_demo_offer(uuid,uuid,uuid,uuid,integer)') IS NULL
 OR to_regprocedure('public.mobility_vehicle_preflight(uuid,uuid,public.mobility_service_kind)') IS NULL
 OR to_regnamespace('qore_stage_internal') IS NULL
 THEN RAISE EXCEPTION 'G269 exact STAGING G262/G3/G4/Driver prerequisites unavailable'; END IF;
END $g$;

CREATE TABLE public.mobility_stage_g269_auto_dispatch_jobs (
 booking_key uuid PRIMARY KEY,
 passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 trip_id uuid NOT NULL UNIQUE REFERENCES public.mobility_stage_auto_demo_trips(id) ON DELETE RESTRICT,
 offer_key uuid NOT NULL UNIQUE DEFAULT pg_catalog.gen_random_uuid(),
 status text NOT NULL DEFAULT 'PENDING'
  CHECK (status IN ('PENDING','WAITING','OFFERED','CLOSED','EXHAUSTED')),
 offer_id uuid UNIQUE REFERENCES public.mobility_stage_auto_demo_offers(id) ON DELETE RESTRICT,
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 12),
 next_attempt_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 CHECK ((status='OFFERED')=(offer_id IS NOT NULL))
);
CREATE INDEX mobility_stage_g269_due_auto
 ON public.mobility_stage_g269_auto_dispatch_jobs(next_attempt_at,created_at,booking_key)
 WHERE status IN ('PENDING','WAITING');
ALTER TABLE public.mobility_stage_g269_auto_dispatch_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g269_auto_dispatch_jobs
 FROM PUBLIC,anon,authenticated,service_role;

-- A proof is supplied only by a server whose external routing adapter
-- independently verified road distance. Never accept client-provided meters.
CREATE TABLE public.mobility_stage_g269_pickup_road_proofs (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 trip_id uuid NOT NULL REFERENCES public.mobility_stage_auto_demo_trips(id) ON DELETE RESTRICT,
 booking_key uuid NOT NULL,
 passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 vehicle_id uuid NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 provider text NOT NULL CHECK (provider IN ('GEOAPIFY','GOOGLE_MAPS')),
 pickup_road_meters integer NOT NULL CHECK(pickup_road_meters BETWEEN 1 AND 50000),
 verified_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 UNIQUE(trip_id,driver_id)
);
CREATE INDEX mobility_stage_g269_candidates ON
 public.mobility_stage_g269_pickup_road_proofs(trip_id,pickup_road_meters,id);
ALTER TABLE public.mobility_stage_g269_pickup_road_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g269_pickup_road_proofs
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION qore_stage_internal.mobility_stage_g269_enqueue_auto_booking()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 IF TG_OP<>'UPDATE' OR TG_TABLE_SCHEMA<>'public' OR
 TG_TABLE_NAME<>'mobility_stage_g262_auto_prequotes'
 THEN RAISE EXCEPTION 'G269 unexpected booking trigger' USING ERRCODE='P2691'; END IF;
 IF NEW.trip_id IS NOT NULL AND OLD.trip_id IS NULL THEN
  IF NEW.booking_key IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.mobility_stage_auto_demo_trips t
   JOIN public.mobility_stage_g73_auto_routes r
    ON r.id=NEW.route_id AND r.passenger_id=NEW.passenger_id
   WHERE t.id=NEW.trip_id AND t.passenger_id=NEW.passenger_id
    AND t.request_key=NEW.booking_key AND t.service=r.service
    AND t.origin_tag=r.origin_tag AND t.destination_tag=r.destination_tag)
  THEN RAISE EXCEPTION 'G269 original G262 booking mismatch' USING ERRCODE='P2691'; END IF;
  INSERT INTO public.mobility_stage_g269_auto_dispatch_jobs(
   booking_key,passenger_id,trip_id)
  VALUES(NEW.booking_key,NEW.passenger_id,NEW.trip_id);
 ELSIF NEW.booking_key IS DISTINCT FROM OLD.booking_key
    OR NEW.trip_id IS DISTINCT FROM OLD.trip_id
 THEN RAISE EXCEPTION 'G269 cannot rewrite confirmed booking' USING ERRCODE='P2691'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER mobility_stage_g269_enqueue_verified_book
 AFTER UPDATE OF booking_key,trip_id
 ON public.mobility_stage_g262_auto_prequotes
 FOR EACH ROW EXECUTE FUNCTION qore_stage_internal.mobility_stage_g269_enqueue_auto_booking();

CREATE FUNCTION qore_stage_internal.mobility_stage_g269_register_pickup_road_proof(
 _passenger_id uuid,_booking_key uuid,_trip_id uuid,
 _driver_id uuid,_vehicle_id uuid,_proof_key uuid,
 _provider text,_pickup_road_meters integer,_verified_at timestamptz
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE t public.mobility_stage_auto_demo_trips%ROWTYPE;
 old public.mobility_stage_g269_pickup_road_proofs%ROWTYPE;
 radius integer; proof_id uuid;
BEGIN
 IF _passenger_id IS NULL OR _booking_key IS NULL OR _trip_id IS NULL OR
 _driver_id IS NULL OR _vehicle_id IS NULL OR _proof_key IS NULL OR
 _provider IS NULL OR _provider NOT IN ('GEOAPIFY','GOOGLE_MAPS') OR
 _pickup_road_meters IS NULL OR _pickup_road_meters NOT BETWEEN 1 AND 50000 OR
 _verified_at IS NULL
 THEN RAISE EXCEPTION 'G269 invalid pickup proof' USING ERRCODE='P2692'; END IF;
 -- No replay can refresh the expiry or grant wider radius. An exact proof
 -- is idempotent, and all conflicts fail closed.
 SELECT * INTO old FROM public.mobility_stage_g269_pickup_road_proofs
 WHERE request_key=_proof_key;
 IF FOUND THEN
  IF ROW(old.passenger_id,old.booking_key,old.trip_id,old.driver_id,
       old.vehicle_id,old.provider,old.pickup_road_meters,old.verified_at)
     IS DISTINCT FROM
     ROW(_passenger_id,_booking_key,_trip_id,_driver_id,_vehicle_id,
       _provider,_pickup_road_meters,_verified_at)
  THEN RAISE EXCEPTION 'G269 conflicting pickup proof key' USING ERRCODE='P2692'; END IF;
  RETURN old.id;
 END IF;
 SELECT * INTO t FROM public.mobility_stage_auto_demo_trips
 WHERE id=_trip_id AND passenger_id=_passenger_id AND request_key=_booking_key
 FOR UPDATE;
 IF NOT FOUND OR t.status<>'searching' OR t.passenger_id=_driver_id OR
 NOT EXISTS(SELECT 1 FROM public.mobility_stage_g269_auto_dispatch_jobs j
 WHERE j.booking_key=_booking_key AND j.trip_id=_trip_id
  AND j.passenger_id=_passenger_id AND j.status IN ('PENDING','WAITING'))
 THEN RAISE EXCEPTION 'G269 booking not eligible for pickup proof' USING ERRCODE='P2692'; END IF;
 IF _verified_at>pg_catalog.clock_timestamp()+interval '2 seconds'
 OR _verified_at<pg_catalog.clock_timestamp()-interval '30 seconds'
 THEN RAISE EXCEPTION 'G269 routing result stale or future dated' USING ERRCODE='P2692'; END IF;
 SELECT p.maximum_road_meters INTO radius
 FROM public.mobility_stage_g263_pickup_preferences p
 WHERE p.driver_id=_driver_id AND p.service_kind='RIDE';
 IF radius IS NULL OR radius=0 OR _pickup_road_meters>radius
 THEN RAISE EXCEPTION 'G269 outside Driver voluntary pickup radius' USING ERRCODE='P2692'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.driver_locations l
  JOIN public.mobility_location_consents c ON c.driver_id=l.driver_id
  WHERE l.driver_id=_driver_id AND l.available=true
  AND l.updated_at>pg_catalog.clock_timestamp()-interval '45 seconds'
  AND c.opted_in_at IS NOT NULL AND c.revoked_at IS NULL
 ) OR public.mobility_vehicle_preflight(_driver_id,_vehicle_id,t.service)
 IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'G269 Driver lacks current consent, GPS or legal clearance'
 USING ERRCODE='P2692'; END IF;
 INSERT INTO public.mobility_stage_g269_pickup_road_proofs(
  request_key,trip_id,booking_key,passenger_id,
  driver_id,vehicle_id,provider,pickup_road_meters,verified_at)
 VALUES(_proof_key,_trip_id,_booking_key,_passenger_id,_driver_id,_vehicle_id,
  _provider,_pickup_road_meters,_verified_at)
 RETURNING id INTO proof_id;
 RETURN proof_id;
END $f$;

CREATE FUNCTION qore_stage_internal.mobility_stage_g112_run_booked_auto_dispatch_qa(
 _passenger_id uuid,_booking_key uuid,_trip_id uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE j public.mobility_stage_g269_auto_dispatch_jobs%ROWTYPE;
 trip_row public.mobility_stage_auto_demo_trips%ROWTYPE;
 candidate public.mobility_stage_g269_pickup_road_proofs%ROWTYPE;
 prior public.mobility_stage_auto_demo_offers%ROWTYPE;
 matched_offer_id uuid; fanout integer;
BEGIN
 IF _passenger_id IS NULL OR _booking_key IS NULL OR _trip_id IS NULL
 THEN RAISE EXCEPTION 'G269 owner booking required' USING ERRCODE='P2693'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.mobility_stage_g262_auto_prequotes q
  JOIN public.mobility_stage_g73_auto_routes r
    ON r.id=q.route_id AND r.passenger_id=q.passenger_id
  JOIN public.mobility_stage_auto_demo_trips t
    ON t.id=q.trip_id AND t.passenger_id=q.passenger_id
    AND t.request_key=q.booking_key AND t.service=r.service
    AND t.origin_tag=r.origin_tag AND t.destination_tag=r.destination_tag
  WHERE q.passenger_id=_passenger_id AND q.booking_key=_booking_key
    AND q.trip_id=_trip_id
 ) THEN RAISE EXCEPTION 'G269 cannot dispatch unowned G262 booking' USING ERRCODE='P2693'; END IF;
 SELECT * INTO j FROM public.mobility_stage_g269_auto_dispatch_jobs
 WHERE booking_key=_booking_key AND passenger_id=_passenger_id AND trip_id=_trip_id
 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RAISE EXCEPTION 'G269 dispatch claim absent or busy' USING ERRCODE='P2693'; END IF;
 SELECT * INTO trip_row FROM public.mobility_stage_auto_demo_trips
 WHERE id=j.trip_id AND passenger_id=j.passenger_id AND request_key=j.booking_key
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G269 trip disappeared' USING ERRCODE='P2693'; END IF;
 IF trip_row.status<>'searching' THEN
  UPDATE public.mobility_stage_g269_auto_dispatch_jobs
  SET status='CLOSED',offer_id=NULL,updated_at=pg_catalog.clock_timestamp()
  WHERE booking_key=j.booking_key;
  RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
   'commercialEnabled',false,'status','CLOSED','tripId',j.trip_id);
 END IF;
 IF j.status IN('CLOSED','EXHAUSTED') THEN
  RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
   'commercialEnabled',false,'status',
   CASE WHEN j.status='EXHAUSTED' THEN 'EXHAUSTED' ELSE 'CLOSED' END,
   'tripId',j.trip_id);
 END IF;
 IF j.status='OFFERED' THEN
  SELECT * INTO prior FROM public.mobility_stage_auto_demo_offers
  WHERE id=j.offer_id AND trip_id=j.trip_id;
  IF FOUND AND prior.status='offered' AND prior.expires_at>pg_catalog.clock_timestamp()
  THEN RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
    'commercialEnabled',false,'status','OFFERED','tripId',j.trip_id,'offerId',j.offer_id);
  END IF;
  UPDATE public.mobility_stage_g269_auto_dispatch_jobs
  SET status='WAITING',offer_id=NULL,offer_key=pg_catalog.gen_random_uuid(),
   next_attempt_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp()
  WHERE booking_key=j.booking_key;
 END IF;
 SELECT * INTO j FROM public.mobility_stage_g269_auto_dispatch_jobs
 WHERE booking_key=_booking_key;
 IF j.next_attempt_at>pg_catalog.clock_timestamp() THEN
  RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
   'commercialEnabled',false,'status','IDLE');
 END IF;
 SELECT count(*) INTO fanout FROM public.mobility_stage_auto_demo_offers
 WHERE trip_id=j.trip_id;
 IF j.attempts>=12 OR fanout>=5 THEN
  UPDATE public.mobility_stage_g269_auto_dispatch_jobs
  SET status='EXHAUSTED',updated_at=pg_catalog.clock_timestamp()
  WHERE booking_key=j.booking_key;
  RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
   'commercialEnabled',false,'status','EXHAUSTED','tripId',j.trip_id);
 END IF;
 -- Reconcile an existing legitimate offer/outbox before any new attempt.
 SELECT o.id INTO matched_offer_id FROM public.mobility_stage_auto_demo_offers o
 JOIN public.mobility_stage_auto_demo_push_outbox p
   ON p.offer_id=o.id AND p.driver_id=o.driver_id
 WHERE o.trip_id=j.trip_id AND o.status='offered' AND
  o.expires_at>pg_catalog.clock_timestamp()
 ORDER BY o.offered_at,o.id LIMIT 1;
 IF NOT FOUND THEN
  SELECT p.* INTO candidate FROM public.mobility_stage_g269_pickup_road_proofs p
  JOIN public.mobility_stage_g263_pickup_preferences pref
    ON pref.driver_id=p.driver_id AND pref.service_kind='RIDE'
    AND pref.maximum_road_meters>=p.pickup_road_meters
    AND pref.maximum_road_meters>0
  JOIN public.driver_locations loc ON loc.driver_id=p.driver_id
    AND loc.available=true AND loc.updated_at>pg_catalog.clock_timestamp()-interval '45 seconds'
  JOIN public.mobility_location_consents cons ON cons.driver_id=p.driver_id
    AND cons.opted_in_at IS NOT NULL AND cons.revoked_at IS NULL
  WHERE p.trip_id=j.trip_id AND p.passenger_id=j.passenger_id
   AND p.booking_key=j.booking_key
   AND p.verified_at>pg_catalog.clock_timestamp()-interval '30 seconds'
   AND NOT EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_offers prior_offer
     WHERE prior_offer.trip_id=p.trip_id AND prior_offer.driver_id=p.driver_id)
  ORDER BY p.pickup_road_meters,p.verified_at DESC,p.id LIMIT 1;
  IF FOUND AND public.mobility_vehicle_preflight(
    candidate.driver_id,candidate.vehicle_id,trip_row.service) IS TRUE THEN
    matched_offer_id:=public.mobility_stage_auto_demo_offer(
     j.trip_id,candidate.driver_id,candidate.vehicle_id,j.offer_key,30);
  END IF;
 END IF;
 IF matched_offer_id IS NULL THEN
  UPDATE public.mobility_stage_g269_auto_dispatch_jobs
  SET status='WAITING',attempts=attempts+1,
   next_attempt_at=pg_catalog.clock_timestamp()+interval '30 seconds',
   updated_at=pg_catalog.clock_timestamp()
  WHERE booking_key=j.booking_key;
  RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
   'commercialEnabled',false,'status','WAITING','tripId',j.trip_id,'offerId',NULL);
 END IF;
 UPDATE public.mobility_stage_g269_auto_dispatch_jobs
 SET status='OFFERED',offer_id=matched_offer_id,attempts=attempts+1,
   updated_at=pg_catalog.clock_timestamp()
 WHERE booking_key=j.booking_key;
 RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
  'commercialEnabled',false,'status','OFFERED','tripId',j.trip_id,'offerId',matched_offer_id);
END $f$;

CREATE FUNCTION qore_stage_internal.mobility_stage_g90_passenger_dispatch_status_qa(
 _passenger_id uuid,_booking_key uuid
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,
  'ownerId',q.passenger_id,'bookingKey',q.booking_key,
  'tripId',t.id,'tripState',t.status,
  'dispatchState',CASE
   WHEN t.status<>'searching' THEN 'CLOSED'
   WHEN EXISTS (SELECT 1 FROM public.mobility_stage_auto_demo_offers o
    JOIN public.mobility_stage_auto_demo_push_outbox p
      ON p.offer_id=o.id AND p.driver_id=o.driver_id
    WHERE o.trip_id=t.id AND o.status='offered'
     AND o.expires_at>pg_catalog.clock_timestamp()) THEN 'OFFER_PENDING'
   WHEN j.status='EXHAUSTED' THEN 'SEARCH_EXHAUSTED'
   WHEN j.status IN('WAITING','OFFERED') THEN 'RETRY_PENDING'
   WHEN j.status='PENDING' THEN 'SEARCHING_DRIVER'
   ELSE 'CLOSED' END,
  'attempts',j.attempts,
  'offerPendingAcceptance',t.status='searching' AND EXISTS (
    SELECT 1 FROM public.mobility_stage_auto_demo_offers o
    JOIN public.mobility_stage_auto_demo_push_outbox p
      ON p.offer_id=o.id AND p.driver_id=o.driver_id
    WHERE o.trip_id=t.id AND o.status='offered'
     AND o.expires_at>pg_catalog.clock_timestamp()))
 FROM public.mobility_stage_g262_auto_prequotes q
 JOIN public.mobility_stage_g73_auto_routes r
   ON r.id=q.route_id AND r.passenger_id=q.passenger_id
 JOIN public.mobility_stage_auto_demo_trips t ON t.id=q.trip_id
   AND t.request_key=q.booking_key AND t.passenger_id=q.passenger_id
   AND t.service=r.service AND t.origin_tag=r.origin_tag
   AND t.destination_tag=r.destination_tag
 JOIN public.mobility_stage_g269_auto_dispatch_jobs j
   ON j.passenger_id=q.passenger_id AND j.trip_id=t.id
   AND j.booking_key=q.booking_key
 WHERE q.passenger_id=$1 AND q.booking_key=$2
$f$;

-- SECURITY INVOKER gateway. Public API may call only under service_role.
CREATE FUNCTION public.mobility_stage_g269_register_pickup_road_proof(
 _passenger_id uuid,_booking_key uuid,_trip_id uuid,
 _driver_id uuid,_vehicle_id uuid,_proof_key uuid,
 _provider text,_pickup_road_meters integer,_verified_at timestamptz
) RETURNS uuid LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.mobility_stage_g269_register_pickup_road_proof(
  $1,$2,$3,$4,$5,$6,$7,$8,$9)
$f$;
CREATE FUNCTION public.mobility_stage_g112_run_booked_auto_dispatch_qa(
 _passenger_id uuid,_booking_key uuid,_trip_id uuid
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.mobility_stage_g112_run_booked_auto_dispatch_qa($1,$2,$3)
$f$;
CREATE FUNCTION public.mobility_stage_g90_passenger_dispatch_status_qa(
 _passenger_id uuid,_booking_key uuid
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.mobility_stage_g90_passenger_dispatch_status_qa($1,$2)
$f$;

DO $acl$ DECLARE x text;
BEGIN
 FOR x IN SELECT s FROM (VALUES
  ('mobility_stage_g269_register_pickup_road_proof(uuid,uuid,uuid,uuid,uuid,uuid,text,integer,timestamp with time zone)'),
  ('mobility_stage_g112_run_booked_auto_dispatch_qa(uuid,uuid,uuid)'),
  ('mobility_stage_g90_passenger_dispatch_status_qa(uuid,uuid)')
 ) AS v(s) LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION public.'||x||' FROM PUBLIC,anon,authenticated,service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION qore_stage_internal.'||x||' FROM PUBLIC,anon,authenticated,service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||x||' TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION qore_stage_internal.'||x||' TO service_role';
 END LOOP;
END $acl$;
REVOKE ALL ON FUNCTION qore_stage_internal.mobility_stage_g269_enqueue_auto_booking()
 FROM PUBLIC,anon,authenticated,service_role;
