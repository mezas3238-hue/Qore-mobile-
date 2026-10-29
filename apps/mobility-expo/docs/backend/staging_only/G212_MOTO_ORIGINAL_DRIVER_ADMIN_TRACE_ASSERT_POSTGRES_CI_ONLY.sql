-- G212 positive and adversarial test on the SAME G119 booked/completed
-- MOTO passenger SQL row. Synthetic offer is inserted inside ROLLBACK only.
-- No municipal authorization is minted and no fake commercial delivery occurs.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g142_moto_trace_qa(uuid,uuid)') IS NULL
 OR pg_catalog.has_function_privilege('authenticated',
  'public.mobility_stage_g142_moto_trace_qa(uuid,uuid)','EXECUTE')
 OR pg_catalog.has_function_privilege('anon',
  'public.mobility_stage_g142_moto_trace_qa(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G212 wrong database, grants or G142 source'; END IF;
END $guard$;
BEGIN;
DO $check$
DECLARE
 admin_user uuid;
 trip_id uuid;
 row public.mobility_stage_g100_moto_trips%ROWTYPE;
 driver uuid:='11900000-0000-4119-8119-000000000003';
 vehicle uuid:='11900000-0000-4119-8119-000000000010';
 offer uuid:='11900000-0000-4119-8119-000000000011';
 dto jsonb;
 i integer;
 phases text[]:=ARRAY['searching','assigned','arriving','in_progress','completed'];
BEGIN
 SELECT user_id INTO admin_user FROM public.mobility_stage_backoffice_roles
 WHERE role='admin' AND status='active'
  AND public.mobility_stage_g27_backoffice_role_of(user_id)='admin'
 ORDER BY user_id LIMIT 1;
 IF admin_user IS NULL THEN RAISE EXCEPTION 'G212 verified Admin role missing'; END IF;
 SELECT * INTO row FROM public.mobility_stage_g100_moto_trips
 WHERE booking_key='11900000-0000-4119-8119-000000000020'::uuid;
 trip_id:=row.id;
 IF trip_id IS NULL OR row.status<>'completed' OR row.revision<>5
 OR row.driver_id<>driver OR row.vehicle_id<>vehicle
 OR row.accepted_offer_id<>offer
 THEN RAISE EXCEPTION 'G212 original G119 MOTO fixture not completed'; END IF;
 -- A G119 synthetic Driver assignment has no original G118 accepted offer.
 -- The Admin must NOT mistake an arbitrary accepted_offer_id for proof.
 dto:=public.mobility_stage_g142_moto_trace_qa(admin_user,trip_id);
 IF dto IS NOT NULL THEN
  RAISE EXCEPTION 'G212 unverified MOTO Driver forged Admin proof';
 END IF;
 INSERT INTO public.mobility_stage_g118_moto_offers
  (id,trip_id,driver_id,vehicle_id,request_key,status,decision_key,
   created_at,expires_at)
 VALUES(offer,trip_id,driver,vehicle,
  '21200000-0000-4212-8212-000000000001',
  'accepted','21200000-0000-4212-8212-000000000002',
  row.created_at,pg_catalog.clock_timestamp()+interval '2 hours');
 dto:=public.mobility_stage_g142_moto_trace_qa(admin_user,trip_id);
 IF dto IS NULL OR dto->>'serviceId'<>trip_id::text
 OR dto->>'serviceKind'<>'MOTO_RIDE'
 OR dto->>'bookingRequestKey'<>row.booking_key::text
 OR dto->>'quoteId'<>row.quote_id::text
 OR dto->>'status'<>'completed' OR (dto->>'revision')::int<>5
 OR dto->'assignment'->>'state'<>'QA_COMPLETED'
 OR dto->'assignment'->>'legalGate'<>'EXTERNAL_NOT_CERTIFIED'
 OR dto->>'productionEnabled'<>'false'
 OR dto->'ledger'->>'reconciliationStatus'<>'PENDING'
 OR pg_catalog.jsonb_array_length(dto->'events')<>5
 THEN RAISE EXCEPTION 'G212 MOTO original Admin trace incorrect: %',dto; END IF;
 FOR i IN 1..5 LOOP
  IF (dto->'events'->(i-1))->>'status'<>phases[i]
   OR ((dto->'events'->(i-1))->>'sequence')::int<>i
   OR (dto->'events'->(i-1))->>'serviceId'<>trip_id::text
   OR ((dto->'events'->(i-1))->>'at')::bigint>
      (dto->>'observedAt')::bigint
  THEN RAISE EXCEPTION 'G212 invalid MOTO original event %: %',i,dto; END IF;
 END LOOP;
 -- PII must never leak through the authorized Admin event projection.
 IF dto ? 'passengerId' OR dto ? 'driverId' OR dto ? 'vehicleId'
 OR dto ? 'gps' OR dto ? 'pspCollected'
 THEN RAISE EXCEPTION 'G212 revealed private/MOTO proof data'; END IF;
 UPDATE public.mobility_stage_g118_moto_offers SET status='declined'
 WHERE id=offer;
 IF public.mobility_stage_g142_moto_trace_qa(admin_user,trip_id) IS NOT NULL
 THEN RAISE EXCEPTION 'G212 accepted offer status spoof leaked'; END IF;
 UPDATE public.mobility_stage_g118_moto_offers SET status='accepted',
 driver_id='11900000-0000-4119-8119-000000000002' WHERE id=offer;
 IF public.mobility_stage_g142_moto_trace_qa(admin_user,trip_id) IS NOT NULL
 THEN RAISE EXCEPTION 'G212 foreign driver offer spoof leaked'; END IF;
 UPDATE public.mobility_stage_g118_moto_offers SET driver_id=driver WHERE id=offer;
 IF public.mobility_stage_g142_moto_trace_qa(
  '11900000-0000-4119-8119-000000000001',trip_id) IS NOT NULL
 THEN RAISE EXCEPTION 'G212 Passenger impersonated Admin'; END IF;
 RAISE NOTICE 'G212 PASS: same G119 completed MOTO booking to Admin 5-event trace, forged offer and foreign actor rejected; external legal/GPS/PSP NOT certified';
END $check$;
ROLLBACK;
