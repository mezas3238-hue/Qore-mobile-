-- G36 real QA: backfill active Driver, no direct-slot grants,
-- same-Driver cross-service denial, release/reassignment and idempotency.
-- ALL fixture effects ROLLBACK in disposable PostgreSQL only.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
  current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G36 assertions refuse non-disposable database'; END IF;
 IF to_regclass('public.mobility_stage_g36_driver_slots') IS NULL
 THEN RAISE EXCEPTION 'G36 cross-service slots absent'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
DO $privileges$
BEGIN
 IF has_table_privilege('service_role',
  'public.mobility_stage_g36_driver_slots','INSERT')
 OR has_table_privilege('service_role',
  'public.mobility_stage_g36_driver_slots','UPDATE')
 OR has_table_privilege('service_role',
  'public.mobility_stage_g36_driver_slots','DELETE')
 OR has_table_privilege('authenticated',
  'public.mobility_stage_g36_driver_slots','SELECT')
 OR has_table_privilege('authenticated',
  'public.mobility_stage_g36_driver_slots','INSERT')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g36_claim_driver_slot()','EXECUTE')
 THEN RAISE EXCEPTION 'G36 slot can be directly forged or read by browser'; END IF;
END $privileges$;

DO $prior$
DECLARE old_trip uuid;
BEGIN
 SELECT t.id INTO old_trip FROM public.mobility_stage_auto_demo_trips t
 WHERE t.request_key='00000000-0000-4000-8000-000000000243';
 IF old_trip IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.mobility_stage_g36_driver_slots s
  WHERE s.driver_id='00000000-0000-4000-8000-000000000181'
  AND s.assignment_kind='AUTO_RIDE' AND s.assignment_id=old_trip)
 THEN RAISE EXCEPTION 'G36 historical G20 active AUTO was not adopted'; END IF;
END $prior$;

INSERT INTO auth.users(id) VALUES
 ('f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1'),
 ('f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2')
ON CONFLICT(id) DO NOTHING;
-- AUTO_RIDE and DELIVERY IDs are drawn from independent UUID namespaces.
-- Different Drivers may coincidentally have the same assignment_id in two
-- different services: that must not create a false global collision.
INSERT INTO public.mobility_stage_g36_driver_slots(
 driver_id,assignment_kind,assignment_id
) VALUES
 ('f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1','AUTO_RIDE',
  'fcfcfcfc-fcfc-4cfc-8cfc-fcfcfcfcfcfc'),
 ('f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2','DELIVERY',
  'fcfcfcfc-fcfc-4cfc-8cfc-fcfcfcfcfcfc');
DO $independent_ids$
BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_g36_driver_slots
    WHERE assignment_id='fcfcfcfc-fcfc-4cfc-8cfc-fcfcfcfcfcfc')<>2
 THEN RAISE EXCEPTION 'G36 incorrectly made independently typed IDs globally unique'; END IF;
END $independent_ids$;
DELETE FROM public.mobility_stage_g36_driver_slots
 WHERE driver_id IN(
 'f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1',
 'f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2');
-- Car 184 is independently authorized for AUTO ride in G20; cargo requires
-- separately reviewed G5 insurance, never inherited from passenger insurance.
INSERT INTO public.mobility_stage_delivery_vehicle_clearance(
 vehicle_id,delivery_authorized,cargo_insurance_valid_through,
 cargo_insurance_verified_at,max_grams,max_volume_cm3,max_edge_cm,
 reviewed_by,reviewed_at
) VALUES (
 '00000000-0000-4000-8000-000000000184',true,CURRENT_DATE+90,
 clock_timestamp()-interval '10 minutes',5000,100000,60,
 '00000000-0000-4000-8000-000000000101',
 clock_timestamp()-interval '5 minutes'
) ON CONFLICT(vehicle_id) DO UPDATE SET
 delivery_authorized=true,cargo_insurance_valid_through=CURRENT_DATE+90,
 cargo_insurance_verified_at=clock_timestamp()-interval '10 minutes',
 max_grams=5000,max_volume_cm3=100000,max_edge_cm=60,
 reviewed_by='00000000-0000-4000-8000-000000000101',
 reviewed_at=clock_timestamp()-interval '5 minutes';

-- Test owner (disposable superuser) observes private slots directly.
-- Concurrent service_role acceptance is separately tested with two sessions.
DO $checks$
DECLARE
 driver uuid:='00000000-0000-4000-8000-000000000181';
 vehicle uuid:='00000000-0000-4000-8000-000000000184';
 passenger uuid:='00000000-0000-4000-8000-000000000241';
 trip_old uuid;
 delivery_id uuid;
 trip_new uuid;
 first_receipt uuid;
 second_receipt uuid;
 denied boolean;
BEGIN
 SELECT id INTO trip_old FROM public.mobility_stage_auto_demo_trips
 WHERE request_key='00000000-0000-4000-8000-000000000243';
 SELECT public.mobility_stage_delivery_request(
  'f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1',
  'f3f3f3f3-f3f3-4f3f-8f3f-f3f3f3f3f3f3',
  'AUTO','PARCEL',450,10,10,10,'CENTRO','LAMBRARE',false)
 INTO delivery_id;
 -- AUTO ride already active => courier preflight must deny this selected car.
 IF public.mobility_stage_delivery_courier_preflight(driver,vehicle,delivery_id)
 THEN RAISE EXCEPTION 'G36 cargo preflight ignored active passenger job'; END IF;
 -- Attempt to bypass original accept RPC with a direct service_role DML:
 -- G36 trigger independently rejects the same Driver on two assignments.
 denied:=false;
 BEGIN
  UPDATE public.mobility_stage_deliveries
  SET courier_id=driver,vehicle_id=vehicle,status='accepted'
  WHERE id=delivery_id;
 EXCEPTION WHEN SQLSTATE 'G3601' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G36 direct delivery update bypassed preflight'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_g36_driver_slots
  WHERE driver_id=driver)<>1
 THEN RAISE EXCEPTION 'G36 direct attack altered slot'; END IF;

 -- A passenger cancellation legitimately releases the AUTO slot.
 PERFORM public.mobility_stage_auto_demo_transition(
  trip_old,passenger,'cancelled',
  'f4f4f4f4-f4f4-4f4f-8f4f-f4f4f4f4f4f4');
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g36_driver_slots
  WHERE driver_id=driver)
 THEN RAISE EXCEPTION 'G36 AUTO cancellation did not free slot'; END IF;
 IF NOT public.mobility_stage_delivery_courier_preflight(driver,vehicle,delivery_id)
 THEN RAISE EXCEPTION 'G36 expected eligible AUTO courier after ride release'; END IF;
 first_receipt:=public.mobility_stage_delivery_accept(
  delivery_id,driver,vehicle,
  'f5f5f5f5-f5f5-4f5f-8f5f-f5f5f5f5f5f5');
 second_receipt:=public.mobility_stage_delivery_accept(
  delivery_id,driver,vehicle,
  'f5f5f5f5-f5f5-4f5f-8f5f-f5f5f5f5f5f5');
 IF first_receipt IS NULL OR second_receipt<>first_receipt
 THEN RAISE EXCEPTION 'G36 delivery receipt idempotence broke'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.mobility_stage_g36_driver_slots s
  WHERE s.driver_id=driver AND s.assignment_kind='DELIVERY'
  AND s.assignment_id=delivery_id)
 THEN RAISE EXCEPTION 'G36 accepted cargo failed atomic slot claim'; END IF;

 SELECT public.mobility_stage_auto_demo_request(
  'f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2',
  'f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6',
  'CENTRO','LAMBRARE','economico') INTO trip_new;
 IF NOT public.mobility_vehicle_preflight(driver,vehicle,'economico')
 THEN RAISE EXCEPTION 'G36 AUTO baseline KYC unexpectedly failed'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_accept(
   trip_new,driver,vehicle,
   'f7f7f7f7-f7f7-4f7f-8f7f-f7f7f7f7f7f7');
 EXCEPTION WHEN SQLSTATE 'G3601' THEN denied:=true; END;
 IF NOT denied
 THEN RAISE EXCEPTION 'G36 Driver double-booked across active courier and AUTO'; END IF;
 IF (SELECT status FROM public.mobility_stage_auto_demo_trips WHERE id=trip_new)
 <>'searching'
 THEN RAISE EXCEPTION 'G36 blocked AUTO request mutated status'; END IF;

 -- Courier pickup and delivery with synthetic receipt release its slot.
 PERFORM public.mobility_stage_delivery_transition(
  delivery_id,driver,'pickup',
  'f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f8f8');
 PERFORM public.mobility_stage_delivery_transition(
  delivery_id,driver,'deliver',
  'f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f9f9',
  'fafafafa-fafa-4afa-8afa-fafafafafafa');
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g36_driver_slots
  WHERE driver_id=driver)
 THEN RAISE EXCEPTION 'G36 terminal cargo did not release Driver'; END IF;
 first_receipt:=public.mobility_stage_auto_demo_accept(
  trip_new,driver,vehicle,
  'fbfbfbfb-fbfb-4fbf-8fbf-fbfbfbfbfbfb');
 second_receipt:=public.mobility_stage_auto_demo_accept(
  trip_new,driver,vehicle,
  'fbfbfbfb-fbfb-4fbf-8fbf-fbfbfbfbfbfb');
 IF first_receipt IS NULL OR first_receipt<>second_receipt OR
  NOT EXISTS(SELECT 1 FROM public.mobility_stage_g36_driver_slots s
   WHERE s.driver_id=driver AND s.assignment_kind='AUTO_RIDE'
    AND s.assignment_id=trip_new)
 THEN RAISE EXCEPTION 'G36 rightful AUTO reassignment/idempotence failed'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_g36_driver_slots
    WHERE driver_id=driver)<>1
 THEN RAISE EXCEPTION 'G36 multiple active Driver reservations exist'; END IF;
 RAISE NOTICE 'G36 PASS: backfill, cross-service denial, direct write denial, idempotent receipt, terminal release and reassignment';
END $checks$;
ROLLBACK;
