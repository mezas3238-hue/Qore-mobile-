-- QORE G5: delivery custody and courier assignment.
-- POSTGRESQL 16 DISPOSABLE CI ONLY. NEVER deploy remotely or enable LIVE.
-- Requires G1/G2 identity, vehicle and compliance schemas.
BEGIN;

CREATE TYPE public.mobility_stage_delivery_status AS ENUM
 ('requested','accepted','picked_up','delivered','disputed','returned','cancelled');
CREATE TYPE public.mobility_stage_delivery_category AS ENUM
 ('DOCUMENTS','PARCEL','GROCERIES','PHARMACY_OTC','RESTAURANT');

-- Cargo approval is independent from passenger-transport approval. This lets
-- a MOTO remain blocked for passengers while being separately reviewed for
-- packages. Every value is server-reviewed; clients have no write grants.
CREATE TABLE public.mobility_stage_delivery_vehicle_clearance (
 vehicle_id uuid PRIMARY KEY REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 delivery_authorized boolean NOT NULL DEFAULT false,
 cargo_insurance_valid_through date NOT NULL,
 cargo_insurance_verified_at timestamptz NOT NULL,
 max_grams integer NOT NULL CHECK(max_grams BETWEEN 1 AND 100000),
 max_volume_cm3 integer NOT NULL CHECK(max_volume_cm3 BETWEEN 1 AND 1000000),
 max_edge_cm integer NOT NULL CHECK(max_edge_cm BETWEEN 1 AND 200),
 reviewed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 reviewed_at timestamptz NOT NULL,
 CHECK(cargo_insurance_verified_at<=reviewed_at)
);

CREATE TABLE public.mobility_stage_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 courier_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 vehicle_id uuid REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 requested_vehicle_kind public.mobility_vehicle_kind NOT NULL,
 category public.mobility_stage_delivery_category NOT NULL,
 grams integer NOT NULL CHECK(grams BETWEEN 1 AND 100000),
 length_cm integer NOT NULL CHECK(length_cm BETWEEN 1 AND 200),
 width_cm integer NOT NULL CHECK(width_cm BETWEEN 1 AND 200),
 height_cm integer NOT NULL CHECK(height_cm BETWEEN 1 AND 200),
 pickup_tag text NOT NULL CHECK(pickup_tag ~ '^[A-Z_]{3,40}$'),
 delivery_tag text NOT NULL CHECK(delivery_tag ~ '^[A-Z_]{3,40}$'),
 restricted_item_declared boolean NOT NULL DEFAULT false,
 status public.mobility_stage_delivery_status NOT NULL DEFAULT 'requested',
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 proof_ref uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 changed_at timestamptz NOT NULL DEFAULT now(),
 CHECK(pickup_tag<>delivery_tag),
 CHECK(restricted_item_declared=false),
 CHECK(
  (status='requested' AND courier_id IS NULL AND vehicle_id IS NULL AND proof_ref IS NULL)
  OR (status IN ('accepted','picked_up') AND courier_id IS NOT NULL
      AND vehicle_id IS NOT NULL AND proof_ref IS NULL)
  OR (status='cancelled' AND proof_ref IS NULL
      AND ((courier_id IS NULL AND vehicle_id IS NULL)
       OR (courier_id IS NOT NULL AND vehicle_id IS NOT NULL)))
  OR (status IN ('delivered','disputed','returned') AND courier_id IS NOT NULL
      AND vehicle_id IS NOT NULL AND proof_ref IS NOT NULL)
 )
);
CREATE UNIQUE INDEX mobility_stage_one_active_delivery_sender
 ON public.mobility_stage_deliveries(sender_id)
 WHERE status IN ('requested','accepted','picked_up','disputed');
CREATE UNIQUE INDEX mobility_stage_one_active_delivery_courier
 ON public.mobility_stage_deliveries(courier_id)
 WHERE courier_id IS NOT NULL AND status IN ('accepted','picked_up','disputed');

CREATE TABLE public.mobility_stage_delivery_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 delivery_id uuid NOT NULL REFERENCES public.mobility_stage_deliveries(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK(action IN ('accept','pickup','deliver','dispute','return','cancel')),
 next_status public.mobility_stage_delivery_status NOT NULL,
 delivery_revision bigint NOT NULL CHECK(delivery_revision>1),
 proof_ref uuid,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(delivery_id,delivery_revision)
);

ALTER TABLE public.mobility_stage_delivery_vehicle_clearance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_delivery_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_delivery_vehicle_clearance
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_deliveries
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_delivery_events
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_delivery_vehicle_clearance TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_deliveries TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_delivery_events TO service_role;
GRANT SELECT ON public.mobility_stage_deliveries TO authenticated;
CREATE POLICY mobility_stage_delivery_participant_read
 ON public.mobility_stage_deliveries FOR SELECT TO authenticated
 USING(sender_id=auth.uid() OR courier_id=auth.uid());

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
    AND pg_catalog.greatest(d.length_cm,d.width_cm,d.height_cm)<=c.max_edge_cm
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
     pg_catalog.greatest(_length_cm,_width_cm,_height_cm)>60))
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

CREATE FUNCTION public.mobility_stage_delivery_accept(
 _delivery_id uuid,_courier_id uuid,_vehicle_id uuid,_request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE d public.mobility_stage_deliveries%ROWTYPE;
 old public.mobility_stage_delivery_events%ROWTYPE; event_id uuid; ver bigint;
BEGIN
 IF _delivery_id IS NULL OR _courier_id IS NULL OR _vehicle_id IS NULL
 OR _request_key IS NULL THEN RAISE EXCEPTION 'Invalid delivery acceptance'; END IF;
 SELECT * INTO d FROM public.mobility_stage_deliveries WHERE id=_delivery_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Delivery not found'; END IF;
 SELECT * INTO old FROM public.mobility_stage_delivery_events WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.delivery_id<>_delivery_id OR old.actor_id<>_courier_id OR old.action<>'accept'
  THEN RAISE EXCEPTION 'Conflicting delivery acceptance replay'; END IF;
  RETURN old.id;
 END IF;
 IF NOT public.mobility_stage_delivery_courier_preflight(
   _courier_id,_vehicle_id,_delivery_id)
 THEN RAISE EXCEPTION 'Courier or vehicle not eligible'; END IF;
 UPDATE public.mobility_stage_deliveries
 SET courier_id=_courier_id,vehicle_id=_vehicle_id,status='accepted',
  revision=revision+1,changed_at=now()
 WHERE id=_delivery_id AND status='requested' RETURNING revision INTO ver;
 IF ver IS NULL THEN RAISE EXCEPTION 'Delivery assigned elsewhere'; END IF;
 INSERT INTO public.mobility_stage_delivery_events
  (request_key,delivery_id,actor_id,action,next_status,delivery_revision)
 VALUES(_request_key,_delivery_id,_courier_id,'accept','accepted',ver)
 RETURNING id INTO event_id;
 RETURN event_id;
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

REVOKE ALL ON FUNCTION public.mobility_stage_delivery_courier_preflight(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_delivery_request(uuid,uuid,public.mobility_vehicle_kind,public.mobility_stage_delivery_category,integer,integer,integer,integer,text,text,boolean)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_delivery_accept(uuid,uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_delivery_transition(uuid,uuid,text,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_courier_preflight(uuid,uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_request(uuid,uuid,public.mobility_vehicle_kind,public.mobility_stage_delivery_category,integer,integer,integer,integer,text,text,boolean)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_accept(uuid,uuid,uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_delivery_transition(uuid,uuid,text,uuid,uuid)
 TO service_role;
COMMIT;
