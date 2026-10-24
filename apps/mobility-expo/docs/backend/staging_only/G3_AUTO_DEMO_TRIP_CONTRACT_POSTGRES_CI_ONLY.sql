-- G3 AUTO DEMO ONLY, contract tested in EPHEMERAL POSTGRES CI.
-- DO NOT APPLY TO ANY REMOTE SUPABASE UNTIL AUTH/LEGAL GO/NO-GO.
-- Never a commercial trip RPC; no locations, no fare, no payments.
BEGIN;
CREATE TYPE public.mobility_stage_trip_status AS ENUM
 ('searching','accepted','arriving','in_progress','completed','cancelled');

CREATE TABLE public.mobility_stage_auto_demo_trips (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 driver_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 vehicle_id uuid REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 service public.mobility_service_kind NOT NULL
   CHECK(service IN ('economico','confort','xl')),
 origin_tag text NOT NULL CHECK (origin_tag ~ '^[A-Z_]{3,40}$'),
 destination_tag text NOT NULL CHECK (destination_tag ~ '^[A-Z_]{3,40}$'),
 status public.mobility_stage_trip_status NOT NULL DEFAULT 'searching',
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 changed_at timestamptz NOT NULL DEFAULT now(),
 CHECK (origin_tag<>destination_tag),
 CHECK (
 (status='searching' AND driver_id IS NULL AND vehicle_id IS NULL)
 OR (status IN ('accepted','arriving','in_progress','completed') AND driver_id IS NOT NULL AND vehicle_id IS NOT NULL)
 OR (status='cancelled')
 )
);
CREATE UNIQUE INDEX mobility_stage_one_active_passenger
 ON public.mobility_stage_auto_demo_trips(passenger_id)
 WHERE status IN ('searching','accepted','arriving','in_progress');
CREATE UNIQUE INDEX mobility_stage_one_active_driver
 ON public.mobility_stage_auto_demo_trips(driver_id)
 WHERE driver_id IS NOT NULL AND status IN ('accepted','arriving','in_progress');

CREATE TABLE public.mobility_stage_auto_demo_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 trip_id uuid NOT NULL REFERENCES public.mobility_stage_auto_demo_trips(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 next_status public.mobility_stage_trip_status NOT NULL CHECK(next_status<>'searching'),
 trip_revision bigint NOT NULL CHECK(trip_revision>1),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(trip_id,trip_revision)
);
ALTER TABLE public.mobility_stage_auto_demo_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_auto_demo_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_auto_demo_trips FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_auto_demo_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.mobility_stage_auto_demo_trips TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_auto_demo_trips TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_auto_demo_events TO service_role;
CREATE POLICY mobility_stage_trip_own_read ON public.mobility_stage_auto_demo_trips
 FOR SELECT TO authenticated USING(passenger_id=auth.uid() OR driver_id=auth.uid());
-- No event SELECT for clients: actor/event metadata stays server-private.

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

CREATE FUNCTION public.mobility_stage_auto_demo_accept(
 _trip_id uuid,_driver_id uuid,_vehicle_id uuid,_request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE trip public.mobility_stage_auto_demo_trips%ROWTYPE;
 previous public.mobility_stage_auto_demo_events%ROWTYPE;
 event_id uuid; ver bigint;
BEGIN
 IF _trip_id IS NULL OR _driver_id IS NULL OR _vehicle_id IS NULL OR _request_key IS NULL
 THEN RAISE EXCEPTION 'Missing fake assignment input'; END IF;
 SELECT * INTO trip FROM public.mobility_stage_auto_demo_trips WHERE id=_trip_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Demo trip not found'; END IF;
 SELECT * INTO previous FROM public.mobility_stage_auto_demo_events WHERE request_key=_request_key;
 IF FOUND THEN
   IF previous.trip_id<>_trip_id OR previous.actor_id<>_driver_id
     OR previous.next_status<>'accepted'
   THEN RAISE EXCEPTION 'Conflicting assignment replay'; END IF;
   RETURN previous.id;
 END IF;
 IF trip.status<>'searching' OR trip.passenger_id=_driver_id
 THEN RAISE EXCEPTION 'Demo trip already assigned or self-assignment'; END IF;
 IF NOT public.mobility_vehicle_preflight(_driver_id,_vehicle_id,trip.service)
 THEN RAISE EXCEPTION 'Driver/vehicle not eligible for fake AUTO assignment'; END IF;
 UPDATE public.mobility_stage_auto_demo_trips
 SET status='accepted',driver_id=_driver_id,vehicle_id=_vehicle_id,
     revision=revision+1,changed_at=now()
 WHERE id=_trip_id AND status='searching' RETURNING revision INTO ver;
 IF ver IS NULL THEN RAISE EXCEPTION 'Competing driver already won'; END IF;
 INSERT INTO public.mobility_stage_auto_demo_events
 (request_key,trip_id,actor_id,next_status,trip_revision)
 VALUES(_request_key,_trip_id,_driver_id,'accepted',ver) RETURNING id INTO event_id;
 RETURN event_id;
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

REVOKE ALL ON FUNCTION public.mobility_stage_auto_demo_request(
 uuid,uuid,text,text,public.mobility_service_kind) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_auto_demo_accept(
 uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_auto_demo_transition(
 uuid,uuid,public.mobility_stage_trip_status,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_auto_demo_request(
 uuid,uuid,text,text,public.mobility_service_kind) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_auto_demo_accept(
 uuid,uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_auto_demo_transition(
 uuid,uuid,public.mobility_stage_trip_status,uuid) TO service_role;
COMMIT;
