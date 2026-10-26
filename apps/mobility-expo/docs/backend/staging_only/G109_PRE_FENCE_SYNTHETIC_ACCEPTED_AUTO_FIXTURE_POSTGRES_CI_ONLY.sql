-- G109 positive lifecycle fixture — disposable PostgreSQL 16 CI ONLY.
-- Creates an offered synthetic trip BEFORE G38: actual Native Driver G16/G4
-- HTTP accepts it via G120, also BEFORE G38. Later G109 verifies completion
-- with G38 fully active. No certified zone, permits or authentic GPS.
-- NEVER deploy/execute on remote DB or treat this as commercial approval.
-- This fixture makes completion test independent of all historical G20 rows.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g37_state_integrity()') IS NULL
 OR to_regclass('public.mobility_stage_g36_driver_slots') IS NULL
 OR to_regclass('public.mobility_stage_g38_trusted_offer_proofs') IS NOT NULL
 THEN RAISE EXCEPTION 'G109 refuses non-disposable/post-G38 fixture creation'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='30s';
INSERT INTO auth.users(id) VALUES
 ('10900000-0000-4109-8109-000000000021'),
 ('10900000-0000-4109-8109-000000000022');
-- G1 assigns passenger role to every new identity; Driver is exclusive.
DELETE FROM public.user_roles
 WHERE user_id='10900000-0000-4109-8109-000000000022';
INSERT INTO public.user_roles(user_id,role)
 VALUES('10900000-0000-4109-8109-000000000022','driver');
INSERT INTO public.mobility_vehicles(
 id,driver_id,vehicle_kind,service_kind,country_code,municipality_code,
 plate_normalized,brand,model,manufacture_year,passenger_capacity,review_status
) VALUES(
 '10900000-0000-4109-8109-000000000024',
 '10900000-0000-4109-8109-000000000022',
 'AUTO','economico','PY','ASUNCION','G109QA01',
 'SYNTHETIC','SEDAN',2024,4,'approved'
);
INSERT INTO public.mobility_driver_compliance(
 driver_id,license_class,license_valid_through,license_verified_at,
 license_verified_by,driver_review_status
) VALUES(
 '10900000-0000-4109-8109-000000000022','B',CURRENT_DATE+90,
 pg_catalog.clock_timestamp()-interval '1 day',
 '00000000-0000-4000-8000-000000000101','approved'
);
INSERT INTO public.mobility_vehicle_compliance(
 vehicle_id,registration_valid_through,registration_verified_at,
 insurance_valid_through,insurance_verified_at,paid_passenger_insurance_covered,
 inspection_valid_through,inspection_verified_at,
 municipal_authorization_valid_through,municipal_authorization_verified_at,
 reviewed_by,reviewed_at
) VALUES(
 '10900000-0000-4109-8109-000000000024',
 CURRENT_DATE+90,pg_catalog.clock_timestamp()-interval '1 day',
 CURRENT_DATE+90,pg_catalog.clock_timestamp()-interval '1 day',true,
 CURRENT_DATE+90,pg_catalog.clock_timestamp()-interval '1 day',
 CURRENT_DATE+90,pg_catalog.clock_timestamp()-interval '1 day',
 '00000000-0000-4000-8000-000000000101',
 pg_catalog.clock_timestamp()-interval '1 day'
);
INSERT INTO public.mobility_location_consents(driver_id,opted_in_at)
 VALUES('10900000-0000-4109-8109-000000000022',
 pg_catalog.clock_timestamp()-interval '2 days');
INSERT INTO public.driver_locations(driver_id,available,lat,lng,updated_at)
 VALUES('10900000-0000-4109-8109-000000000022',true,
 -25.3,-57.57,pg_catalog.clock_timestamp());

SET LOCAL ROLE service_role;
DO $prepare$
DECLARE
 d uuid:='10900000-0000-4109-8109-000000000022';
 v uuid:='10900000-0000-4109-8109-000000000024';
 p uuid:='10900000-0000-4109-8109-000000000021';
 doc uuid;
 trip uuid;
 offer uuid;
BEGIN
 doc:=public.mobility_stage_register_driver_document(
  d,'10900000-0000-4109-8109-000000000025',
  'licencia',d::text||'/licencia-G109SyntheticEvidence123.jpg',
  'image/jpeg',9800,repeat('a',64));
 PERFORM public.mobility_stage_review_driver_document(
  doc,'00000000-0000-4000-8000-000000000101',true,'DOCUMENT_VALID',
  '10900000-0000-4109-8109-000000000026');
 IF NOT public.mobility_stage_driver_current_license_approved(d)
 OR NOT public.mobility_vehicle_preflight(d,v,'economico')
 THEN RAISE EXCEPTION 'G109 synthetic QA KYC/preflight failed'; END IF;
 trip:=public.mobility_stage_auto_demo_request(
  p,'10900000-0000-4109-8109-000000000023',
  'CENTRO_FIXTURE','AEROPUERTO','economico');
 offer:=public.mobility_stage_auto_demo_offer(
  trip,d,v,'10900000-0000-4109-8109-000000000027',30);
 IF offer IS NULL
 OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_trips t
  WHERE t.id=trip AND t.status='searching' AND t.revision=1
  AND t.driver_id IS NULL AND t.passenger_id=p)
 THEN RAISE EXCEPTION 'G109 pre-fence offered trip not persisted'; END IF;
 RAISE NOTICE 'G109 fixture PASS: pre-G38 synthetic AUTO waiting for native Driver G120 acceptance';
END $prepare$;
RESET ROLE;
-- Positive acceptance is never inserted by this SQL fixture. Real native
-- client HTTP must perform it in the very next isolated CI step; this table
-- remains private from the service-role HTTP runtime.
DO $audit$
DECLARE t uuid;
BEGIN
 SELECT id INTO t FROM public.mobility_stage_auto_demo_trips
 WHERE request_key='10900000-0000-4109-8109-000000000023';
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g36_driver_slots s
  WHERE s.driver_id='10900000-0000-4109-8109-000000000022'
  AND s.assignment_kind='AUTO_RIDE' AND s.assignment_id=t)
 THEN RAISE EXCEPTION 'G109 must not pre-create Driver acceptance'; END IF;
END $audit$;
COMMIT;
