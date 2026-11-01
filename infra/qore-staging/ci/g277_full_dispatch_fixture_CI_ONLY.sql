-- G277 CI_ONLY: build dependencies for exact G262 + G269 integration.
-- RUN ONLY ON disposable PostgreSQL 17, NEVER on Supabase STAGING or LIVE.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_g277_ci'
  OR current_setting('server_version_num')::integer<170000
 THEN RAISE EXCEPTION 'G277 CI_ONLY refuses non-disposable PG17'; END IF;
END $guard$;

CREATE TABLE public.mobility_vehicles (
 id uuid PRIMARY KEY,
 driver_id uuid NOT NULL REFERENCES auth.users(id)
);
CREATE TABLE public.driver_locations (
 driver_id uuid PRIMARY KEY REFERENCES auth.users(id),
 available boolean NOT NULL,
 updated_at timestamptz NOT NULL
);
CREATE TABLE public.mobility_location_consents (
 driver_id uuid PRIMARY KEY REFERENCES auth.users(id),
 opted_in_at timestamptz,
 revoked_at timestamptz
);
CREATE TABLE public.mobility_stage_g263_pickup_preferences (
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 service_kind text NOT NULL,
 maximum_road_meters integer NOT NULL,
 PRIMARY KEY(driver_id,service_kind)
);
CREATE TABLE public.mobility_stage_auto_demo_offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 trip_id uuid NOT NULL REFERENCES public.mobility_stage_auto_demo_trips(id),
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 vehicle_id uuid NOT NULL REFERENCES public.mobility_vehicles(id),
 status text NOT NULL DEFAULT 'offered',
 offered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 UNIQUE(trip_id,driver_id)
);
CREATE TABLE public.mobility_stage_auto_demo_push_outbox (
 offer_id uuid NOT NULL REFERENCES public.mobility_stage_auto_demo_offers(id),
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 PRIMARY KEY(offer_id,driver_id)
);

-- This preflight stub is NEVER real legal/KYC evidence. It exists only
-- for exercise of the downstream G269 transaction in a disposable DB.
CREATE FUNCTION public.mobility_vehicle_preflight(
 _driver uuid,_vehicle uuid,_service public.mobility_service_kind
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $stub$
 SELECT EXISTS (
  SELECT 1 FROM public.mobility_vehicles v
  JOIN public.user_roles r ON r.user_id=v.driver_id AND r.role='driver'
  WHERE v.id=$2 AND v.driver_id=$1 AND $3='economico'
 )
$stub$;
CREATE FUNCTION public.mobility_stage_auto_demo_offer(
 _trip uuid,_driver uuid,_vehicle uuid,_offer_key uuid,_expires_seconds integer
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $stub$
DECLARE existing uuid; result_id uuid;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.mobility_stage_auto_demo_trips t
   WHERE t.id=_trip AND t.status='searching')
 OR public.mobility_vehicle_preflight(_driver,_vehicle,'economico') IS DISTINCT FROM true
 OR _expires_seconds<>30 OR _offer_key IS NULL
 THEN RAISE EXCEPTION 'G277 invalid disposable offer scope'; END IF;
 SELECT id INTO existing FROM public.mobility_stage_auto_demo_offers
 WHERE trip_id=_trip AND driver_id=_driver;
 IF existing IS NOT NULL THEN RETURN existing; END IF;
 INSERT INTO public.mobility_stage_auto_demo_offers(
  trip_id,driver_id,vehicle_id,expires_at)
 VALUES(_trip,_driver,_vehicle,pg_catalog.clock_timestamp()+interval '30 seconds')
 RETURNING id INTO result_id;
 INSERT INTO public.mobility_stage_auto_demo_push_outbox(offer_id,driver_id)
 VALUES(result_id,_driver);
 RETURN result_id;
END $stub$;

INSERT INTO auth.users(id) VALUES ('00000000-0000-4000-8000-000000000103');
INSERT INTO public.user_roles(user_id,role)
 VALUES('00000000-0000-4000-8000-000000000103','driver');
INSERT INTO public.mobility_vehicles(id,driver_id)
 VALUES('00000000-0000-4000-8000-000000000301',
        '00000000-0000-4000-8000-000000000103');
INSERT INTO public.driver_locations(driver_id,available,updated_at)
 VALUES('00000000-0000-4000-8000-000000000103',
        true,pg_catalog.clock_timestamp());
INSERT INTO public.mobility_location_consents(driver_id,opted_in_at,revoked_at)
 VALUES('00000000-0000-4000-8000-000000000103',
        pg_catalog.clock_timestamp(),NULL);
INSERT INTO public.mobility_stage_g263_pickup_preferences(
 driver_id,service_kind,maximum_road_meters)
 VALUES('00000000-0000-4000-8000-000000000103','RIDE',5000);
