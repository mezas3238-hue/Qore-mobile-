-- G333 PostgreSQL17 synthetic database ONLY. Do not execute on Supabase.
\set ON_ERROR_STOP on
DO $guard$ BEGIN
 IF current_database()<>'qore_g333_ci'
  OR pg_catalog.current_setting('server_version_num')::integer < 170000
 THEN RAISE EXCEPTION 'G333 CI-only wrong PostgreSQL target'; END IF;
END $guard$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA qore_stage_internal;
CREATE TYPE public.app_role AS ENUM ('admin','driver','passenger');
CREATE TYPE public.mobility_service_kind AS ENUM ('economico','confort','xl','moto_pasajero');
CREATE TYPE public.mobility_stage_trip_status AS ENUM
 ('searching','accepted','arriving','in_progress','completed','cancelled');
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.user_roles(
 user_id uuid REFERENCES auth.users(id),role public.app_role NOT NULL
);
CREATE TABLE public.mobility_stage_backoffice_roles(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 role text NOT NULL,status text NOT NULL,approved_by uuid NOT NULL REFERENCES auth.users(id)
);
CREATE TABLE public.mobility_stage_auto_demo_trips(
 id uuid PRIMARY KEY, request_key uuid NOT NULL,passenger_id uuid NOT NULL REFERENCES auth.users(id),
 driver_id uuid REFERENCES auth.users(id),
 service public.mobility_service_kind NOT NULL,
 origin_tag text NOT NULL,destination_tag text NOT NULL,
 status public.mobility_stage_trip_status NOT NULL,
 revision bigint NOT NULL
);
CREATE TABLE public.mobility_stage_g73_auto_routes(
 id uuid PRIMARY KEY,passenger_id uuid NOT NULL REFERENCES auth.users(id),
 service public.mobility_service_kind NOT NULL,origin_tag text NOT NULL,
 destination_tag text NOT NULL
);
CREATE TABLE public.mobility_stage_fare_rules(
 id uuid PRIMARY KEY,rule_key text NOT NULL
);
CREATE TABLE public.mobility_stage_g262_auto_prequotes(
 id uuid PRIMARY KEY,passenger_id uuid NOT NULL REFERENCES auth.users(id),
 route_id uuid NOT NULL REFERENCES public.mobility_stage_g73_auto_routes(id),
 rule_id uuid NOT NULL REFERENCES public.mobility_stage_fare_rules(id),
 booking_key uuid,trip_id uuid REFERENCES public.mobility_stage_auto_demo_trips(id),
 total_pyg integer NOT NULL,commission_pyg integer NOT NULL
);
ALTER TABLE public.mobility_stage_auto_demo_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g73_auto_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g262_auto_prequotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_fare_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mobility_stage_g27_backoffice_role_of(_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $role$
 SELECT br.role
 FROM public.mobility_stage_backoffice_roles br
 WHERE br.user_id=_user AND br.status='active'
  AND br.approved_by<>br.user_id
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=_user)
 LIMIT 1
$role$;
CREATE FUNCTION public.mobility_stage_g27_backoffice_has_scope(_user uuid,_scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $scope$
 SELECT COALESCE(EXISTS (
  SELECT 1 FROM public.mobility_stage_backoffice_roles br
  WHERE br.user_id=_user AND br.status='active' AND br.role='admin'
   AND br.approved_by<>br.user_id
   AND NOT EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id=_user)
   AND _scope IN ('admin.audit.read')),false)
$scope$;
REVOKE ALL ON FUNCTION public.mobility_stage_g27_backoffice_role_of(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g27_backoffice_has_scope(uuid,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g27_backoffice_role_of(uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g27_backoffice_has_scope(uuid,text)
 TO service_role;

INSERT INTO auth.users(id) VALUES
 ('33300000-0000-4333-8333-000000000001'),
 ('33300000-0000-4333-8333-000000000002'),
 ('33300000-0000-4333-8333-000000000003'),
 ('33300000-0000-4333-8333-000000000004'),
 ('33300000-0000-4333-8333-000000000005'),
 ('33300000-0000-4333-8333-000000000006'),
 ('33300000-0000-4333-8333-000000000007');
INSERT INTO public.user_roles VALUES
 ('33300000-0000-4333-8333-000000000003','passenger'),
 ('33300000-0000-4333-8333-000000000004','driver');
INSERT INTO public.mobility_stage_backoffice_roles VALUES
 ('33300000-0000-4333-8333-000000000001','admin','active','33300000-0000-4333-8333-000000000002'),
 ('33300000-0000-4333-8333-000000000005','owner','active','33300000-0000-4333-8333-000000000002'),
 ('33300000-0000-4333-8333-000000000006','admin','active','33300000-0000-4333-8333-000000000006'),
 ('33300000-0000-4333-8333-000000000007','admin','suspended','33300000-0000-4333-8333-000000000002');
INSERT INTO public.mobility_stage_auto_demo_trips VALUES
 ('33300000-0000-4333-8333-000000000010',
  '33300000-0000-4333-8333-000000000011',
  '33300000-0000-4333-8333-000000000003',NULL,
  'economico','HERNANDARIAS','CIUDAD_DEL_ESTE','searching',1);
INSERT INTO public.mobility_stage_g73_auto_routes VALUES
 ('33300000-0000-4333-8333-000000000012',
  '33300000-0000-4333-8333-000000000003',
  'economico','HERNANDARIAS','CIUDAD_DEL_ESTE'),
 ('33300000-0000-4333-8333-000000000019',
  '33300000-0000-4333-8333-000000000003',
  'economico','VILLARRICA','ASUNCION');
INSERT INTO public.mobility_stage_fare_rules VALUES
 ('33300000-0000-4333-8333-000000000013','AUTO_PY_QA_01');
INSERT INTO public.mobility_stage_g262_auto_prequotes VALUES
 ('33300000-0000-4333-8333-000000000014',
  '33300000-0000-4333-8333-000000000003',
  '33300000-0000-4333-8333-000000000012',
  '33300000-0000-4333-8333-000000000013',
  '33300000-0000-4333-8333-000000000011',
  '33300000-0000-4333-8333-000000000010',18000,1800);

\ir ../migrations/g333_private_admin_auto_f1_receipt_pg17_DRAFT.sql
DO $g333_acl$ BEGIN
 IF NOT has_function_privilege('service_role',
  'public.mobility_stage_g75_admin_f1_receipt(uuid,uuid)','EXECUTE')
  OR has_function_privilege('anon',
  'public.mobility_stage_g75_admin_f1_receipt(uuid,uuid)','EXECUTE')
  OR has_function_privilege('authenticated',
  'public.mobility_stage_g75_admin_f1_receipt(uuid,uuid)','EXECUTE')
  OR has_table_privilege('service_role','public.mobility_stage_g262_auto_prequotes','SELECT')
  OR has_table_privilege('service_role','public.mobility_stage_auto_demo_trips','SELECT')
 THEN RAISE EXCEPTION 'G333 API/table privilege leak'; END IF;
END $g333_acl$;

SET ROLE service_role;
DO $checks$
DECLARE v jsonb;
 admin uuid:='33300000-0000-4333-8333-000000000001';
 trip uuid:='33300000-0000-4333-8333-000000000010';
BEGIN
 v:=public.mobility_stage_g75_admin_f1_receipt(admin,trip);
 IF v IS NULL OR v->>'mode'<>'STAGING_DEMO_ONLY'
  OR v->>'commercialEnabled'<>'false'
  OR v->>'viewerId'<>admin::text OR v->>'tripId'<>trip::text
  OR v->>'quoteId'<>'33300000-0000-4333-8333-000000000014'
  OR v->>'routeId'<>'33300000-0000-4333-8333-000000000012'
  OR v->>'amountGs'<>'18000' OR v->>'fareVersion'<>'AUTO_PY_QA_01'
  OR v->>'status'<>'searching' OR v->>'driverId' IS NOT NULL
  OR v->>'assignmentPersisted'<>'false'
  OR v->>'serverPersisted'<>'true'
  OR v ? 'externalEndToEndCertified'
  OR (v->>'observedAt')::bigint<=0
  OR (v->>'expiresAt')::bigint-(v->>'observedAt')::bigint<>30000
 THEN RAISE EXCEPTION 'G333 exact original priced receipt invalid: %',v; END IF;
 FOREACH admin IN ARRAY ARRAY[
  '33300000-0000-4333-8333-000000000003'::uuid,
  '33300000-0000-4333-8333-000000000005'::uuid,
  '33300000-0000-4333-8333-000000000006'::uuid,
  '33300000-0000-4333-8333-000000000007'::uuid
 ] LOOP
  IF public.mobility_stage_g75_admin_f1_receipt(admin,trip) IS NOT NULL
  THEN RAISE EXCEPTION 'G333 unauthorized role read'; END IF;
 END LOOP;
 IF public.mobility_stage_g75_admin_f1_receipt(
  '33300000-0000-4333-8333-000000000001'::uuid,
  '33300000-0000-4333-8333-000000000015'::uuid) IS NOT NULL
 THEN RAISE EXCEPTION 'G333 missing/foreign original disclosed'; END IF;
END $checks$;
RESET ROLE;

-- A price mismatched to the original route must never create a receipt.
UPDATE public.mobility_stage_g262_auto_prequotes
 SET route_id='33300000-0000-4333-8333-000000000019'
 WHERE id='33300000-0000-4333-8333-000000000014';
SET ROLE service_role;
DO $route_integrity$ BEGIN
 IF public.mobility_stage_g75_admin_f1_receipt(
  '33300000-0000-4333-8333-000000000001',
  '33300000-0000-4333-8333-000000000010') IS NOT NULL
 THEN RAISE EXCEPTION 'G333 accepted quote from different route'; END IF;
END $route_integrity$;
RESET ROLE;
UPDATE public.mobility_stage_g262_auto_prequotes
 SET route_id='33300000-0000-4333-8333-000000000012'
 WHERE id='33300000-0000-4333-8333-000000000014';

UPDATE public.mobility_stage_auto_demo_trips
 SET status='accepted',driver_id='33300000-0000-4333-8333-000000000004',
  revision=2
 WHERE id='33300000-0000-4333-8333-000000000010';
SET ROLE service_role;
DO $driver_receipt$ DECLARE v jsonb; BEGIN
 v:=public.mobility_stage_g75_admin_f1_receipt(
  '33300000-0000-4333-8333-000000000001',
  '33300000-0000-4333-8333-000000000010');
 IF v->>'status'<>'assigned'
  OR v->>'driverId'<>'33300000-0000-4333-8333-000000000004'
  OR v->>'assignmentPersisted'<>'true'
  OR v->>'revision'<>'2'
 THEN RAISE EXCEPTION 'G333 accepted Driver proof wrong: %',v; END IF;
END $driver_receipt$;
RESET ROLE;

-- Completed rides without an assigned Driver must not look externally certified.
UPDATE public.mobility_stage_auto_demo_trips
 SET status='completed',driver_id=NULL,revision=3
 WHERE id='33300000-0000-4333-8333-000000000010';
SET ROLE service_role;
DO $completed_orphan$ BEGIN
 IF public.mobility_stage_g75_admin_f1_receipt(
  '33300000-0000-4333-8333-000000000001',
  '33300000-0000-4333-8333-000000000010') IS NOT NULL
 THEN RAISE EXCEPTION 'G333 orphan completed ride was accepted'; END IF;
END $completed_orphan$;
RESET ROLE;

-- A legitimately completed Driver trip remains readable for Admin audit,
-- keeping the G75 19-field DTO and redaction rules unchanged.
UPDATE public.mobility_stage_auto_demo_trips
 SET status='completed',driver_id='33300000-0000-4333-8333-000000000004',
  revision=4
 WHERE id='33300000-0000-4333-8333-000000000010';
SET ROLE service_role;
DO $completed_assigned$ DECLARE v jsonb; BEGIN
 v:=public.mobility_stage_g75_admin_f1_receipt(
  '33300000-0000-4333-8333-000000000001',
  '33300000-0000-4333-8333-000000000010');
 IF v IS NULL OR v->>'status'<>'completed'
  OR v->>'assignmentPersisted'<>'true'
  OR v->>'driverId' IS NOT NULL OR v->>'revision'<>'4'
 THEN RAISE EXCEPTION 'G333 valid completed ride proof rejected: %',v; END IF;
END $completed_assigned$;
RESET ROLE;
DO $counts$ BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_auto_demo_trips)<>1
  OR (SELECT count(*) FROM public.mobility_stage_g262_auto_prequotes)<>1
  OR (SELECT count(*) FROM public.mobility_stage_g73_auto_routes)<>2
 THEN RAISE EXCEPTION 'G333 caused unexpected SQL mutation'; END IF;
 RAISE NOTICE 'G333 PASS: one original priced AUTO receipt, strict Admin only; CI disposable';
END $counts$;
