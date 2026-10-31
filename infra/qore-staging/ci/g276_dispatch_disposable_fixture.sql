-- G276 PostgreSQL 16/17 DISPOSABLE FIXTURES ONLY.
-- Never apply to Supabase STAGING, never equate synthetic clearance with legal KYC.
-- Install AFTER g262_minimal_schema.sql and G262, BEFORE G269.
CREATE TABLE public.mobility_vehicles (
 id uuid PRIMARY KEY,
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 qa_eligible boolean NOT NULL DEFAULT false
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
 maximum_road_meters integer NOT NULL CHECK (maximum_road_meters BETWEEN 0 AND 50000),
 PRIMARY KEY(driver_id,service_kind)
);
CREATE TABLE public.mobility_stage_auto_demo_offers (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 trip_id uuid NOT NULL REFERENCES public.mobility_stage_auto_demo_trips(id),
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 vehicle_id uuid NOT NULL REFERENCES public.mobility_vehicles(id),
 request_key uuid NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'offered',
 offered_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL
);
CREATE TABLE public.mobility_stage_auto_demo_push_outbox (
 offer_id uuid NOT NULL REFERENCES public.mobility_stage_auto_demo_offers(id),
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 PRIMARY KEY(offer_id,driver_id)
);
-- Local stub models the existing server-side eligibility check. No approval
-- artifacts or user records from this disposable DB can reach Supabase.
CREATE FUNCTION public.mobility_vehicle_preflight(
 _driver_id uuid,_vehicle_id uuid,_service public.mobility_service_kind
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT EXISTS(
  SELECT 1 FROM public.mobility_vehicles v
  JOIN public.user_roles r ON r.user_id=v.driver_id
  WHERE v.id=$2 AND v.driver_id=$1 AND v.qa_eligible=true
    AND r.role='driver' AND $3 IN ('economico','confort','xl')
 )
$f$;
-- Disposable stand-in for the real G3 atomic offer + outbox operation.
CREATE FUNCTION public.mobility_stage_auto_demo_offer(
 _trip_id uuid,_driver_id uuid,_vehicle_id uuid,_request_key uuid,_ttl_s integer
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE v uuid;
BEGIN
 IF _ttl_s IS NULL OR _ttl_s NOT BETWEEN 1 AND 60
    OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_trips t
      WHERE t.id=_trip_id AND t.status='searching')
    OR public.mobility_vehicle_preflight(
      _driver_id,_vehicle_id,(SELECT service FROM public.mobility_stage_auto_demo_trips WHERE id=_trip_id)
    ) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'G276 fake driver not eligible'; END IF;
 INSERT INTO public.mobility_stage_auto_demo_offers(
   trip_id,driver_id,vehicle_id,request_key,expires_at
 ) VALUES(_trip_id,_driver_id,_vehicle_id,_request_key,
   pg_catalog.clock_timestamp()+_ttl_s*interval '1 second')
 RETURNING id INTO v;
 INSERT INTO public.mobility_stage_auto_demo_push_outbox(offer_id,driver_id)
 VALUES(v,_driver_id);
 RETURN v;
END $f$;
INSERT INTO auth.users(id) VALUES ('00000000-0000-4000-8000-000000000103');
INSERT INTO public.user_roles(user_id,role)
 VALUES ('00000000-0000-4000-8000-000000000103','driver');
INSERT INTO public.mobility_vehicles(id,driver_id,qa_eligible)
 VALUES('00000000-0000-4000-8000-000000000303',
 '00000000-0000-4000-8000-000000000103',true);
INSERT INTO public.driver_locations(driver_id,available,updated_at)
 VALUES('00000000-0000-4000-8000-000000000103',true,pg_catalog.clock_timestamp());
INSERT INTO public.mobility_location_consents(driver_id,opted_in_at,revoked_at)
 VALUES('00000000-0000-4000-8000-000000000103',pg_catalog.clock_timestamp(),NULL);
INSERT INTO public.mobility_stage_g263_pickup_preferences(
 driver_id,service_kind,maximum_road_meters
) VALUES('00000000-0000-4000-8000-000000000103','RIDE',5000);
