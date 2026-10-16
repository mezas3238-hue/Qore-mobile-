\set ON_ERROR_STOP on
-- Local GitHub Actions PostgreSQL only. Never executes against Supabase.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TYPE public.app_role AS ENUM ('admin','driver','passenger');
CREATE TABLE public.user_roles (
 user_id uuid NOT NULL REFERENCES auth.users(id),
 role public.app_role NOT NULL,
 PRIMARY KEY (user_id,role)
);
CREATE TABLE public.driver_locations (
 driver_id uuid PRIMARY KEY REFERENCES auth.users(id),
 available boolean NOT NULL DEFAULT false,
 lat double precision, lng double precision,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
 SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
$f$;
CREATE FUNCTION public.has_role(_uid uuid,_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $f$
 SELECT COALESCE(_uid=auth.uid() AND EXISTS(
  SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role=_role
 ),false)
$f$;
GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
GRANT SELECT ON public.user_roles,public.driver_locations TO service_role;
\ir ../../docs/backend/staging_only/G2_AUTO_MOTO_COMPLIANCE_DO_NOT_APPLY_PRODUCTION.sql
\ir ../../docs/backend/staging_only/G2_SERVER_PREFLIGHT_DO_NOT_APPLY_PRODUCTION.sql

INSERT INTO auth.users (id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333'),
 ('44444444-4444-4444-8444-444444444444');
INSERT INTO public.user_roles (user_id,role) VALUES
 ('11111111-1111-4111-8111-111111111111','driver'),
 ('22222222-2222-4222-8222-222222222222','admin'),
 ('33333333-3333-4333-8333-333333333333','passenger'),
 ('44444444-4444-4444-8444-444444444444','driver');
INSERT INTO public.driver_locations(driver_id,available,lat,lng,updated_at)
VALUES ('11111111-1111-4111-8111-111111111111',true,-25.29,-57.58,now()-interval '5 seconds');
INSERT INTO public.mobility_vehicles
(id,driver_id,vehicle_kind,service_kind,municipality_code,plate_normalized,brand,model,
 manufacture_year,passenger_capacity,review_status)
VALUES
 ('55555555-5555-4555-8555-555555555555',
  '11111111-1111-4111-8111-111111111111',
  'AUTO','economico','ASUNCION','ABC123','Toyota','Corolla',2020,4,'approved'),
 ('66666666-6666-4666-8666-666666666666',
  '11111111-1111-4111-8111-111111111111',
  'MOTO','moto_pasajero','ASUNCION','MOT456','Honda','CB',2020,1,'approved');
INSERT INTO public.mobility_driver_compliance
(driver_id,license_class,license_valid_through,license_verified_at,license_verified_by,driver_review_status)
VALUES ('11111111-1111-4111-8111-111111111111','PROFESIONAL',CURRENT_DATE+30,now()-interval '1 day',
 '22222222-2222-4222-8222-222222222222','approved');
INSERT INTO public.mobility_vehicle_compliance
(vehicle_id,registration_valid_through,registration_verified_at,insurance_valid_through,
 insurance_verified_at,paid_passenger_insurance_covered,inspection_valid_through,
 inspection_verified_at,municipal_authorization_valid_through,municipal_authorization_verified_at,
 moto_helmets_verified,moto_reflective_vests_verified,moto_routes_authorized,reviewed_by,reviewed_at)
SELECT id,CURRENT_DATE+30,now()-interval '1 day',CURRENT_DATE+30,
now()-interval '1 day',true,CURRENT_DATE+30,now()-interval '1 day',
CURRENT_DATE+30,now()-interval '1 day',
CASE WHEN vehicle_kind='MOTO' THEN 2 ELSE 0 END,
CASE WHEN vehicle_kind='MOTO' THEN 2 ELSE 0 END,
true,'22222222-2222-4222-8222-222222222222',now()-interval '1 day'
FROM public.mobility_vehicles;
INSERT INTO public.mobility_location_consents(driver_id,opted_in_at)
VALUES ('11111111-1111-4111-8111-111111111111',now()-interval '1 hour');

-- Verify RBAC grants, plus full PostgreSQL parser/DDL and positive/negative cases.
DO $check$
BEGIN
 IF has_function_privilege('anon',
   'public.mobility_vehicle_preflight(uuid,uuid,public.mobility_service_kind)','EXECUTE')
 OR has_function_privilege('authenticated',
   'public.mobility_vehicle_preflight(uuid,uuid,public.mobility_service_kind)','EXECUTE')
 THEN RAISE EXCEPTION 'Preflight RPC leaked to mobile callers'; END IF;
 IF has_table_privilege('authenticated','public.mobility_vehicle_compliance','SELECT')
 OR has_table_privilege('authenticated','public.mobility_driver_compliance','SELECT')
 OR has_table_privilege('authenticated','public.mobility_vehicles','UPDATE')
 THEN RAISE EXCEPTION 'Compliance or approval leaked to mobile callers'; END IF;
END
$check$;
SET ROLE service_role;
DO $check$
BEGIN
 IF NOT public.mobility_vehicle_preflight(
  '11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555','economico')
 THEN RAISE EXCEPTION 'Valid fake AUTO not eligible for isolated preflight'; END IF;
 IF public.mobility_vehicle_preflight(
  '11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555','moto_pasajero')
 THEN RAISE EXCEPTION 'AUTO accepted into MOTO service'; END IF;
 IF public.mobility_vehicle_preflight(
  '11111111-1111-4111-8111-111111111111',
  '66666666-6666-4666-8666-666666666666','moto_pasajero')
 THEN RAISE EXCEPTION 'MOTO incorrectly enabled without passenger age/route gate'; END IF;
 IF public.mobility_vehicle_preflight(
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555','economico')
 THEN RAISE EXCEPTION 'Cross-driver vehicle approval'; END IF;
END
$check$;
RESET ROLE;

UPDATE public.mobility_vehicle_compliance SET insurance_valid_through=CURRENT_DATE-1
WHERE vehicle_id='55555555-5555-4555-8555-555555555555';
SET ROLE service_role;
DO $check$
BEGIN
 IF public.mobility_vehicle_preflight(
  '11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555','economico')
 THEN RAISE EXCEPTION 'Expired paid-passenger insurance accepted'; END IF;
END
$check$;
RESET ROLE;
UPDATE public.mobility_vehicle_compliance SET insurance_valid_through=CURRENT_DATE+30
WHERE vehicle_id='55555555-5555-4555-8555-555555555555';
UPDATE public.mobility_location_consents SET revoked_at=now()
WHERE driver_id='11111111-1111-4111-8111-111111111111';
SET ROLE service_role;
DO $check$
BEGIN
 IF public.mobility_vehicle_preflight(
  '11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555','economico')
 THEN RAISE EXCEPTION 'Revoked GPS consent accepted'; END IF;
END
$check$;
RESET ROLE;

-- Actual RLS owner/stranger/admn checks under authenticated JWT context.
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $check$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.mobility_vehicles;
 IF n<>0 THEN RAISE EXCEPTION 'Passenger can read another driver vehicle'; END IF;
END
$check$;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $check$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.mobility_vehicles;
 IF n<>2 THEN RAISE EXCEPTION 'Driver cannot read own vehicle inventory'; END IF;
END
$check$;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $check$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.mobility_vehicles;
 IF n<>2 THEN RAISE EXCEPTION 'Admin cannot read vehicle inventory'; END IF;
END
$check$;
RESET ROLE;
\echo PASS: PostgreSQL G2 AUTO/MOTO schema, deny-by-default RLS and preflight test.
