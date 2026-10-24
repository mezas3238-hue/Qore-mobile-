-- G35 source-backed QA: license, cargo insurance, cross-service, occupancy,
-- consent revision, no passenger-moto, no commercial eligibility.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G35 asserts refuse non-disposable database'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
INSERT INTO auth.users(id) VALUES
 ('e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1'),
 ('e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2'),
 ('e3e3e3e3-e3e3-4e3e-8e3e-e3e3e3e3e3e3'),
 ('e4e4e4e4-e4e4-4e4e-8e4e-e4e4e4e4e4e4')
 ON CONFLICT(id) DO NOTHING;
DELETE FROM public.user_roles WHERE user_id IN(
 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
 'e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2',
 'e3e3e3e3-e3e3-4e3e-8e3e-e3e3e3e3e3e3');
INSERT INTO public.user_roles(user_id,role) VALUES
 ('e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1','driver'),
 ('e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2','admin');
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
 VALUES ('e3e3e3e3-e3e3-4e3e-8e3e-e3e3e3e3e3e3','admin','active',
 'e4e4e4e4-e4e4-4e4e-8e4e-e4e4e4e4e4e4');

INSERT INTO public.mobility_location_consents(driver_id,opted_in_at)
 VALUES('e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
 clock_timestamp()-interval '1 hour');
INSERT INTO public.driver_locations(driver_id,available,lat,lng,updated_at)
 VALUES('e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',true,
 -25.3,-57.6,clock_timestamp()-interval '1 second');

INSERT INTO public.mobility_stage_g31_zone_coverage(
 zone_id,municipality,service_kind,coverage_status
) VALUES
 ('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5','Asuncion','AUTO_DELIVERY','PLANNED'),
 ('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5','Asuncion','MOTO_DELIVERY','PLANNED'),
 ('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5','Asuncion','AUTO_RIDE','PLANNED');

INSERT INTO public.mobility_vehicles
 (id,driver_id,vehicle_kind,service_kind,country_code,municipality_code,
 plate_normalized,brand,model,manufacture_year,passenger_capacity,
 review_status)
 VALUES
 ('e6e6e6e6-e6e6-4e6e-8e6e-e6e6e6e6e6e6',
 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1','AUTO',
 'economico','PY','ASUNCION','G35AUTO001','TEST','CAR',2022,4,'pending'),
 ('e7e7e7e7-e7e7-4e7e-8e7e-e7e7e7e7e7e7',
 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1','MOTO',
 'moto_pasajero','PY','ASUNCION','G35MOTO001','TEST','BIKE',2022,1,'pending');

INSERT INTO public.mobility_driver_compliance(
 driver_id,license_class,license_valid_through,license_verified_at,
 license_verified_by,driver_review_status
)VALUES('e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
 'B',CURRENT_DATE+90,clock_timestamp()-interval '2 minutes',
 'e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2','approved');
INSERT INTO public.mobility_stage_delivery_vehicle_clearance(
 vehicle_id,delivery_authorized,cargo_insurance_valid_through,
 cargo_insurance_verified_at,max_grams,max_volume_cm3,max_edge_cm,
 reviewed_by,reviewed_at)
 SELECT id,true,CURRENT_DATE+90,clock_timestamp()-interval '2 minutes',
  5000,100000,60,
  'e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2',
  clock_timestamp()-interval '1 minute'
 FROM public.mobility_vehicles WHERE id IN (
 'e6e6e6e6-e6e6-4e6e-8e6e-e6e6e6e6e6e6',
 'e7e7e7e7-e7e7-4e7e-8e7e-e7e7e7e7e7e7');

INSERT INTO public.mobility_stage_g32_signal_quarantine(
 event_id,driver_id,sequence,captured_at,zone_id,service_kind,
 consent_revision,geometry_revision)
 VALUES('e8e8e8e8-e8e8-4e8e-8e8e-e8e8e8e8e8e8',
 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',1,
 clock_timestamp()-interval '2 seconds',
 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5','AUTO_DELIVERY',1,1);
INSERT INTO public.mobility_stage_g32_signal_state(
 driver_id,last_sequence,last_captured_at,last_event_id)
 SELECT driver_id,sequence,captured_at,event_id
 FROM public.mobility_stage_g32_signal_quarantine
 WHERE event_id='e8e8e8e8-e8e8-4e8e-8e8e-e8e8e8e8e8e8';

DO $private$
BEGIN
 IF has_function_privilege('authenticated',
  'public.mobility_stage_g35_driver_documentary_diagnostic(uuid,uuid,uuid,text,bigint)',
  'EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_g35_driver_documentary_diagnostic(uuid,uuid,uuid,text,bigint)',
  'EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.mobility_stage_g35_driver_documentary_diagnostic(uuid,uuid,uuid,text,bigint)',
  'EXECUTE')
 THEN RAISE EXCEPTION 'G35 private evidence probe exposed to app roles'; END IF;
END $private$;

SET LOCAL ROLE service_role;
DO $missing$
DECLARE d jsonb;
BEGIN
 d:=public.mobility_stage_g35_driver_documentary_diagnostic(
  'e3e3e3e3-e3e3-4e3e-8e3e-e3e3e3e3e3e3',
  'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
  'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5','AUTO_DELIVERY',
  floor(extract(epoch FROM clock_timestamp())*1000)::bigint);
 IF (SELECT count(*) FROM pg_catalog.jsonb_object_keys(d))<>10 OR
 d->>'hasFreshQuarantinedSignal'<>'true' OR
 d->>'hasCurrentLocationConsent'<>'true' OR
 d->>'freeOfActiveAssignments'<>'true' OR
 d->>'vehicleDocumentEvidenceReviewed'<>'false' OR
 d->>'candidateEvidenceComplete'<>'false' OR
 d->>'dispatchAuthorized'<>'false' OR
 d->>'availabilityConfirmed'<>'false'
 THEN RAISE EXCEPTION 'G35 fabricated vehicle evidence with pending license %',d; END IF;
END $missing$;
RESET ROLE;

-- Review the newest synthetic private license with G17's genuine audit RPC.
SELECT public.mobility_stage_register_driver_document(
 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
 'e9e9e9e9-e9e9-4e9e-8e9e-e9e9e9e9e9e9',
 'licencia',
 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1/licencia-G35SyntheticReview123.jpg',
 'image/jpeg',10412,repeat('a',64));
SELECT public.mobility_stage_review_driver_document(
 (SELECT id FROM public.mobility_stage_driver_documents
  WHERE request_key='e9e9e9e9-e9e9-4e9e-8e9e-e9e9e9e9e9e9'),
 'e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2',
 true,'DOCUMENT_VALID',
 'eaeaeaea-eaea-4eae-8eae-eaeaeaeaeaea');

SET LOCAL ROLE service_role;
DO $documented$
DECLARE d jsonb;
BEGIN
 d:=public.mobility_stage_g35_driver_documentary_diagnostic(
  'e3e3e3e3-e3e3-4e3e-8e3e-e3e3e3e3e3e3',
  'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
  'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5','AUTO_DELIVERY',
  floor(extract(epoch FROM clock_timestamp())*1000)::bigint);
 IF d->>'vehicleDocumentEvidenceReviewed'<>'true'
 OR d->>'candidateEvidenceComplete'<>'true'
 OR d->>'zoneEligibleByPolicy'<>'false'
 OR d->>'availabilityConfirmed'<>'false'
 OR d->>'dispatchAuthorized'<>'false'
 OR d->>'productionEnabled'<>'false'
 THEN RAISE EXCEPTION 'G35 valid synthetic cargo not distinguished from dispatch approval %',d; END IF;
END $documented$;
RESET ROLE;

INSERT INTO public.mobility_stage_auto_demo_trips(
 id,request_key,passenger_id,driver_id,vehicle_id,
 service,origin_tag,destination_tag,status)
VALUES('ebebebeb-ebeb-4beb-8beb-ebebebebebeb',
 'ecececec-ecec-4cec-8cec-ecececececec',
 'e4e4e4e4-e4e4-4e4e-8e4e-e4e4e4e4e4e4',
 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
 'e6e6e6e6-e6e6-4e6e-8e6e-e6e6e6e6e6e6','economico',
 'QA_PICKUP','QA_DROPOFF','accepted');
SET LOCAL ROLE service_role;
DO $busy$
DECLARE d jsonb;
BEGIN
 d:=public.mobility_stage_g35_driver_documentary_diagnostic(
  'e3e3e3e3-e3e3-4e3e-8e3e-e3e3e3e3e3e3',
  'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
  'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5','AUTO_DELIVERY',
  floor(extract(epoch FROM clock_timestamp())*1000)::bigint);
 IF d->>'freeOfActiveAssignments'<>'false'
 OR d->>'candidateEvidenceComplete'<>'false'
 OR d->>'vehicleDocumentEvidenceReviewed'<>'true'
 THEN RAISE EXCEPTION 'G35 busy trip improperly shown as idle %',d; END IF;
END $busy$;
RESET ROLE;
DELETE FROM public.mobility_stage_auto_demo_trips
 WHERE id='ebebebeb-ebeb-4beb-8beb-ebebebebebeb';

UPDATE public.mobility_stage_delivery_vehicle_clearance
 SET cargo_insurance_valid_through=CURRENT_DATE-1
 WHERE vehicle_id='e6e6e6e6-e6e6-4e6e-8e6e-e6e6e6e6e6e6';
SET LOCAL ROLE service_role;
DO $expired$
DECLARE d jsonb;
BEGIN
 d:=public.mobility_stage_g35_driver_documentary_diagnostic(
  'e3e3e3e3-e3e3-4e3e-8e3e-e3e3e3e3e3e3',
  'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
  'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5','AUTO_DELIVERY',
  floor(extract(epoch FROM clock_timestamp())*1000)::bigint);
 IF d->>'vehicleDocumentEvidenceReviewed'<>'false'
 OR d->>'candidateEvidenceComplete'<>'false'
 THEN RAISE EXCEPTION 'G35 expired cargo coverage accepted %',d; END IF;
END $expired$;
RESET ROLE;

-- Driver initially has a current signal only for AUTO_DELIVERY, never
-- MOTO_DELIVERY or AUTO_RIDE. A passenger MOTO is never inferred from cargo.
SET LOCAL ROLE service_role;
DO $cross_service$
DECLARE d jsonb;
BEGIN
 d:=public.mobility_stage_g35_driver_documentary_diagnostic(
  'e3e3e3e3-e3e3-4e3e-8e3e-e3e3e3e3e3e3',
  'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
  'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5','MOTO_DELIVERY',
  floor(extract(epoch FROM clock_timestamp())*1000)::bigint);
 IF d->>'hasFreshQuarantinedSignal'<>'false' OR
 d->>'candidateEvidenceComplete'<>'false'
 THEN RAISE EXCEPTION 'G35 borrowed AUTO signal for MOTO_DELIVERY %',d; END IF;
 d:=public.mobility_stage_g35_driver_documentary_diagnostic(
  'e3e3e3e3-e3e3-4e3e-8e3e-e3e3e3e3e3e3',
  'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
  'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5','AUTO_RIDE',
  floor(extract(epoch FROM clock_timestamp())*1000)::bigint);
 IF d->>'vehicleDocumentEvidenceReviewed'<>'false'
 THEN RAISE EXCEPTION 'G35 cargo coverage falsely enabled passenger AUTO ride'; END IF;
END $cross_service$;
RESET ROLE;

UPDATE public.mobility_location_consents SET revoked_at=clock_timestamp()
 WHERE driver_id='e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1';
SET LOCAL ROLE service_role;
DO $consent$
DECLARE d jsonb;
BEGIN
 d:=public.mobility_stage_g35_driver_documentary_diagnostic(
  'e3e3e3e3-e3e3-4e3e-8e3e-e3e3e3e3e3e3',
  'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
  'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5','AUTO_DELIVERY',
  floor(extract(epoch FROM clock_timestamp())*1000)::bigint);
 IF d->>'hasCurrentLocationConsent'<>'false' OR
 d->>'candidateEvidenceComplete'<>'false'
 THEN RAISE EXCEPTION 'G35 consent withdrawal still considered valid %',d; END IF;
END $consent$;
RESET ROLE;

DO $acl$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g35_driver_documentary_diagnostic(
   'e4e4e4e4-e4e4-4e4e-8e4e-e4e4e4e4e4e4',
   'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
   'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5','AUTO_DELIVERY',
   floor(extract(epoch FROM clock_timestamp())*1000)::bigint);
 EXCEPTION WHEN SQLSTATE 'G3501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G35 native passenger accessed private probe'; END IF;
END $acl$;
DO $no_promotion$
BEGIN
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g31_zone_observations
 WHERE zone_id='e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5')
 THEN RAISE EXCEPTION 'G35 readiness diagnostic wrote availability'; END IF;
 RAISE NOTICE 'G35 PASS: reviewed cargo/Driver evidence necessary but never sufficient, busy trip, expiry, consent and cross-service blocked';
END $no_promotion$;
ROLLBACK;
