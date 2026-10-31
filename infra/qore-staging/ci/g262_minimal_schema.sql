-- G262 disposable PostgreSQL only. DO NOT APPLY to real Supabase.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA qore_stage_internal;
GRANT USAGE ON SCHEMA public,qore_stage_internal TO service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TYPE public.app_role AS ENUM('passenger','driver','admin');
CREATE TYPE public.mobility_service_kind AS ENUM('economico','confort','xl','moto_pasajero');
CREATE TYPE public.mobility_stage_fare_mode AS ENUM('AUTO','MOTO','DELIVERY','MERCHANT_DELIVERY');
CREATE TYPE public.mobility_stage_trip_status AS ENUM('searching','accepted','arriving','in_progress','completed','cancelled');
CREATE TABLE public.user_roles(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 role public.app_role NOT NULL
);
CREATE TABLE public.mobility_stage_auto_demo_trips(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_key uuid UNIQUE NOT NULL,
 passenger_id uuid NOT NULL REFERENCES auth.users(id),
 service public.mobility_service_kind NOT NULL,
 origin_tag text NOT NULL,
 destination_tag text NOT NULL,
 status public.mobility_stage_trip_status NOT NULL DEFAULT 'searching',
 revision bigint NOT NULL DEFAULT 1
);
CREATE TABLE public.mobility_stage_fare_rules(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 rule_key text NOT NULL,
 mode public.mobility_stage_fare_mode NOT NULL,
 zone_tag text NOT NULL,
 base_pyg integer NOT NULL,
 per_km_pyg integer NOT NULL,
 per_minute_pyg integer NOT NULL,
 minimum_pyg integer NOT NULL,
 commission_bps integer NOT NULL,
 valid_from timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 active boolean NOT NULL DEFAULT false
);
CREATE FUNCTION public.mobility_stage_auto_demo_request(
 _passenger_id uuid,_request_key uuid,_origin_tag text,
 _destination_tag text,_service public.mobility_service_kind
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE out_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles
  WHERE user_id=_passenger_id AND role='passenger') THEN
  RAISE EXCEPTION 'Only passenger allowed';
 END IF;
 INSERT INTO public.mobility_stage_auto_demo_trips(
  request_key,passenger_id,service,origin_tag,destination_tag)
 VALUES(_request_key,_passenger_id,_service,_origin_tag,_destination_tag)
 ON CONFLICT(request_key) DO NOTHING RETURNING id INTO out_id;
 IF out_id IS NOT NULL THEN RETURN out_id; END IF;
 SELECT id INTO out_id FROM public.mobility_stage_auto_demo_trips
 WHERE request_key=_request_key AND passenger_id=_passenger_id
 AND service=_service AND origin_tag=_origin_tag AND destination_tag=_destination_tag;
 IF out_id IS NULL THEN RAISE EXCEPTION 'Conflicting booking key'; END IF;
 RETURN out_id;
END $f$;
REVOKE ALL ON FUNCTION public.mobility_stage_auto_demo_request(
 uuid,uuid,text,text,public.mobility_service_kind) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_auto_demo_request(
 uuid,uuid,text,text,public.mobility_service_kind) TO service_role;
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-000000000101'),
 ('00000000-0000-4000-8000-000000000102');
INSERT INTO public.user_roles(user_id,role) VALUES
 ('00000000-0000-4000-8000-000000000101','passenger'),
 ('00000000-0000-4000-8000-000000000102','passenger');
INSERT INTO public.mobility_stage_fare_rules(rule_key,mode,zone_tag,
 base_pyg,per_km_pyg,per_minute_pyg,minimum_pyg,commission_bps,
 valid_from,valid_until,active)
VALUES('QA_G262_RULE_1','AUTO','ASUNCION_FIXTURE',8000,1000,200,
 10000,1800,now()-interval '1 hour',now()+interval '1 day',true);
