-- Postgres 16 disposable fixture ONLY. Two-role AUTO trip lifecycle.
-- The schema is never applied remotely by this test.
DO $check$
BEGIN
 IF has_function_privilege('authenticated',
  'public.mobility_stage_auto_demo_request(uuid,uuid,text,text,public.mobility_service_kind)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_auto_demo_accept(uuid,uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_auto_demo_transition(uuid,uuid,public.mobility_stage_trip_status,uuid)','EXECUTE')
 OR has_table_privilege('authenticated','public.mobility_stage_auto_demo_trips','INSERT')
 OR has_table_privilege('authenticated','public.mobility_stage_auto_demo_trips','UPDATE')
 OR has_table_privilege('authenticated','public.mobility_stage_auto_demo_events','SELECT')
 OR has_table_privilege('service_role','public.mobility_stage_auto_demo_events','UPDATE')
 OR has_table_privilege('service_role','public.mobility_stage_auto_demo_events','DELETE')
 THEN RAISE EXCEPTION 'G3 demo trip grant/RLS incorrectly exposed'; END IF;
END $check$;

-- G2 compliance fixture deliberately revoked GPS consent earlier; restore only
-- synthetic values for this ephemeral PostgreSQL G3 contract test.
UPDATE public.mobility_location_consents SET revoked_at=NULL
 WHERE driver_id='11111111-1111-4111-8111-111111111111';
UPDATE public.driver_locations SET updated_at=now()-interval '2 seconds'
 WHERE driver_id='11111111-1111-4111-8111-111111111111';

-- Independently eligible SECOND fictional AUTO driver. This is not a real KYC.
INSERT INTO public.mobility_vehicles
 (id,driver_id,vehicle_kind,service_kind,municipality_code,plate_normalized,
  brand,model,manufacture_year,passenger_capacity,review_status)
VALUES
 ('77777777-7777-4777-8777-777777777777',
  '44444444-4444-4444-8444-444444444444',
  'AUTO','economico','ASUNCION','CISECOND7','Nissan','March',2021,4,'approved');
INSERT INTO public.mobility_driver_compliance
 (driver_id,license_class,license_valid_through,license_verified_at,
  license_verified_by,driver_review_status)
VALUES
 ('44444444-4444-4444-8444-444444444444',
  'PROFESIONAL',CURRENT_DATE+30,now()-interval '1 day',
  '22222222-2222-4222-8222-222222222222','approved');
INSERT INTO public.mobility_vehicle_compliance
 (vehicle_id,registration_valid_through,registration_verified_at,
  insurance_valid_through,insurance_verified_at,paid_passenger_insurance_covered,
  inspection_valid_through,inspection_verified_at,municipal_authorization_valid_through,
  municipal_authorization_verified_at,reviewed_by)
VALUES
 ('77777777-7777-4777-8777-777777777777',
  CURRENT_DATE+30,now()-interval '1 day',
  CURRENT_DATE+30,now()-interval '1 day',true,
  CURRENT_DATE+30,now()-interval '1 day',
  CURRENT_DATE+30,now()-interval '1 day',
  '22222222-2222-4222-8222-222222222222');
INSERT INTO public.driver_locations(driver_id,available,lat,lng,updated_at)
VALUES ('44444444-4444-4444-8444-444444444444',true,-25.29,-57.58,
 now()-interval '2 seconds');
INSERT INTO public.mobility_location_consents(driver_id,opted_in_at)
VALUES ('44444444-4444-4444-8444-444444444444',now()-interval '1 hour');


SET ROLE service_role;
DO $check$
DECLARE
 trip uuid; again uuid; other_trip uuid; event_a uuid; replay_a uuid;
 blocked boolean;
BEGIN
 IF NOT public.mobility_vehicle_preflight(
  '11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555','economico'
 ) OR NOT public.mobility_vehicle_preflight(
  '44444444-4444-4444-8444-444444444444',
  '77777777-7777-4777-8777-777777777777','economico')
 THEN RAISE EXCEPTION 'Two independently eligible fictional AUTO drivers required'; END IF;
 trip:=public.mobility_stage_auto_demo_request(
  '33333333-3333-4333-8333-333333333333',
  'a1000000-0000-4000-8000-000000000001','PANTEON','SHOPPING','economico');
 again:=public.mobility_stage_auto_demo_request(
  '33333333-3333-4333-8333-333333333333',
  'a1000000-0000-4000-8000-000000000001','PANTEON','SHOPPING','economico');
 IF trip<>again OR (SELECT count(*) FROM public.mobility_stage_auto_demo_trips
     WHERE passenger_id='33333333-3333-4333-8333-333333333333')<>1
 THEN RAISE EXCEPTION 'Duplicate G3 request was not idempotent'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_request(
   '33333333-3333-4333-8333-333333333333',
   'a1000000-0000-4000-8000-000000000002','PANTEON','SHOPPING','economico');
 EXCEPTION WHEN unique_violation THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Passenger opened two simultaneous demo trips'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_request(
   '33333333-3333-4333-8333-333333333333',
   'a1000000-0000-4000-8000-000000000001','PANTEON','AIRPORT','economico');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G3 request idempotency accepted different route'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_request(
   '33333333-3333-4333-8333-333333333333',
   'a1000000-0000-4000-8000-000000000003','PANTEON','SHOPPING','moto_pasajero');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G3 MOTO commercial route opened'; END IF;

 -- A second driver must not claim the FIRST driver's vehicle, even if both
 -- are independently eligible for the same AUTO service.
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_accept(
   trip,'44444444-4444-4444-8444-444444444444',
   '55555555-5555-4555-8555-555555555555',
   'a2000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G3 foreign vehicle was accepted'; END IF;

 event_a:=public.mobility_stage_auto_demo_accept(
  trip,'11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555',
  'a2000000-0000-4000-8000-000000000002');
 replay_a:=public.mobility_stage_auto_demo_accept(
  trip,'11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555',
  'a2000000-0000-4000-8000-000000000002');
 IF event_a<>replay_a OR
   (SELECT status FROM public.mobility_stage_auto_demo_trips WHERE id=trip)<>'accepted'
 OR (SELECT revision FROM public.mobility_stage_auto_demo_trips WHERE id=trip)<>2
 THEN RAISE EXCEPTION 'Assignment retry duplicated or failed'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_accept(
   trip,'11111111-1111-4111-8111-111111111111',
   '55555555-5555-4555-8555-555555555555',
   'a2000000-0000-4000-8000-000000000003');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Second assignment replaced winner'; END IF;

 -- A second passenger may request but same busy driver cannot accept twice.
 other_trip:=public.mobility_stage_auto_demo_request(
  '44444444-4444-4444-8444-444444444444',
  'a1000000-0000-4000-8000-000000000004','PANTEON','TERMINAL','economico');
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_accept(
   other_trip,'11111111-1111-4111-8111-111111111111',
   '55555555-5555-4555-8555-555555555555',
   'a2000000-0000-4000-8000-000000000004');
 EXCEPTION WHEN unique_violation THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'One driver assigned to two active G3 trips'; END IF;

 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_transition(
   trip,'33333333-3333-4333-8333-333333333333','in_progress',
   'a3000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Passenger forged driver START event'; END IF;

 PERFORM public.mobility_stage_auto_demo_transition(
  trip,'11111111-1111-4111-8111-111111111111','arriving',
  'a3000000-0000-4000-8000-000000000002');
 PERFORM public.mobility_stage_auto_demo_transition(
  trip,'11111111-1111-4111-8111-111111111111','in_progress',
  'a3000000-0000-4000-8000-000000000003');
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_transition(
   trip,'33333333-3333-4333-8333-333333333333','cancelled',
   'a3000000-0000-4000-8000-000000000004');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Passenger cancelled journey already in progress'; END IF;
 PERFORM public.mobility_stage_auto_demo_transition(
  trip,'11111111-1111-4111-8111-111111111111','completed',
  'a3000000-0000-4000-8000-000000000005');
 IF (SELECT revision FROM public.mobility_stage_auto_demo_trips WHERE id=trip)<>5
 OR (SELECT status FROM public.mobility_stage_auto_demo_trips WHERE id=trip)<>'completed'
 OR (SELECT count(*) FROM public.mobility_stage_auto_demo_events WHERE trip_id=trip)<>4
 THEN RAISE EXCEPTION 'Invalid completed demo trip and append-only trace'; END IF;
 -- Completed passenger can request another fake AUTO journey for two-driver race.
 IF public.mobility_stage_auto_demo_request(
  '33333333-3333-4333-8333-333333333333',
  'a1000000-0000-4000-8000-000000000005',
  'PANTEON','AIRPORT','economico') IS NULL
 THEN RAISE EXCEPTION 'Next pending fake AUTO race trip not created'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_transition(
   trip,'11111111-1111-4111-8111-111111111111','arriving',
   'a3000000-0000-4000-8000-000000000006');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Completed demo trip was reopened'; END IF;
END
$check$;
RESET ROLE;

-- SELECT allowed only for trip passenger or assigned driver; no event reads.
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $check$ BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_auto_demo_trips)<>2
 THEN RAISE EXCEPTION 'Passenger sees wrong number of own demo trips'; END IF;
END $check$;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $check$ BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_auto_demo_trips)<>1
 THEN RAISE EXCEPTION 'Driver saw unrelated passenger demo trip'; END IF;
END $check$;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $check$ BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_auto_demo_trips)<>0
 THEN RAISE EXCEPTION 'Administrator bypassed own-trip RLS read restriction'; END IF;
END $check$;
RESET ROLE;
\echo PASS: G3 AUTO demo-only PostgreSQL request, atomic single-driver assignment, state machine, RLS and no MOTO.
