-- G12 REAL-SCHEMA delivery E2E, strictly synthetic PostgreSQL CI.
-- Requires G0 scaffold and real G1/G2/G3/G4/G5/G10/G12, never use remotely.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'Not a disposable CI full-chain database'; END IF;
END $guard$;

-- Actors are synthetic UUIDs only; auth.users is a CI-only stand-in.
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-000000000101'), -- reviewer/admin
 ('00000000-0000-4000-8000-000000000102'), -- sender
 ('00000000-0000-4000-8000-000000000103'); -- courier
INSERT INTO public.user_roles(user_id,role) VALUES
 ('00000000-0000-4000-8000-000000000101','admin'),
 ('00000000-0000-4000-8000-000000000103','driver');

INSERT INTO public.mobility_vehicles
 (id,driver_id,vehicle_kind,service_kind,country_code,municipality_code,
  plate_normalized,brand,model,manufacture_year,passenger_capacity,review_status)
VALUES
 ('00000000-0000-4000-8000-000000000104',
  '00000000-0000-4000-8000-000000000103',
  'MOTO','moto_pasajero','PY','ASUNCION','QORE103','DEMO','CARGO',2024,1,'approved');
INSERT INTO public.mobility_driver_compliance
 (driver_id,license_class,license_valid_through,license_verified_at,
  license_verified_by,driver_review_status)
VALUES
 ('00000000-0000-4000-8000-000000000103','M',CURRENT_DATE+90,
  pg_catalog.clock_timestamp()-interval '1 day',
  '00000000-0000-4000-8000-000000000101','approved');
INSERT INTO public.mobility_stage_delivery_vehicle_clearance
 (vehicle_id,delivery_authorized,cargo_insurance_valid_through,
  cargo_insurance_verified_at,max_grams,max_volume_cm3,max_edge_cm,
  reviewed_by,reviewed_at)
VALUES
 ('00000000-0000-4000-8000-000000000104',true,CURRENT_DATE+90,
  pg_catalog.clock_timestamp()-interval '1 day',10000,45000,60,
  '00000000-0000-4000-8000-000000000101',
  pg_catalog.clock_timestamp()-interval '2 minutes');
INSERT INTO public.driver_locations(driver_id,available,lat,lng,updated_at)
VALUES ('00000000-0000-4000-8000-000000000103',true,-25.3,-57.57,
 pg_catalog.clock_timestamp()-interval '5 seconds');
INSERT INTO public.mobility_location_consents(driver_id,opted_in_at)
VALUES ('00000000-0000-4000-8000-000000000103',
 pg_catalog.clock_timestamp()-interval '1 day');

SET ROLE service_role;
DO $assert$
DECLARE sender uuid:='00000000-0000-4000-8000-000000000102';
 courier uuid:='00000000-0000-4000-8000-000000000103';
 vehicle uuid:='00000000-0000-4000-8000-000000000104';
 worker uuid:='00000000-0000-4000-8000-000000000111';
 stranger uuid:='00000000-0000-4000-8000-000000000112';
 delivery_id uuid;
 offer_id uuid;
 event_id uuid;
 claim record;
 n integer;
BEGIN
 IF public.mobility_vehicle_preflight(courier,vehicle,'moto_pasajero')
 THEN RAISE EXCEPTION 'Cargo permission enabled MOTO passenger service'; END IF;

 SELECT public.mobility_stage_delivery_request(sender,
   '00000000-0000-4000-8000-000000000105','MOTO','DOCUMENTS',
   500,10,10,5,'CENTRO','SAN_LORENZO',false) INTO delivery_id;
 IF delivery_id IS NULL THEN RAISE EXCEPTION 'G5 delivery request failed'; END IF;
 IF (SELECT public.mobility_stage_delivery_request(sender,
   '00000000-0000-4000-8000-000000000105','MOTO','DOCUMENTS',
   500,10,10,5,'CENTRO','SAN_LORENZO',false))<>delivery_id
 THEN RAISE EXCEPTION 'G5 request idempotency failed'; END IF;
 IF NOT public.mobility_stage_delivery_courier_preflight(courier,vehicle,delivery_id)
 THEN RAISE EXCEPTION 'G5 compliant delivery courier unexpectedly rejected'; END IF;

 SELECT public.mobility_stage_delivery_offer(delivery_id,courier,vehicle,
   '00000000-0000-4000-8000-000000000106',30) INTO offer_id;
 IF offer_id IS NULL OR (SELECT public.mobility_stage_delivery_offer(
   delivery_id,courier,vehicle,'00000000-0000-4000-8000-000000000106',30))<>offer_id
 THEN RAISE EXCEPTION 'G10 delivery offer/idempotency failed'; END IF;

 SELECT * INTO claim FROM public.mobility_stage_claim_delivery_push(worker);
 IF NOT FOUND OR claim.offer_id<>offer_id OR claim.courier_id<>courier
 OR claim.delivery_id<>delivery_id
 THEN RAISE EXCEPTION 'G12 real-schema delivery claim returned wrong data'; END IF;
 SELECT count(*) INTO n FROM public.mobility_stage_claim_delivery_push(stranger);
 IF n<>0 THEN RAISE EXCEPTION 'G12 allowed a duplicate real-schema claim'; END IF;
 IF public.mobility_stage_ack_delivery_push(stranger,offer_id,'ticket_12345')
 THEN RAISE EXCEPTION 'G12 allowed foreign provider ACK'; END IF;
 IF NOT public.mobility_stage_ack_delivery_push(worker,offer_id,'ticket_12345')
 THEN RAISE EXCEPTION 'G12 owner ACK failed'; END IF;
 IF public.mobility_stage_ack_delivery_push(worker,offer_id,'ticket_12345')
 THEN RAISE EXCEPTION 'G12 duplicate provider ACK accepted'; END IF;
 IF (SELECT receipt_confirmed_at IS NOT NULL FROM
     public.mobility_stage_delivery_offer_outbox WHERE offer_id=offer_id)
 THEN RAISE EXCEPTION 'G12 falsely asserted device receipt'; END IF;

 -- G10 private acceptance must precede G5 custody state transitions.
 SELECT public.mobility_stage_delivery_accept_offer(offer_id,courier,
   '00000000-0000-4000-8000-000000000107') INTO event_id;
 IF event_id IS NULL OR
   (SELECT status FROM public.mobility_stage_deliveries WHERE id=delivery_id)<>'accepted'
 THEN RAISE EXCEPTION 'G10 private acceptance did not assign courier'; END IF;
 IF (SELECT public.mobility_stage_delivery_accept_offer(offer_id,courier,
   '00000000-0000-4000-8000-000000000107'))<>event_id
 THEN RAISE EXCEPTION 'G10 accepted offer replay was not idempotent'; END IF;

 PERFORM public.mobility_stage_delivery_transition(delivery_id,courier,
   'pickup','00000000-0000-4000-8000-000000000108',NULL);
 IF (SELECT status FROM public.mobility_stage_deliveries WHERE id=delivery_id)<>'picked_up'
 THEN RAISE EXCEPTION 'G5 pickup state not persisted'; END IF;
 SELECT public.mobility_stage_delivery_transition(delivery_id,courier,
   'deliver','00000000-0000-4000-8000-000000000109',
   '00000000-0000-4000-8000-000000000110') INTO event_id;
 IF event_id IS NULL
 OR (SELECT status FROM public.mobility_stage_deliveries WHERE id=delivery_id)<>'delivered'
 OR (SELECT proof_ref FROM public.mobility_stage_deliveries WHERE id=delivery_id)
    <>'00000000-0000-4000-8000-000000000110'::uuid
 THEN RAISE EXCEPTION 'G5 proof/custody delivery not persisted'; END IF;
 IF (SELECT public.mobility_stage_delivery_transition(delivery_id,courier,
   'deliver','00000000-0000-4000-8000-000000000109',
   '00000000-0000-4000-8000-000000000110'))<>event_id
 THEN RAISE EXCEPTION 'G5 deliver replay was not idempotent'; END IF;
END $assert$;
RESET ROLE;
