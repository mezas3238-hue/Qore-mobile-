-- QORE G10: private AUTO/MOTO courier offers and atomic delivery assignment.
-- POSTGRESQL 16 DISPOSABLE CI ONLY. NEVER deploy remotely or enable LIVE.
-- Requires G4 offer state and G5 delivery custody.
BEGIN;

CREATE TABLE public.mobility_stage_delivery_offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 delivery_id uuid NOT NULL
  REFERENCES public.mobility_stage_deliveries(id) ON DELETE RESTRICT,
 courier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 vehicle_id uuid NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 status public.mobility_stage_offer_state NOT NULL DEFAULT 'offered',
 ttl_seconds integer NOT NULL CHECK(ttl_seconds BETWEEN 5 AND 45),
 offered_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 expires_at timestamptz NOT NULL,
 decision_key uuid UNIQUE,
 decision_event_id uuid
  REFERENCES public.mobility_stage_delivery_events(id) ON DELETE RESTRICT,
 UNIQUE(delivery_id,courier_id),
 CHECK(expires_at>offered_at),
 CHECK(
  (status IN ('offered','withdrawn') AND decision_key IS NULL AND decision_event_id IS NULL)
  OR (status='declined' AND decision_key IS NOT NULL AND decision_event_id IS NULL)
  OR (status='accepted' AND decision_key IS NOT NULL AND decision_event_id IS NOT NULL)
 )
);

-- This is a durable wake-up queue, not proof that a device received push.
CREATE TABLE public.mobility_stage_delivery_offer_outbox (
 offer_id uuid PRIMARY KEY
  REFERENCES public.mobility_stage_delivery_offers(id) ON DELETE RESTRICT,
 courier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 accepted_for_processing_at timestamptz,
 receipt_confirmed_at timestamptz
);

ALTER TABLE public.mobility_stage_delivery_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_delivery_offer_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_delivery_offers
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_delivery_offer_outbox
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_delivery_offers TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_delivery_offer_outbox TO service_role;

CREATE FUNCTION public.mobility_stage_delivery_offer(
 _delivery_id uuid,_courier_id uuid,_vehicle_id uuid,
 _request_key uuid,_ttl_seconds integer
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE d public.mobility_stage_deliveries%ROWTYPE;
 old public.mobility_stage_delivery_offers%ROWTYPE; out_id uuid;
BEGIN
 IF _delivery_id IS NULL OR _courier_id IS NULL OR _vehicle_id IS NULL
 OR _request_key IS NULL OR _ttl_seconds NOT BETWEEN 5 AND 45
 THEN RAISE EXCEPTION 'Invalid private delivery offer'; END IF;
 SELECT * INTO d FROM public.mobility_stage_deliveries
  WHERE id=_delivery_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Delivery not found'; END IF;
 SELECT * INTO old FROM public.mobility_stage_delivery_offers
  WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.delivery_id<>_delivery_id OR old.courier_id<>_courier_id
   OR old.vehicle_id<>_vehicle_id OR old.ttl_seconds<>_ttl_seconds
  THEN RAISE EXCEPTION 'Conflicting delivery offer request key'; END IF;
  RETURN old.id;
 END IF;
 IF d.status<>'requested' OR d.sender_id=_courier_id
 OR NOT public.mobility_stage_delivery_courier_preflight(
   _courier_id,_vehicle_id,_delivery_id)
 THEN RAISE EXCEPTION 'Delivery or courier not eligible'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_delivery_offers
     WHERE delivery_id=_delivery_id)>=5
 THEN RAISE EXCEPTION 'Delivery offer fanout limit reached'; END IF;
 INSERT INTO public.mobility_stage_delivery_offers
  (request_key,delivery_id,courier_id,vehicle_id,ttl_seconds,expires_at)
 VALUES(_request_key,_delivery_id,_courier_id,_vehicle_id,_ttl_seconds,
  statement_timestamp()+pg_catalog.make_interval(secs=>_ttl_seconds))
 RETURNING id INTO out_id;
 INSERT INTO public.mobility_stage_delivery_offer_outbox(offer_id,courier_id)
 VALUES(out_id,_courier_id);
 RETURN out_id;
END
$body$;

CREATE FUNCTION public.mobility_stage_delivery_decline_offer(
 _offer_id uuid,_courier_id uuid,_decision_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE offered public.mobility_stage_delivery_offers%ROWTYPE;
 d public.mobility_stage_deliveries%ROWTYPE;
BEGIN
 IF _offer_id IS NULL OR _courier_id IS NULL OR _decision_key IS NULL
 THEN RAISE EXCEPTION 'Invalid delivery offer refusal'; END IF;
 SELECT * INTO offered FROM public.mobility_stage_delivery_offers WHERE id=_offer_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Private delivery offer not found'; END IF;
 SELECT * INTO d FROM public.mobility_stage_deliveries
  WHERE id=offered.delivery_id FOR UPDATE;
 SELECT * INTO offered FROM public.mobility_stage_delivery_offers
  WHERE id=_offer_id FOR UPDATE;
 IF offered.courier_id<>_courier_id
 THEN RAISE EXCEPTION 'Delivery offer belongs to another courier'; END IF;
 IF offered.status='declined' AND offered.decision_key=_decision_key
 THEN RETURN offered.id; END IF;
 IF offered.status<>'offered' OR d.status<>'requested'
 OR offered.expires_at<=statement_timestamp()
 THEN RAISE EXCEPTION 'Delivery offer no longer eligible'; END IF;
 UPDATE public.mobility_stage_delivery_offers SET status='declined',
  decision_key=_decision_key WHERE id=_offer_id;
 RETURN offered.id;
END
$body$;

CREATE FUNCTION public.mobility_stage_delivery_accept_offer(
 _offer_id uuid,_courier_id uuid,_decision_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE offered public.mobility_stage_delivery_offers%ROWTYPE;
 d public.mobility_stage_deliveries%ROWTYPE; event_id uuid; ver bigint;
BEGIN
 IF _offer_id IS NULL OR _courier_id IS NULL OR _decision_key IS NULL
 THEN RAISE EXCEPTION 'Invalid private delivery acceptance'; END IF;
 SELECT * INTO offered FROM public.mobility_stage_delivery_offers WHERE id=_offer_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Private delivery offer not found'; END IF;
 -- Every competing courier locks the same delivery before its own offer.
 SELECT * INTO d FROM public.mobility_stage_deliveries
  WHERE id=offered.delivery_id FOR UPDATE;
 SELECT * INTO offered FROM public.mobility_stage_delivery_offers
  WHERE id=_offer_id FOR UPDATE;
 IF offered.courier_id<>_courier_id
 THEN RAISE EXCEPTION 'Courier cannot accept another offer'; END IF;
 IF offered.decision_key IS NOT NULL AND offered.decision_key<>_decision_key
 THEN RAISE EXCEPTION 'Conflicting delivery decision key'; END IF;
 IF offered.status='accepted' AND offered.decision_key=_decision_key
 THEN RETURN offered.decision_event_id; END IF;
 IF offered.status<>'offered' OR d.status<>'requested'
 OR d.sender_id=_courier_id OR offered.expires_at<=statement_timestamp()
 OR NOT public.mobility_stage_delivery_courier_preflight(
   _courier_id,offered.vehicle_id,d.id)
 THEN RAISE EXCEPTION 'Delivery offer expired, withdrawn or ineligible'; END IF;
 UPDATE public.mobility_stage_deliveries
 SET courier_id=_courier_id,vehicle_id=offered.vehicle_id,status='accepted',
  revision=revision+1,changed_at=statement_timestamp()
 WHERE id=d.id AND status='requested' RETURNING revision INTO ver;
 IF ver IS NULL THEN RAISE EXCEPTION 'Delivery assigned elsewhere'; END IF;
 INSERT INTO public.mobility_stage_delivery_events
  (request_key,delivery_id,actor_id,action,next_status,delivery_revision)
 VALUES(_decision_key,d.id,_courier_id,'accept','accepted',ver)
 RETURNING id INTO event_id;
 UPDATE public.mobility_stage_delivery_offers
 SET status='accepted',decision_key=_decision_key,decision_event_id=event_id
 WHERE id=_offer_id;
 UPDATE public.mobility_stage_delivery_offers SET status='withdrawn'
 WHERE delivery_id=d.id AND id<>_offer_id AND status='offered';
 RETURN event_id;
END
$body$;

REVOKE ALL ON FUNCTION public.mobility_stage_delivery_offer(uuid,uuid,uuid,uuid,integer)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_delivery_decline_offer(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_delivery_accept_offer(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_offer(uuid,uuid,uuid,uuid,integer)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_decline_offer(uuid,uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_accept_offer(uuid,uuid,uuid)
 TO service_role;

-- After G10 a courier must possess a server-created private offer. The G5
-- direct-by-delivery-ID shortcut remains available only in pre-G10 fixtures.
REVOKE EXECUTE ON FUNCTION public.mobility_stage_delivery_accept(uuid,uuid,uuid,uuid)
 FROM service_role;
COMMIT;
