-- QORE G246 external STAGING only: five service-only AUTO lifecycle RPCs.
-- Source: existing G3/G4 disposable PostgreSQL contracts, bodies reviewed and
-- PORTED onto already-installed persistent schema; no original CI_ONLY DDL used.
-- No direct acceptance shortcut; only the one-winner private offer fence.
-- No LIVE, no public trip sales, no PSP or fake KYC.
BEGIN;
DO $guard$
BEGIN
 IF to_regclass('public.mobility_stage_auto_demo_trips') IS NULL
 OR to_regclass('public.mobility_stage_auto_demo_events') IS NULL
 OR to_regclass('public.mobility_stage_auto_demo_offers') IS NULL
 OR to_regclass('public.mobility_stage_auto_demo_push_outbox') IS NULL
 OR to_regprocedure('public.mobility_vehicle_preflight(uuid,uuid,public.mobility_service_kind)') IS NULL
 OR EXISTS(
   SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN
    ('mobility_stage_auto_demo_request','mobility_stage_auto_demo_transition',
     'mobility_stage_auto_demo_offer','mobility_stage_auto_demo_decline_offer',
     'mobility_stage_auto_demo_accept_offer')
 )
 THEN RAISE EXCEPTION 'G246 AUTO private RPC prerequisites mismatch or already installed'; END IF;
END $guard$;

CREATE FUNCTION public.mobility_stage_auto_demo_request(
 _passenger_id uuid,_request_key uuid,_origin_tag text,_destination_tag text,
 _service public.mobility_service_kind
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE old public.mobility_stage_auto_demo_trips%ROWTYPE; new_id uuid;
BEGIN
 IF _passenger_id IS NULL OR _request_key IS NULL OR _service IS NULL
 OR _service NOT IN ('economico','confort','xl')
 OR _origin_tag IS NULL OR _destination_tag IS NULL
 OR _origin_tag !~ '^[A-Z_]{3,40}$' OR _destination_tag !~ '^[A-Z_]{3,40}$'
 OR _origin_tag=_destination_tag
 THEN RAISE EXCEPTION 'Invalid fake AUTO route or actor'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_passenger_id
    AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'Verified passenger account required'; END IF;

 INSERT INTO public.mobility_stage_auto_demo_trips
  (request_key,passenger_id,service,origin_tag,destination_tag)
 VALUES(_request_key,_passenger_id,_service,_origin_tag,_destination_tag)
 ON CONFLICT (request_key) DO NOTHING RETURNING id INTO new_id;
 IF new_id IS NOT NULL THEN RETURN new_id; END IF;
 SELECT * INTO old FROM public.mobility_stage_auto_demo_trips WHERE request_key=_request_key;
 IF NOT FOUND OR old.passenger_id<>_passenger_id OR old.service<>_service
  OR old.origin_tag<>_origin_tag OR old.destination_tag<>_destination_tag
 THEN RAISE EXCEPTION 'Conflicting demo request idempotency key'; END IF;
 RETURN old.id;
END
$body$;

CREATE FUNCTION public.mobility_stage_auto_demo_transition(
 _trip_id uuid,_actor_id uuid,_next public.mobility_stage_trip_status,
 _request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE trip public.mobility_stage_auto_demo_trips%ROWTYPE;
 previous public.mobility_stage_auto_demo_events%ROWTYPE;
 event_id uuid; ver bigint;
BEGIN
 IF _trip_id IS NULL OR _actor_id IS NULL OR _request_key IS NULL OR _next IS NULL
 THEN RAISE EXCEPTION 'Missing fake transition input'; END IF;
 SELECT * INTO trip FROM public.mobility_stage_auto_demo_trips WHERE id=_trip_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Demo trip not found'; END IF;
 SELECT * INTO previous FROM public.mobility_stage_auto_demo_events WHERE request_key=_request_key;
 IF FOUND THEN
  IF previous.trip_id<>_trip_id OR previous.actor_id<>_actor_id OR previous.next_status<>_next
  THEN RAISE EXCEPTION 'Conflicting fake transition replay'; END IF;
  RETURN previous.id;
 END IF;
 IF NOT (
  (_actor_id=trip.passenger_id AND _next='cancelled'
      AND trip.status IN ('searching','accepted','arriving'))
  OR (_actor_id=trip.driver_id AND
      ((_next='arriving' AND trip.status='accepted')
        OR (_next='in_progress' AND trip.status='arriving')
        OR (_next='completed' AND trip.status='in_progress')))
 ) THEN RAISE EXCEPTION 'Actor or demo trip state is not authorized'; END IF;
 UPDATE public.mobility_stage_auto_demo_trips
  SET status=_next,revision=revision+1,changed_at=now()
  WHERE id=_trip_id RETURNING revision INTO ver;
 INSERT INTO public.mobility_stage_auto_demo_events
 (request_key,trip_id,actor_id,next_status,trip_revision)
 VALUES(_request_key,_trip_id,_actor_id,_next,ver) RETURNING id INTO event_id;
 RETURN event_id;
END
$body$;

CREATE FUNCTION public.mobility_stage_auto_demo_offer(
 _trip_id uuid,_driver_id uuid,_vehicle_id uuid,
 _request_key uuid,_ttl_seconds integer
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE
 trip public.mobility_stage_auto_demo_trips%ROWTYPE;
 old public.mobility_stage_auto_demo_offers%ROWTYPE;
 out_id uuid;
BEGIN
 IF _trip_id IS NULL OR _driver_id IS NULL OR _vehicle_id IS NULL
 OR _request_key IS NULL OR _ttl_seconds IS NULL
 OR _ttl_seconds NOT BETWEEN 5 AND 30
 THEN RAISE EXCEPTION 'Invalid private offer parameters'; END IF;
 SELECT * INTO trip FROM public.mobility_stage_auto_demo_trips
 WHERE id=_trip_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No synthetic trip found'; END IF;
 SELECT * INTO old FROM public.mobility_stage_auto_demo_offers
 WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.trip_id<>_trip_id OR old.driver_id<>_driver_id OR
   old.vehicle_id<>_vehicle_id OR old.ttl_seconds<>_ttl_seconds
  THEN RAISE EXCEPTION 'Conflicting offer request key'; END IF;
  -- Do not renew or resurrect an old private offer by retry.
  RETURN old.id;
 END IF;
 IF trip.status<>'searching' OR trip.passenger_id=_driver_id
 THEN RAISE EXCEPTION 'Synthetic trip not searching or self-assignment'; END IF;
 IF NOT public.mobility_vehicle_preflight(_driver_id,_vehicle_id,trip.service)
 THEN RAISE EXCEPTION 'Driver not eligible for private AUTO offer'; END IF;
 -- Limit total fanout across time, including declined or expired candidates.
 IF (SELECT count(*) FROM public.mobility_stage_auto_demo_offers WHERE trip_id=_trip_id)>=5
 THEN RAISE EXCEPTION 'Offer fanout limit reached'; END IF;
 INSERT INTO public.mobility_stage_auto_demo_offers
  (request_key,trip_id,driver_id,vehicle_id,ttl_seconds,expires_at)
 VALUES(_request_key,_trip_id,_driver_id,_vehicle_id,_ttl_seconds,
  statement_timestamp()+pg_catalog.make_interval(secs=>_ttl_seconds))
 RETURNING id INTO out_id;
 INSERT INTO public.mobility_stage_auto_demo_push_outbox(offer_id,driver_id)
 VALUES(out_id,_driver_id);
 RETURN out_id;
END
$body$;

CREATE FUNCTION public.mobility_stage_auto_demo_decline_offer(
 _offer_id uuid,_driver_id uuid,_decision_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE
 offered public.mobility_stage_auto_demo_offers%ROWTYPE;
 trip public.mobility_stage_auto_demo_trips%ROWTYPE;
BEGIN
 IF _offer_id IS NULL OR _driver_id IS NULL OR _decision_key IS NULL
 THEN RAISE EXCEPTION 'Invalid refusal input'; END IF;
 SELECT * INTO offered FROM public.mobility_stage_auto_demo_offers
 WHERE id=_offer_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Private offer not found'; END IF;
 SELECT * INTO trip FROM public.mobility_stage_auto_demo_trips
 WHERE id=offered.trip_id FOR UPDATE;
 SELECT * INTO offered FROM public.mobility_stage_auto_demo_offers
 WHERE id=_offer_id FOR UPDATE;
 IF offered.driver_id<>_driver_id
 THEN RAISE EXCEPTION 'Offer belongs to another driver'; END IF;
 IF offered.status='declined' AND offered.decision_key=_decision_key
 THEN RETURN offered.id; END IF;
 IF offered.status<>'offered' OR trip.status<>'searching'
 OR offered.expires_at<=statement_timestamp()
 THEN RAISE EXCEPTION 'Offer no longer eligible to decline'; END IF;
 UPDATE public.mobility_stage_auto_demo_offers
 SET status='declined',decision_key=_decision_key WHERE id=_offer_id;
 RETURN offered.id;
END
$body$;

CREATE FUNCTION public.mobility_stage_auto_demo_accept_offer(
 _offer_id uuid,_driver_id uuid,_decision_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE
 offered public.mobility_stage_auto_demo_offers%ROWTYPE;
 trip public.mobility_stage_auto_demo_trips%ROWTYPE;
 event_id uuid;
 ver bigint;
BEGIN
 IF _offer_id IS NULL OR _driver_id IS NULL OR _decision_key IS NULL
 THEN RAISE EXCEPTION 'Invalid private acceptance input'; END IF;
 SELECT * INTO offered FROM public.mobility_stage_auto_demo_offers
 WHERE id=_offer_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Private offer not found'; END IF;
 -- Always lock the trip before the offer: both drivers contend for the same
 -- row; no double acceptance, including two distinct offer IDs.
 SELECT * INTO trip FROM public.mobility_stage_auto_demo_trips
 WHERE id=offered.trip_id FOR UPDATE;
 SELECT * INTO offered FROM public.mobility_stage_auto_demo_offers
 WHERE id=_offer_id FOR UPDATE;
 IF offered.driver_id<>_driver_id
 THEN RAISE EXCEPTION 'Driver cannot accept someone else''s offer'; END IF;
 IF offered.decision_key IS NOT NULL AND offered.decision_key<>_decision_key
 THEN RAISE EXCEPTION 'Conflicting acceptance decision key'; END IF;
 IF offered.status='accepted' AND offered.decision_key=_decision_key
 THEN RETURN offered.decision_event_id; END IF;
 IF offered.status<>'offered' OR trip.status<>'searching'
 OR trip.passenger_id=_driver_id
 OR offered.expires_at<=statement_timestamp()
 THEN RAISE EXCEPTION 'Offer expired, withdrawn or trip assigned'; END IF;
 -- Recheck at the moment of acceptance, not just at discovery.
 IF NOT public.mobility_vehicle_preflight(_driver_id,offered.vehicle_id,trip.service)
 THEN RAISE EXCEPTION 'Driver lost eligibility before acceptance'; END IF;

 UPDATE public.mobility_stage_auto_demo_trips
 SET driver_id=_driver_id,vehicle_id=offered.vehicle_id,status='accepted',
  revision=revision+1,changed_at=now()
 WHERE id=trip.id AND status='searching'
 RETURNING revision INTO ver;
 IF ver IS NULL THEN RAISE EXCEPTION 'Concurrent acceptance was won elsewhere'; END IF;
 INSERT INTO public.mobility_stage_auto_demo_events
  (request_key,trip_id,actor_id,next_status,trip_revision)
 VALUES(_decision_key,trip.id,_driver_id,'accepted',ver)
 RETURNING id INTO event_id;
 UPDATE public.mobility_stage_auto_demo_offers
 SET status='accepted',decision_key=_decision_key,decision_event_id=event_id
 WHERE id=_offer_id;
 UPDATE public.mobility_stage_auto_demo_offers
 SET status='withdrawn'
 WHERE trip_id=trip.id AND id<>_offer_id AND status='offered';
 RETURN event_id;
END
$body$;

REVOKE EXECUTE ON FUNCTION public.mobility_stage_auto_demo_request(uuid,uuid,text,text,public.mobility_service_kind) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_auto_demo_request(uuid,uuid,text,text,public.mobility_service_kind) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mobility_stage_auto_demo_transition(uuid,uuid,public.mobility_stage_trip_status,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_auto_demo_transition(uuid,uuid,public.mobility_stage_trip_status,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mobility_stage_auto_demo_offer(uuid,uuid,uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_auto_demo_offer(uuid,uuid,uuid,uuid,integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mobility_stage_auto_demo_decline_offer(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_auto_demo_decline_offer(uuid,uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mobility_stage_auto_demo_accept_offer(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_auto_demo_accept_offer(uuid,uuid,uuid) TO service_role;
-- Previously tested direct-acceptance shortcut is NEVER granted or created.
COMMIT;
