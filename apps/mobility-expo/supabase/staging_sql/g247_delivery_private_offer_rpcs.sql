-- G247 persistent Supabase STAGING / QORE Mobile: server-only delivery lifecycle.
-- Adapted function BODIES from reviewed G5 + G10 disposable QA contracts.
-- NOT a copy of CI_ONLY schema; no tables/fixtures/accounts created.
-- Existing private offer ACCEPTANCE is the only courier claim path.
BEGIN;
DO $guard$
BEGIN
 IF to_regclass('public.mobility_stage_deliveries') IS NULL
 OR to_regclass('public.mobility_stage_delivery_events') IS NULL
 OR to_regclass('public.mobility_stage_delivery_vehicle_clearance') IS NULL
 OR to_regclass('public.mobility_stage_delivery_offers') IS NULL
 OR to_regclass('public.mobility_stage_delivery_offer_outbox') IS NULL
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('mobility_stage_delivery_courier_preflight','mobility_stage_delivery_request','mobility_stage_delivery_transition','mobility_stage_delivery_offer','mobility_stage_delivery_decline_offer','mobility_stage_delivery_accept_offer'))
 THEN RAISE EXCEPTION 'G247 delivery prerequisites mismatch or duplicate RPC'; END IF;
END $guard$;

CREATE FUNCTION public.mobility_stage_delivery_courier_preflight(
 _courier_id uuid,_vehicle_id uuid,_delivery_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $body$
 SELECT COALESCE(EXISTS(
  SELECT 1
  FROM public.mobility_stage_deliveries d
  JOIN public.mobility_vehicles v ON v.id=_vehicle_id AND v.driver_id=_courier_id
  JOIN public.mobility_stage_delivery_vehicle_clearance c ON c.vehicle_id=v.id
  JOIN public.mobility_driver_compliance dc ON dc.driver_id=v.driver_id
  JOIN public.user_roles ur ON ur.user_id=v.driver_id
    AND ur.role='driver'::public.app_role
  JOIN public.user_roles reviewer ON reviewer.user_id=c.reviewed_by
    AND reviewer.role='admin'::public.app_role
  JOIN public.driver_locations loc ON loc.driver_id=v.driver_id
  JOIN public.mobility_location_consents consent ON consent.driver_id=v.driver_id
  WHERE d.id=_delivery_id AND d.status='requested'
    AND d.sender_id<>_courier_id
    AND v.vehicle_kind=d.requested_vehicle_kind
    AND v.review_status NOT IN ('rejected','suspended')
    AND dc.driver_review_status='approved'
    AND dc.license_valid_through>=CURRENT_DATE
    AND c.delivery_authorized=true
    AND c.cargo_insurance_valid_through>=CURRENT_DATE
    AND c.reviewed_by<>_courier_id
    AND c.cargo_insurance_verified_at<=now() AND c.reviewed_at<=now()
    AND d.grams<=c.max_grams
    AND d.length_cm*d.width_cm*d.height_cm<=c.max_volume_cm3
    AND GREATEST(d.length_cm,d.width_cm,d.height_cm)<=c.max_edge_cm
    AND loc.available=true AND loc.updated_at>=now()-interval '120 seconds'
    AND loc.updated_at<=now()+interval '15 seconds'
    AND consent.revoked_at IS NULL AND consent.opted_in_at<=loc.updated_at
    AND NOT EXISTS(
     SELECT 1 FROM public.mobility_stage_auto_demo_trips trip
     WHERE trip.driver_id=_courier_id
       AND trip.status IN ('accepted','arriving','in_progress')
    )
    AND NOT EXISTS(
     SELECT 1 FROM public.mobility_stage_deliveries busy
     WHERE busy.courier_id=_courier_id AND busy.id<>d.id
       AND busy.status IN ('accepted','picked_up','disputed')
    )
 ),false)
$body$;

CREATE FUNCTION public.mobility_stage_delivery_request(
 _sender_id uuid,_request_key uuid,_vehicle_kind public.mobility_vehicle_kind,
 _category public.mobility_stage_delivery_category,
 _grams integer,_length_cm integer,_width_cm integer,_height_cm integer,
 _pickup_tag text,_delivery_tag text,_restricted_item_declared boolean
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE old public.mobility_stage_deliveries%ROWTYPE; out_id uuid; volume bigint;
BEGIN
 IF _sender_id IS NULL OR _request_key IS NULL OR _vehicle_kind IS NULL
 OR _category IS NULL OR _grams IS NULL OR _length_cm IS NULL OR _width_cm IS NULL
 OR _height_cm IS NULL OR _pickup_tag IS NULL OR _delivery_tag IS NULL
 OR _restricted_item_declared IS DISTINCT FROM false
 OR _grams NOT BETWEEN 1 AND 100000 OR _length_cm NOT BETWEEN 1 AND 200
 OR _width_cm NOT BETWEEN 1 AND 200 OR _height_cm NOT BETWEEN 1 AND 200
 OR _pickup_tag !~ '^[A-Z_]{3,40}$' OR _delivery_tag !~ '^[A-Z_]{3,40}$'
 OR _pickup_tag=_delivery_tag THEN RAISE EXCEPTION 'Invalid delivery request'; END IF;
 volume:=_length_cm::bigint*_width_cm::bigint*_height_cm::bigint;
 IF (_vehicle_kind='MOTO' AND (_grams>10000 OR volume>45000 OR
     GREATEST(_length_cm,_width_cm,_height_cm)>60))
 OR (_vehicle_kind='AUTO' AND volume>1000000)
 THEN RAISE EXCEPTION 'Requested vehicle capacity exceeded'; END IF;
 SELECT * INTO old FROM public.mobility_stage_deliveries WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.sender_id<>_sender_id OR old.requested_vehicle_kind<>_vehicle_kind
   OR old.category<>_category OR old.grams<>_grams OR old.length_cm<>_length_cm
   OR old.width_cm<>_width_cm OR old.height_cm<>_height_cm
   OR old.pickup_tag<>_pickup_tag OR old.delivery_tag<>_delivery_tag
  THEN RAISE EXCEPTION 'Conflicting delivery request key'; END IF;
  RETURN old.id;
 END IF;
 INSERT INTO public.mobility_stage_deliveries
  (request_key,sender_id,requested_vehicle_kind,category,grams,length_cm,
   width_cm,height_cm,pickup_tag,delivery_tag,restricted_item_declared)
 VALUES(_request_key,_sender_id,_vehicle_kind,_category,_grams,_length_cm,
   _width_cm,_height_cm,_pickup_tag,_delivery_tag,false)
 RETURNING id INTO out_id;
 RETURN out_id;
END
$body$;

CREATE FUNCTION public.mobility_stage_delivery_transition(
 _delivery_id uuid,_actor_id uuid,_action text,_request_key uuid,_proof_ref uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE d public.mobility_stage_deliveries%ROWTYPE;
 old public.mobility_stage_delivery_events%ROWTYPE;
 target public.mobility_stage_delivery_status; event_id uuid; ver bigint;
BEGIN
 IF _delivery_id IS NULL OR _actor_id IS NULL OR _request_key IS NULL
 OR _action IS NULL OR _action NOT IN ('pickup','deliver','dispute','return','cancel')
 THEN RAISE EXCEPTION 'Invalid delivery transition'; END IF;
 SELECT * INTO d FROM public.mobility_stage_deliveries WHERE id=_delivery_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Delivery not found'; END IF;
 SELECT * INTO old FROM public.mobility_stage_delivery_events WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.delivery_id<>_delivery_id OR old.actor_id<>_actor_id
   OR old.action<>_action OR old.proof_ref IS DISTINCT FROM _proof_ref
  THEN RAISE EXCEPTION 'Conflicting delivery transition replay'; END IF;
  RETURN old.id;
 END IF;
 target:=CASE
  WHEN _actor_id=d.courier_id AND _action='pickup' AND d.status='accepted' THEN 'picked_up'
  WHEN _actor_id=d.courier_id AND _action='deliver' AND d.status='picked_up'
   AND _proof_ref IS NOT NULL THEN 'delivered'
  WHEN _actor_id=d.sender_id AND _action='dispute' AND d.status='delivered' THEN 'disputed'
  WHEN _actor_id=d.courier_id AND _action='return' AND d.status='disputed' THEN 'returned'
  WHEN _actor_id=d.sender_id AND _action='cancel'
   AND d.status IN ('requested','accepted') THEN 'cancelled'
  ELSE NULL END;
 IF target IS NULL OR (_action<>'deliver' AND _proof_ref IS NOT NULL)
 THEN RAISE EXCEPTION 'Actor or delivery state not authorized'; END IF;
 UPDATE public.mobility_stage_deliveries SET status=target,
  proof_ref=CASE WHEN _action='deliver' THEN _proof_ref ELSE proof_ref END,
  revision=revision+1,changed_at=now()
 WHERE id=_delivery_id RETURNING revision INTO ver;
 INSERT INTO public.mobility_stage_delivery_events
  (request_key,delivery_id,actor_id,action,next_status,delivery_revision,proof_ref)
 VALUES(_request_key,_delivery_id,_actor_id,_action,target,ver,_proof_ref)
 RETURNING id INTO event_id;
 RETURN event_id;
END
$body$;

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

REVOKE EXECUTE ON FUNCTION public.mobility_stage_delivery_courier_preflight(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_courier_preflight(uuid,uuid,uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.mobility_stage_delivery_request(uuid,uuid,public.mobility_vehicle_kind,public.mobility_stage_delivery_category,integer,integer,integer,integer,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_request(uuid,uuid,public.mobility_vehicle_kind,public.mobility_stage_delivery_category,integer,integer,integer,integer,text,text,boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION public.mobility_stage_delivery_transition(uuid,uuid,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_transition(uuid,uuid,text,uuid,uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.mobility_stage_delivery_offer(uuid,uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_offer(uuid,uuid,uuid,uuid,integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.mobility_stage_delivery_decline_offer(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_decline_offer(uuid,uuid,uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.mobility_stage_delivery_accept_offer(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_accept_offer(uuid,uuid,uuid) TO service_role;
-- Do not publish the bypass: direct delivery_accept is deliberately ABSENT.
COMMIT;
