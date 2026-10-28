-- QORE Radar G4: private AUTO-only offer / acceptance contract.
-- POSTGRES 16 DISPOSABLE CI ONLY. NEVER deploy this file in remote Supabase.
-- Requires G3 synthetic trips, G2 verified AUTO preflight. NO LIVE / NO money.
BEGIN;
CREATE TYPE public.mobility_stage_offer_state AS ENUM
 ('offered','declined','accepted','withdrawn');
CREATE TABLE public.mobility_stage_auto_demo_offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 trip_id uuid NOT NULL
   REFERENCES public.mobility_stage_auto_demo_trips(id) ON DELETE RESTRICT,
 driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 vehicle_id uuid NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 status public.mobility_stage_offer_state NOT NULL DEFAULT 'offered',
 ttl_seconds integer NOT NULL CHECK(ttl_seconds BETWEEN 5 AND 30),
 offered_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 decision_key uuid UNIQUE,
 decision_event_id uuid
   REFERENCES public.mobility_stage_auto_demo_events(id) ON DELETE RESTRICT,
 UNIQUE(trip_id,driver_id),
 CHECK(expires_at>offered_at),
 CHECK (
 (status IN ('offered','withdrawn') AND decision_key IS NULL AND decision_event_id IS NULL)
 OR (status='declined' AND decision_key IS NOT NULL AND decision_event_id IS NULL)
 OR (status='accepted' AND decision_key IS NOT NULL AND decision_event_id IS NOT NULL)
 )
);
ALTER TABLE public.mobility_stage_auto_demo_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_auto_demo_offers FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_auto_demo_offers TO service_role;

-- A queue record does NOT promise push delivery. Only a server worker may
-- obtain a ticket, poll receipts, and mark a token invalid when applicable.
CREATE TABLE public.mobility_stage_auto_demo_push_outbox (
 offer_id uuid PRIMARY KEY
   REFERENCES public.mobility_stage_auto_demo_offers(id) ON DELETE RESTRICT,
 driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 accepted_for_processing_at timestamptz,
 receipt_confirmed_at timestamptz
);
ALTER TABLE public.mobility_stage_auto_demo_push_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_auto_demo_push_outbox
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_auto_demo_push_outbox TO service_role;
-- Service privileges are internal only; never give clients table/EXECUTE access.

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

REVOKE ALL ON FUNCTION public.mobility_stage_auto_demo_offer(uuid,uuid,uuid,uuid,integer)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_auto_demo_decline_offer(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_auto_demo_accept_offer(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_auto_demo_offer(uuid,uuid,uuid,uuid,integer)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_auto_demo_decline_offer(uuid,uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_auto_demo_accept_offer(uuid,uuid,uuid)
 TO service_role;

-- Critical G4 upgrade: remove the previous direct service_role accept shortcut.
-- This does not affect G3 legacy tests, which run BEFORE installing G4 in CI.
REVOKE EXECUTE ON FUNCTION public.mobility_stage_auto_demo_accept(uuid,uuid,uuid,uuid)
 FROM service_role;
COMMIT;
