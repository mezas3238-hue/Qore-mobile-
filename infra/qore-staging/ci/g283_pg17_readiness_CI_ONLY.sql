-- G283: disposable PG17 ONLY, never send this file to Supabase STAGING.
\set ON_ERROR_STOP on
DO $g$ BEGIN
 IF current_database()<>'qore_g283_ci'
 THEN RAISE EXCEPTION 'G283 CI_ONLY refuses persistent database'; END IF;
END $g$;
CREATE SCHEMA qore_stage_internal;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TYPE public.mobility_stage_fare_mode AS ENUM ('AUTO','MOTO');
CREATE TYPE public.mobility_service_kind AS ENUM ('economico','confort','xl','moto_pasajero');
CREATE TABLE public.mobility_stage_g269_auto_dispatch_jobs(booking_key uuid PRIMARY KEY);
CREATE TABLE public.mobility_stage_fare_rules(
 mode public.mobility_stage_fare_mode NOT NULL,
 active boolean NOT NULL,
 valid_from timestamptz NOT NULL,
 valid_until timestamptz,
 approved_by uuid,
 approved_at timestamptz
);
CREATE TABLE public.mobility_stage_backoffice_roles(
 user_id uuid PRIMARY KEY,
 status text NOT NULL,
 role text NOT NULL,
 approved_by uuid,
 approved_at timestamptz
);
CREATE TABLE public.mobility_vehicles(
 id uuid PRIMARY KEY,driver_id uuid NOT NULL,
 service_kind public.mobility_service_kind NOT NULL,
 legally_approved boolean NOT NULL
);
CREATE TABLE public.mobility_stage_g263_pickup_preferences(
 driver_id uuid NOT NULL,service_kind text NOT NULL,
 maximum_road_meters integer NOT NULL
);
CREATE FUNCTION public.mobility_stage_g27_backoffice_role_of(_user uuid)
 RETURNS text LANGUAGE sql STABLE AS $stub$
 SELECT role FROM public.mobility_stage_backoffice_roles
 WHERE user_id=$1 AND status='active' AND approved_by<>user_id
 LIMIT 1
$stub$;
CREATE FUNCTION public.mobility_vehicle_preflight(
 _driver_id uuid,_vehicle_id uuid,_service public.mobility_service_kind
) RETURNS boolean LANGUAGE sql STABLE AS $stub$
 SELECT EXISTS(SELECT 1 FROM public.mobility_vehicles v
  WHERE v.id=$2 AND v.driver_id=$1 AND v.service_kind=$3
  AND v.legally_approved IS TRUE)
$stub$;
\i /tmp/g283_readiness_source.sql

DO $assert$
DECLARE r jsonb;
BEGIN
 r:=public.mobility_stage_g283_auto_retry_readiness_qa();
 IF r IS DISTINCT FROM '{"mode":"STAGING_DEMO_ONLY","commercialEnabled":false,"ownerAutoFareVerified":false,"eligibleAutoDriverVerified":false,"databaseReady":false}'::jsonb
 THEN RAISE EXCEPTION 'G283 empty DB must fail closed: %',r; END IF;
END $assert$;
INSERT INTO public.mobility_stage_fare_rules
 VALUES('AUTO',true,clock_timestamp()-interval '5 minutes',NULL,
 '00000000-0000-4000-8000-000000000101',clock_timestamp()-interval '5 minutes');
INSERT INTO public.mobility_vehicles VALUES(
 '00000000-0000-4000-8000-000000000301',
 '00000000-0000-4000-8000-000000000201','economico',false);
INSERT INTO public.mobility_stage_g263_pickup_preferences VALUES(
 '00000000-0000-4000-8000-000000000201','RIDE',4000);
DO $assert$
DECLARE r jsonb;
BEGIN
 r:=public.mobility_stage_g283_auto_retry_readiness_qa();
 IF r->>'databaseReady'<>'false' OR r->>'ownerAutoFareVerified'<>'false'
 OR r->>'eligibleAutoDriverVerified'<>'false'
 THEN RAISE EXCEPTION 'G283 cannot trust unapproved self-declared fare/Driver: %',r; END IF;
END $assert$;

-- CI-only legal review fixtures, NEVER real approval data.
INSERT INTO public.mobility_stage_backoffice_roles VALUES(
 '00000000-0000-4000-8000-000000000101','active','owner',
 '00000000-0000-4000-8000-000000000102',clock_timestamp()-interval '5 minutes');
UPDATE public.mobility_vehicles SET legally_approved=true;
DO $assert$
DECLARE r jsonb;
BEGIN
 r:=public.mobility_stage_g283_auto_retry_readiness_qa();
 IF r IS DISTINCT FROM '{"mode":"STAGING_DEMO_ONLY","commercialEnabled":false,"ownerAutoFareVerified":true,"eligibleAutoDriverVerified":true,"databaseReady":true}'::jsonb
 THEN RAISE EXCEPTION 'G283 approved synthetic fixture unexpectedly unavailable: %',r; END IF;
END $assert$;
UPDATE public.mobility_stage_g263_pickup_preferences
SET maximum_road_meters=0;
DO $assert$
DECLARE r jsonb;
BEGIN
 r:=public.mobility_stage_g283_auto_retry_readiness_qa();
 IF r->>'databaseReady'<>'false' OR r->>'eligibleAutoDriverVerified'<>'false'
 THEN RAISE EXCEPTION 'G283 accepted Driver with OFF radius: %',r; END IF;
END $assert$;
UPDATE public.mobility_stage_g263_pickup_preferences SET maximum_road_meters=4000;
UPDATE public.mobility_stage_fare_rules SET active=false;
DO $assert$
DECLARE r jsonb;
BEGIN
 r:=public.mobility_stage_g283_auto_retry_readiness_qa();
 IF r->>'databaseReady'<>'false' OR r->>'ownerAutoFareVerified'<>'false'
 THEN RAISE EXCEPTION 'G283 accepted inactive Owner fare: %',r; END IF;
 IF has_function_privilege('anon','public.mobility_stage_g283_auto_retry_readiness_qa()','EXECUTE')
 OR has_function_privilege('authenticated','public.mobility_stage_g283_auto_retry_readiness_qa()','EXECUTE')
 OR NOT has_function_privilege('service_role','public.mobility_stage_g283_auto_retry_readiness_qa()','EXECUTE')
 THEN RAISE EXCEPTION 'G283 service-role ACL failed'; END IF;
 RAISE NOTICE 'G283 PG17 readiness & ACL PASS; synthetic data remains in CI ONLY';
END $assert$;
