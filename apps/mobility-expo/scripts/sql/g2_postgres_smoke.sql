\set ON_ERROR_STOP on
-- Local GitHub Actions PostgreSQL only. Never executes against Supabase.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
 SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
$f$;
GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
\ir ../../docs/backend/staging_only/G1_ISOLATED_SUPABASE_BASELINE_DO_NOT_APPLY_PRODUCTION.sql
\ir g1_private_storage_ci_mock.sql
\ir ../../docs/backend/staging_only/G1_PRIVATE_DOCS_BUCKET_STAGING_ONLY.sql
\ir ../../docs/backend/staging_only/G2_AUTO_MOTO_COMPLIANCE_DO_NOT_APPLY_PRODUCTION.sql
\ir ../../docs/backend/staging_only/G2_SERVER_PREFLIGHT_DO_NOT_APPLY_PRODUCTION.sql
\ir ../../docs/backend/staging_only/G2_REVIEW_AUDIT_DO_NOT_APPLY_PRODUCTION.sql
\ir ../../docs/backend/staging_only/G2_APPLICATION_INTAKE_DO_NOT_APPLY_PRODUCTION.sql
\ir ../../docs/backend/staging_only/G2_APPLICATION_TO_PENDING_INVENTORY_STAGING_ONLY.sql

INSERT INTO auth.users (id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333'),
 ('44444444-4444-4444-8444-444444444444');
-- Signup trigger granted only passenger; testing driver/admin requires privileged server.
INSERT INTO public.user_roles (user_id,role) VALUES
 ('11111111-1111-4111-8111-111111111111','driver'),
 ('22222222-2222-4222-8222-222222222222','admin'),
 ('44444444-4444-4444-8444-444444444444','driver');
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.profiles)<>4
 THEN RAISE EXCEPTION 'Staging Auth trigger did not create profiles'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE role='passenger')<>4
 THEN RAISE EXCEPTION 'Staging signup mistakenly assigns elevated role'; END IF;
 IF has_table_privilege('authenticated','public.user_roles','INSERT')
 OR has_table_privilege('authenticated','public.user_roles','UPDATE')
 OR has_table_privilege('authenticated','public.profiles','UPDATE')
 OR has_function_privilege('anon','public.has_role(uuid,public.app_role)','EXECUTE')
 THEN RAISE EXCEPTION 'Baseline auth permissions unsafe'; END IF;
END
$check$;
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

-- Verify server-only audited review; never permit self-approval from a mobile.
UPDATE public.mobility_vehicles SET review_status='pending'
WHERE id IN ('55555555-5555-4555-8555-555555555555',
             '66666666-6666-4666-8666-666666666666');
DO $check$
BEGIN
 IF has_function_privilege('authenticated',
  'public.mobility_review_vehicle(uuid,uuid,boolean,text,uuid)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_review_vehicle(uuid,uuid,boolean,text,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Review function accidentally exposed to clients'; END IF;
 IF has_table_privilege('service_role','public.mobility_vehicle_review_audit','UPDATE')
 OR has_table_privilege('service_role','public.mobility_vehicle_review_audit','DELETE')
 OR has_table_privilege('authenticated','public.mobility_vehicle_review_audit','SELECT')
 THEN RAISE EXCEPTION 'Append-only audit or privacy permissions unsafe'; END IF;
END
$check$;

SET ROLE service_role;
DO $check$
DECLARE first_id uuid; duplicate_id uuid; blocked boolean;
BEGIN
 first_id:=public.mobility_review_vehicle(
 '55555555-5555-4555-8555-555555555555',
 '22222222-2222-4222-8222-222222222222',true,
 'Validated all documents and commercial cover in staging',
 '77777777-7777-4777-8777-777777777777');
 duplicate_id:=public.mobility_review_vehicle(
 '55555555-5555-4555-8555-555555555555',
 '22222222-2222-4222-8222-222222222222',true,
 'Validated all documents and commercial cover in staging',
 '77777777-7777-4777-8777-777777777777');
 IF first_id IS NULL OR first_id<>duplicate_id
 THEN RAISE EXCEPTION 'Idempotent reviewer retry must return same audit id'; END IF;
 IF (SELECT count(*) FROM public.mobility_vehicle_review_audit
     WHERE vehicle_id='55555555-5555-4555-8555-555555555555')<>1
 THEN RAISE EXCEPTION 'Duplicate audit entry for same idempotency key'; END IF;
 IF (SELECT revision FROM public.mobility_vehicles
     WHERE id='55555555-5555-4555-8555-555555555555')<>2
 THEN RAISE EXCEPTION 'Retry unexpectedly changed vehicle revision'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_review_vehicle(
   '66666666-6666-4666-8666-666666666666',
   '11111111-1111-4111-8111-111111111111',false,
   'Driver cannot review their own application',
   '88888888-8888-4888-8888-888888888888');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Non-admin allowed vehicle review'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_review_vehicle(
   '66666666-6666-4666-8666-666666666666',
   '22222222-2222-4222-8222-222222222222',true,
   'Try enabling moto without municipal authorization',
   '99999999-9999-4999-8999-999999999999');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'MOTO commercial approval inadvertently opened'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_review_vehicle(
   '55555555-5555-4555-8555-555555555555',
   '22222222-2222-4222-8222-222222222222',false,
   'Conflicting reuse of old review key must fail',
   '77777777-7777-4777-8777-777777777777');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Idempotency key used for conflicting decision'; END IF;
END
$check$;
RESET ROLE;
\echo PASS: G2 admin-only audited review, idempotency and MOTO commercial freeze.

-- Intake queue: the only creator is trusted service_role; drafts remain pending.
DO $check$
BEGIN
 IF has_function_privilege('authenticated',
  'public.mobility_submit_vehicle_draft(uuid,uuid,public.mobility_vehicle_kind,public.mobility_service_kind,text,text,text,text,integer,integer)',
  'EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_submit_vehicle_draft(uuid,uuid,public.mobility_vehicle_kind,public.mobility_service_kind,text,text,text,text,integer,integer)',
  'EXECUTE')
 THEN RAISE EXCEPTION 'Vehicle intake RPC exposed to mobile'; END IF;
 IF has_table_privilege('authenticated','public.mobility_vehicle_applications','INSERT')
 OR has_table_privilege('authenticated','public.mobility_vehicle_applications','UPDATE')
 THEN RAISE EXCEPTION 'Applicant can self-approve or insert bypassing gateway'; END IF;
END
$check$;
SET ROLE service_role;
DO $check$
DECLARE id1 uuid; id2 uuid; blocked boolean;
BEGIN
 id1:=public.mobility_submit_vehicle_draft(
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','AUTO','economico',
  'ASUNCION','PRY123','Toyota','Vitz',2021,4);
 id2:=public.mobility_submit_vehicle_draft(
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','AUTO','economico',
  'ASUNCION','PRY123','Toyota','Vitz',2021,4);
 IF id1 IS NULL OR id1<>id2 THEN RAISE EXCEPTION 'Application retry was not idempotent'; END IF;
 IF (SELECT count(*) FROM public.mobility_vehicle_applications WHERE request_key=
     'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>1
 THEN RAISE EXCEPTION 'Duplicate application for identical idempotency key'; END IF;
 IF (SELECT status FROM public.mobility_vehicle_applications WHERE id=id1)<>
    'pending'::public.mobility_review_status
 THEN RAISE EXCEPTION 'Application became approved from user payload'; END IF;
 IF (SELECT evidence_unverified FROM public.mobility_vehicle_applications WHERE id=id1)<>true
 THEN RAISE EXCEPTION 'Evidence was marked verified by applicant'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_submit_vehicle_draft(
   '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','AUTO','economico',
   'ASUNCION','FAKE999','Toyota','Vitz',2021,4);
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Idempotency conflicting payload accepted'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_submit_vehicle_draft(
   '11111111-1111-4111-8111-111111111111',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','MOTO','economico',
   'ASUNCION','FAKE999','Honda','CG',2021,1);
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'MOTO request claimed AUTO service'; END IF;
 -- Moto drafts may be received for legal research, NEVER approved or offered.
 PERFORM public.mobility_submit_vehicle_draft(
  '44444444-4444-4444-8444-444444444444',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','MOTO','moto_pasajero',
  'ASUNCION','MOT999','Honda','CG',2021,1);
END
$check$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.mobility_vehicle_applications)<>0
 THEN RAISE EXCEPTION 'Passenger sees unrelated private driver applications'; END IF;
END
$check$;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.mobility_vehicle_applications)<>1
 THEN RAISE EXCEPTION 'Driver cannot read only own application'; END IF;
END
$check$;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.mobility_vehicle_applications)<>2
 THEN RAISE EXCEPTION 'Administrator cannot review pending application summaries'; END IF;
END
$check$;
RESET ROLE;
\echo PASS: G2 AUTO/MOTO pending-only intake queue, JWT RLS and idempotency.

-- Baseline profile/role isolation under authenticated JWT; public read forbidden.
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.profiles)<>1
 OR (SELECT count(*) FROM public.user_roles)<>1
 THEN RAISE EXCEPTION 'Staging identity RLS exposed other accounts'; END IF;
 IF public.has_role('22222222-2222-4222-8222-222222222222','admin'::public.app_role)
 THEN RAISE EXCEPTION 'has_role leaked another account admin role'; END IF;
END
$check$;
RESET ROLE;
\echo PASS: G1 fresh isolated Supabase baseline, user signup, own profiles and no role escalation.

-- Real PostgreSQL RLS decisions on disposable Storage fixture, never Supabase.
INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES
 ('mobility-staging-driver-evidence',
  '11111111-1111-4111-8111-111111111111/licencia-123456789012.jpg',
  '11111111-1111-4111-8111-111111111111'),
 ('mobility-staging-driver-evidence',
  '44444444-4444-4444-8444-444444444444/licencia-123456789012.png',
  '44444444-4444-4444-8444-444444444444');
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $check$
DECLARE denied boolean;
BEGIN
 IF (SELECT count(*) FROM storage.objects)<>1
 THEN RAISE EXCEPTION 'Driver can read someone else private document'; END IF;
 INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES
 ('mobility-staging-driver-evidence',
  '11111111-1111-4111-8111-111111111111/licencia-ABCDEF123456.jpg',
  '11111111-1111-4111-8111-111111111111');
 IF (SELECT count(*) FROM storage.objects)<>2
 THEN RAISE EXCEPTION 'Own-file upload denied unexpectedly'; END IF;

 denied:=false;
 BEGIN
  INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES
   ('mobility-staging-driver-evidence',
    '44444444-4444-4444-8444-444444444444/licencia-SPOOF123456.jpg',
    '44444444-4444-4444-8444-444444444444');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Cross-driver upload was accepted'; END IF;

 denied:=false;
 BEGIN
  INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES
   ('mobility-staging-driver-evidence',
    '11111111-1111-4111-8111-111111111111/licencia-FAKEOWNER1234.jpg',
    '44444444-4444-4444-8444-444444444444');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Owner_id spoofing was accepted'; END IF;

 denied:=false;
 BEGIN
  INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES
   ('mobility-staging-driver-evidence',
    '11111111-1111-4111-8111-111111111111/deep/licencia-NESTED123456.jpg',
    '11111111-1111-4111-8111-111111111111');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Nested folder bypass was accepted'; END IF;

 denied:=false;
 BEGIN
  INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES
   ('mobility-staging-driver-evidence',
    '11111111-1111-4111-8111-111111111111/licencia-BADTYPE123456.svg',
    '11111111-1111-4111-8111-111111111111');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Unexpected file extension accepted'; END IF;

 IF has_table_privilege('authenticated','storage.objects','UPDATE')
   OR has_table_privilege('authenticated','storage.objects','DELETE')
 THEN RAISE EXCEPTION 'Driver has unwanted document edit/remove privilege'; END IF;
END
$check$;
SET request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
DO $check$
BEGIN
 IF (SELECT count(*) FROM storage.objects)<>1 THEN
  RAISE EXCEPTION 'Other driver sees first driver private documents'; END IF;
END
$check$;
RESET ROLE;
\echo PASS: G1 private storage owner/JWT RLS, cross-driver denial, path and MIME restrictions.

-- Staging-only application -> pending inventory; no commercial approval.
DO $check$
BEGIN
 IF has_function_privilege('authenticated',
  'public.mobility_stage_vehicle_pending(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_vehicle_pending(uuid,uuid,uuid)','EXECUTE')
 OR has_table_privilege('authenticated','public.mobility_vehicle_intake_audit','SELECT')
 OR has_table_privilege('service_role','public.mobility_vehicle_intake_audit','UPDATE')
 OR has_table_privilege('service_role','public.mobility_vehicle_intake_audit','DELETE')
 THEN RAISE EXCEPTION 'Pending intake function or immutable audit exposed'; END IF;
END
$check$;

SET ROLE service_role;
DO $check$
DECLARE
 application_auto uuid; application_moto uuid; vehicle_auto uuid;
 replay_id uuid; moto_id uuid; rejected boolean;
BEGIN
 SELECT id INTO application_auto FROM public.mobility_vehicle_applications
  WHERE request_key='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 SELECT id INTO application_moto FROM public.mobility_vehicle_applications
  WHERE request_key='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 IF application_auto IS NULL OR application_moto IS NULL
 THEN RAISE EXCEPTION 'Missing synthetic vehicle intake fixtures'; END IF;
 vehicle_auto:=public.mobility_stage_vehicle_pending(
  application_auto,'22222222-2222-4222-8222-222222222222',
  'e1111111-1111-4111-8111-111111111111');
 replay_id:=public.mobility_stage_vehicle_pending(
  application_auto,'22222222-2222-4222-8222-222222222222',
  'e1111111-1111-4111-8111-111111111111');
 IF vehicle_auto<>replay_id OR
   (SELECT review_status FROM public.mobility_vehicles WHERE id=vehicle_auto)
     <>'pending'::public.mobility_review_status
 THEN RAISE EXCEPTION 'Staged vehicle not idempotent or incorrectly approved'; END IF;
 IF (SELECT driver_id FROM public.mobility_vehicles WHERE id=vehicle_auto)
    <>'11111111-1111-4111-8111-111111111111'
 THEN RAISE EXCEPTION 'Wrong driver assigned to draft'; END IF;
 IF (SELECT count(*) FROM public.mobility_vehicle_intake_audit
    WHERE application_id=application_auto)<>1
 THEN RAISE EXCEPTION 'Duplicate materialization audit'; END IF;
 IF (SELECT count(*) FROM public.mobility_vehicles
    WHERE plate_normalized='PRY123')<>1
 THEN RAISE EXCEPTION 'Duplicate plate inventory'; END IF;

 rejected:=false;
 BEGIN
  PERFORM public.mobility_stage_vehicle_pending(
   application_auto,'22222222-2222-4222-8222-222222222222',
   'e2222222-2222-4222-8222-222222222222');
 EXCEPTION WHEN others THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Different key re-staged same application'; END IF;

 rejected:=false;
 BEGIN
  PERFORM public.mobility_stage_vehicle_pending(
   application_moto,'22222222-2222-4222-8222-222222222222',
   'e1111111-1111-4111-8111-111111111111');
 EXCEPTION WHEN others THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Same key reused for another application'; END IF;

 rejected:=false;
 BEGIN
  PERFORM public.mobility_stage_vehicle_pending(
   application_moto,'11111111-1111-4111-8111-111111111111',
   'e3333333-3333-4333-8333-333333333333');
 EXCEPTION WHEN others THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Unprivileged reviewer materialized draft'; END IF;

 moto_id:=public.mobility_stage_vehicle_pending(
   application_moto,'22222222-2222-4222-8222-222222222222',
   'e4444444-4444-4444-8444-444444444444');
 IF (SELECT review_status FROM public.mobility_vehicles WHERE id=moto_id)
    <>'pending'::public.mobility_review_status
 THEN RAISE EXCEPTION 'MOTO was commercially approved by staging'; END IF;
 IF public.mobility_vehicle_preflight(
   '44444444-4444-4444-8444-444444444444',moto_id,'moto_pasajero')
 THEN RAISE EXCEPTION 'MOTO commercial preflight accidentally authorized'; END IF;
END
$check$;
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $check$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.mobility_vehicles
  WHERE plate_normalized IN ('PRY123','MOT999');
 IF n<>0 THEN RAISE EXCEPTION 'Stranger saw new pending vehicles'; END IF;
END
$check$;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $check$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.mobility_vehicles
  WHERE plate_normalized='PRY123';
 IF n<>1 THEN RAISE EXCEPTION 'Owner cannot read pending auto inventory'; END IF;
END
$check$;
RESET ROLE;
\echo PASS: G2 audited application-to-pending inventory, unique vehicle, idempotency, MOTO denied.
