-- G219: TWO brand-new original Client bookings, not a completed-state clone:
--  AUTO G73 route->G93 priced consent->G73 book; MOTO G100 quote->reserve->book
--  then explicit owner-only SYNTHETIC legal acceptance in ROLLBACK,
--  then REAL G3 and G118 Driver commands and two private Admin SQL readbacks.
--  Never a municipal license, live GPS, external provider identity or PSP.
DO $gate$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g138_auto_trace_qa(uuid,uuid)') IS NULL
 OR pg_catalog.to_regprocedure('public.mobility_stage_g142_moto_trace_qa(uuid,uuid)') IS NULL
 OR pg_catalog.to_regprocedure('public.mobility_stage_g118_moto_driver_step_qa(uuid,uuid,bigint,text,uuid)') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g38_trusted_offer_proofs') IS NULL
 THEN RAISE EXCEPTION 'G219 requires full disposable original AUTO/MOTO and G38 fence'; END IF;
 IF has_function_privilege('authenticated',
  'public.mobility_stage_g118_moto_driver_step_qa(uuid,uuid,bigint,text,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g138_auto_trace_qa(uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_g142_moto_trace_qa(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G219 real private SQL role fences must remain active'; END IF;
END $gate$;
BEGIN;
SET LOCAL statement_timeout='60s';
CREATE TEMP TABLE g219_original(
 service_kind text PRIMARY KEY,
 passenger uuid NOT NULL,driver uuid NOT NULL,vehicle uuid NOT NULL,
 trip uuid NOT NULL,booking uuid NOT NULL,quote uuid NOT NULL,
 private_offer uuid NOT NULL,accepted_key uuid NOT NULL
) ON COMMIT DROP;

-- All identities/vehicles are visibly synthetic, generated exclusively for
-- this transaction and destroyed with ROLLBACK. No fake legal clearance.
INSERT INTO auth.users(id) VALUES
 ('21900000-0000-4219-8219-000000000001'),
 ('21900000-0000-4219-8219-000000000002'),
 ('21900000-0000-4219-8219-000000000003'),
 ('21900000-0000-4219-8219-000000000004'),
 ('21900000-0000-4219-8219-000000000005');
DELETE FROM public.user_roles WHERE user_id IN(
 '21900000-0000-4219-8219-000000000003'::uuid,
 '21900000-0000-4219-8219-000000000004'::uuid);
INSERT INTO public.user_roles(user_id,role) VALUES
 ('21900000-0000-4219-8219-000000000003','driver'),
 ('21900000-0000-4219-8219-000000000004','driver');
-- Synthetic campaign is explicitly owned by an isolated test Owner; it
-- is not an externally approved discount and disappears on ROLLBACK.
DELETE FROM public.user_roles
 WHERE user_id='21900000-0000-4219-8219-000000000005'::uuid;
INSERT INTO public.mobility_stage_backoffice_roles(user_id,role,status,approved_by)
VALUES('21900000-0000-4219-8219-000000000005','owner','active',
 '21900000-0000-4219-8219-000000000005');
INSERT INTO public.mobility_stage_g93_ride_campaigns(
 id,service_kind,rule_version,approved_by,active,begins_at,ends_at,duration_days)
VALUES('21900000-0000-4219-8219-000000000025','AUTO_RIDE',
 'G219_OWNER_QA_ROLLBACK','21900000-0000-4219-8219-000000000005',true,
 pg_catalog.transaction_timestamp()-interval '1 hour',
 pg_catalog.transaction_timestamp()-interval '1 hour'+interval '60 days',60);
INSERT INTO public.mobility_vehicles(
 id,driver_id,vehicle_kind,service_kind,country_code,municipality_code,
 plate_normalized,brand,model,manufacture_year,passenger_capacity,review_status
) VALUES
 ('21900000-0000-4219-8219-000000000013',
  '21900000-0000-4219-8219-000000000003',
  'AUTO','economico','PY','ASUNCION','Q219AUTO','QA','FIXTURE',2025,4,'approved'),
 ('21900000-0000-4219-8219-000000000014',
  '21900000-0000-4219-8219-000000000004',
  'MOTO','moto_pasajero','PY','ASUNCION','Q219MOTO','QA','FIXTURE',2025,1,'approved');
DO $original_client$
DECLARE
 pa uuid:='21900000-0000-4219-8219-000000000001'::uuid;
 pm uuid:='21900000-0000-4219-8219-000000000002'::uuid;
 route uuid;aq uuid;at uuid;mq jsonb;mt jsonb;mqid uuid;
 ar uuid:='21900000-0000-4219-8219-000000000021'::uuid;
 mr uuid:='21900000-0000-4219-8219-000000000022'::uuid;
BEGIN
 route:=public.mobility_stage_g73_route(
  pa,pg_catalog.gen_random_uuid(),'economico',
  'CENTRO_FIXTURE','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 aq:=public.mobility_stage_g73_quote(pa,route,pg_catalog.gen_random_uuid());
 IF public.mobility_stage_g93_preview_auto_qa(pa,aq) IS NULL
 THEN RAISE EXCEPTION 'G219 original AUTO subsidy preview absent'; END IF;
 at:=public.mobility_stage_g73_book(pa,aq,ar);
 IF public.mobility_stage_g73_booking_receipt(pa,ar)->>'tripId'<>at::text
 OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_g93_auto_ledger l
  WHERE l.quote_id=aq AND l.trip_id=at AND l.booking_key=ar)
 THEN RAISE EXCEPTION 'G219 ORIGINAL G73/G93 AUTO booking missing'; END IF;
 mq:=public.mobility_stage_g100_moto_quote_qa(pm,pg_catalog.gen_random_uuid(),
  'CENTRO_FIXTURE','AEROPUERTO','MOTO_TEST_ZONE',5000,600);
 mqid:=(mq->>'quoteId')::uuid;
 mt:=public.mobility_stage_g100_moto_book_qa(pm,mqid,mr);
 IF mt->>'tripState'<>'searching' OR mt->>'tripRevision'<>'1'
 OR mt->>'financialState'<>'RESERVED_QA'
 THEN RAISE EXCEPTION 'G219 original MOTO source/ledger missing'; END IF;
 INSERT INTO pg_temp.g219_original VALUES
  ('AUTO_RIDE',pa,'21900000-0000-4219-8219-000000000003'::uuid,
   '21900000-0000-4219-8219-000000000013'::uuid,at,ar,aq,
   pg_catalog.gen_random_uuid(),pg_catalog.gen_random_uuid()),
  ('MOTO_RIDE',pm,'21900000-0000-4219-8219-000000000004'::uuid,
   '21900000-0000-4219-8219-000000000014'::uuid,
   (mt->>'tripId')::uuid,mr,mqid,
   pg_catalog.gen_random_uuid(),pg_catalog.gen_random_uuid());
 IF public.mobility_stage_g138_auto_trace_qa(
  '14500000-0000-4145-8145-000000000002'::uuid,at)->>'status'<>'searching'
 OR public.mobility_stage_g142_moto_trace_qa(
  '14500000-0000-4145-8145-000000000002'::uuid,(mt->>'tripId')::uuid)
   ->>'status'<>'searching'
 THEN RAISE EXCEPTION 'G219 independently witnessed original Client sources missing'; END IF;
END $original_client$;

-- Public G38 / G118 legal acceptance is deliberately impossible in QA. We
-- create an EXPLICIT pre-accepted private offer fixture, only via DB owner
-- and only inside rollback. No server/Driver endpoint gains such authority.
-- DDL OUTSIDE a table-reading DO to avoid PostgreSQL active-cursor ALTER.
ALTER TABLE public.mobility_stage_auto_demo_offers DISABLE TRIGGER USER;
ALTER TABLE public.mobility_stage_auto_demo_trips DISABLE TRIGGER USER;
DO $synthetic_auto_accept$
DECLARE s record; event uuid;
BEGIN
 SELECT * INTO s FROM pg_temp.g219_original WHERE service_kind='AUTO_RIDE';
 INSERT INTO public.mobility_stage_auto_demo_offers(
  id,request_key,trip_id,driver_id,vehicle_id,ttl_seconds,expires_at)
 VALUES(s.private_offer,pg_catalog.gen_random_uuid(),s.trip,s.driver,
  s.vehicle,30,pg_catalog.clock_timestamp()+interval '30 seconds');
 UPDATE public.mobility_stage_auto_demo_trips
 SET status='accepted',driver_id=s.driver,vehicle_id=s.vehicle,
  revision=2,changed_at=pg_catalog.clock_timestamp()
 WHERE id=s.trip AND status='searching' AND revision=1;
 IF NOT FOUND THEN RAISE EXCEPTION 'G219 AUTO original trip no longer searching'; END IF;
 INSERT INTO public.mobility_stage_auto_demo_events(
  request_key,trip_id,actor_id,next_status,trip_revision)
 VALUES(s.accepted_key,s.trip,s.driver,'accepted',2)
 RETURNING id INTO event;
 UPDATE public.mobility_stage_auto_demo_offers
 SET status='accepted',decision_key=s.accepted_key,decision_event_id=event
 WHERE id=s.private_offer;
 INSERT INTO public.mobility_stage_g36_driver_slots(
  driver_id,assignment_kind,assignment_id)
 VALUES(s.driver,'AUTO_RIDE',s.trip);
END $synthetic_auto_accept$;
ALTER TABLE public.mobility_stage_auto_demo_trips ENABLE TRIGGER USER;
ALTER TABLE public.mobility_stage_auto_demo_offers ENABLE TRIGGER USER;

DO $synthetic_moto_accept$
DECLARE s record;
BEGIN
 SELECT * INTO s FROM pg_temp.g219_original WHERE service_kind='MOTO_RIDE';
 -- Ensure legal gate still denies a PUBLIC synthetic permit at time of offer.
 IF public.mobility_stage_g118_legal_moto_gate_qa(s.driver,s.vehicle,'MOTO_TEST_ZONE')
 THEN RAISE EXCEPTION 'G219 synthetic MOTO legal gate became enabled'; END IF;
 INSERT INTO public.mobility_stage_g118_moto_offers(
  id,request_key,trip_id,driver_id,vehicle_id,status,decision_key,expires_at)
 VALUES(s.private_offer,pg_catalog.gen_random_uuid(),s.trip,s.driver,
  s.vehicle,'accepted',s.accepted_key,
  pg_catalog.clock_timestamp()+interval '30 seconds');
 UPDATE public.mobility_stage_g100_moto_trips
 SET status='accepted',revision=2,driver_id=s.driver,vehicle_id=s.vehicle,
  accepted_offer_id=s.private_offer,updated_at=pg_catalog.clock_timestamp()
 WHERE id=s.trip AND status='searching' AND revision=1;
 IF NOT FOUND THEN RAISE EXCEPTION 'G219 MOTO original trip no longer searching'; END IF;
END $synthetic_moto_accept$;

-- Full original Driver SQL machinery under all original immutable DML rules.
DO $real_driver_qa$
DECLARE
 s record;adm uuid:='14500000-0000-4145-8145-000000000002'::uuid;
 e uuid;states text[]:=ARRAY['arriving','in_progress','completed'];
 i int;dto jsonb;untrusted jsonb;denied bool;completed int:=0;
BEGIN
 IF public.mobility_stage_g27_backoffice_role_of(adm)<>'admin'
 THEN RAISE EXCEPTION 'G219 independent Admin missing'; END IF;
 FOR s IN SELECT * FROM pg_temp.g219_original ORDER BY service_kind LOOP
  IF s.service_kind='AUTO_RIDE' THEN
   denied:=false;
   BEGIN
    PERFORM public.mobility_stage_auto_demo_transition(
     s.trip,s.passenger,'completed',pg_catalog.gen_random_uuid());
   EXCEPTION WHEN OTHERS THEN denied:=true;
   END;
   IF NOT denied THEN RAISE EXCEPTION 'G219 Passenger was allowed to impersonate Driver'; END IF;
   FOR i IN 1..3 LOOP
    e:=public.mobility_stage_auto_demo_transition(s.trip,s.driver,
      states[i]::public.mobility_stage_trip_status,pg_catalog.gen_random_uuid());
    IF e IS NULL THEN RAISE EXCEPTION 'G219 G3 Driver transition failed'; END IF;
   END LOOP;
   dto:=public.mobility_stage_g138_auto_trace_qa(adm,s.trip);
   untrusted:=public.mobility_stage_g138_auto_trace_qa(s.passenger,s.trip);
  ELSE
   denied:=false;
   BEGIN
    PERFORM public.mobility_stage_g118_moto_driver_step_qa(
      s.booking,s.passenger,2,'arriving',pg_catalog.gen_random_uuid());
   EXCEPTION WHEN SQLSTATE 'P1181' THEN denied:=true;
   END;
   IF NOT denied THEN RAISE EXCEPTION 'G219 foreign MOTO Driver advanced trip'; END IF;
   FOR i IN 1..3 LOOP
    dto:=public.mobility_stage_g118_moto_driver_step_qa(
     s.booking,s.driver,(i+1)::bigint,states[i],pg_catalog.gen_random_uuid());
    IF dto->>'tripState'<>states[i]
    THEN RAISE EXCEPTION 'G219 MOTO missing real Driver transition'; END IF;
   END LOOP;
   dto:=public.mobility_stage_g142_moto_trace_qa(adm,s.trip);
   untrusted:=public.mobility_stage_g142_moto_trace_qa(s.passenger,s.trip);
  END IF;
  IF dto IS NULL OR dto->>'serviceId'<>s.trip::text
   OR dto->>'bookingRequestKey'<>s.booking::text
   OR dto->>'quoteId'<>s.quote::text
   OR dto->>'serviceKind'<>s.service_kind
   OR dto->>'status'<>'completed' OR (dto->>'revision')::int<>5
   OR dto->'assignment'->>'state'<>'QA_COMPLETED'
   OR dto->'assignment'->>'legalGate'<>'EXTERNAL_NOT_CERTIFIED'
   OR dto->>'productionEnabled'<>'false'
   OR dto->'ledger'->>'reconciliationStatus'<>'PENDING'
   OR jsonb_array_length(dto->'events')<>5
   OR untrusted IS NOT NULL
  THEN RAISE EXCEPTION 'G219 original ride terminal Admin audit failed: %',dto; END IF;
  FOR i IN 1..5 LOOP
   IF (dto->'events'->(i-1))->>'serviceId'<>s.trip::text
     OR (dto->'events'->(i-1))->>'sequence'<>i::text
     OR (dto->'events'->(i-1))->>'status'<>
       (ARRAY['searching','assigned','arriving','in_progress','completed'])[i]
   THEN RAISE EXCEPTION 'G219 out of order original Admin event % for %',i,s.service_kind; END IF;
  END LOOP;
  IF s.service_kind='MOTO_RIDE' AND
   public.mobility_stage_g100_moto_booking_receipt_qa(s.passenger,s.booking)
   ->>'financialState'<>'COMPLETED_UNSETTLED_QA'
  THEN RAISE EXCEPTION 'G219 MOTO completion incorrectly implies money settled'; END IF;
  completed:=completed+1;
 END LOOP;
 IF completed<>2 THEN RAISE EXCEPTION 'G219 expected two complete same-ID rides'; END IF;
 RAISE NOTICE 'G219 QA 2/2: NEW real G73+G93 AUTO and G100 MOTO Client booking, explicit rollback-only synthetic offer/accept, real G3/G118 Driver arrive/pickup/complete, original Admin G138/G142 five-event readback, legal and PSP remain unapproved';
END $real_driver_qa$;
ROLLBACK;
