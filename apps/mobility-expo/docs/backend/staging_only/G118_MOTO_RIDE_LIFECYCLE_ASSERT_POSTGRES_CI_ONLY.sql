-- G118 QA: one actual PostgreSQL booking, negative legal offer gate,
-- then STATE MACHINE testing on an openly synthetic owner-seeded accepted trip.
-- Owner seed NEVER verifies municipal license; NEVER a commercial acceptance.
BEGIN;
SET LOCAL statement_timeout='65s';
INSERT INTO auth.users(id) VALUES
 ('11800000-0000-4118-8118-000000000001'),
 ('11800000-0000-4118-8118-000000000002'),
 ('11800000-0000-4118-8118-000000000003');
DO $suite$
DECLARE
 p uuid:='11800000-0000-4118-8118-000000000001';
 foreign_p uuid:='11800000-0000-4118-8118-000000000002';
 d uuid:='11800000-0000-4118-8118-000000000003';
 v uuid:='11800000-0000-4118-8118-000000000010';
 fake_offer uuid:='11800000-0000-4118-8118-000000000011';
 quote jsonb;booked jsonb;progress jsonb;readback jsonb;
 b uuid:='11800000-0000-4118-8118-000000000020';
 tr uuid; denied boolean; i integer;
BEGIN
 -- G102 left a synthetic Owner campaign/rule; no new legal authority.
 IF NOT EXISTS(SELECT 1 FROM public.mobility_stage_g93_ride_campaigns c
  WHERE c.service_kind='MOTO_RIDE' AND c.active)
 THEN RAISE EXCEPTION 'G118 missing genuine G100 Owner QA dependency'; END IF;
 quote:=public.mobility_stage_g100_moto_quote_qa(p,
  '11800000-0000-4118-8118-000000000021',
  'CENTRO_FIXTURE','SHOPPING','MOTO_TEST_ZONE',5000,600);
 booked:=public.mobility_stage_g100_moto_book_qa(p,(quote->>'quoteId')::uuid,b);
 tr:=(booked->>'tripId')::uuid;
 IF booked->>'tripState'<>'searching' OR booked->>'tripRevision'<>'1'
 THEN RAISE EXCEPTION 'G118 original MOTO booking lost'; END IF;
 readback:=public.mobility_stage_g118_moto_status_qa(p,b);
 IF readback->>'tripId'<>tr::text OR readback->>'tripState'<>'searching'
 OR readback->>'financialState'<>'RESERVED_QA'
 OR readback->>'driverAssigned'<>'false' OR readback->>'gpsVerified'<>'false'
 OR readback->>'etaAvailable'<>'false'
 OR public.mobility_stage_g118_moto_status_qa(foreign_p,b) IS NOT NULL
 THEN RAISE EXCEPTION 'G118 owner private MOTO status incorrect'; END IF;
 -- Direct Driver offer from API must be strictly denied in QA because no
 -- independently proven municipal authorization/geofence is available.
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g118_moto_offer_qa(
   b,d,v,'11800000-0000-4118-8118-000000000022');
 EXCEPTION WHEN SQLSTATE 'P1181' THEN denied:=true; END;
 IF NOT denied OR EXISTS(SELECT 1 FROM public.mobility_stage_g118_moto_offers
  WHERE trip_id=tr)
 THEN RAISE EXCEPTION 'G118 illegally offered MOTO ride without proof'; END IF;
 denied:=false;
 BEGIN
  INSERT INTO public.mobility_stage_g118_moto_legal_zones
   (zone_tag,independently_authorized) VALUES('MOTO_TEST_ZONE',true);
 EXCEPTION WHEN check_violation THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G118 synthetic policy forged real permit'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g118_moto_accept_qa(fake_offer,d,
   '11800000-0000-4118-8118-000000000023');
 EXCEPTION WHEN SQLSTATE 'P1181' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G118 accepted nonexistent Driver offer'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g118_moto_driver_step_qa(
   b,d,1,'arriving','11800000-0000-4118-8118-000000000024');
 EXCEPTION WHEN SQLSTATE 'P1181' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G118 jumped from searching to arriving'; END IF;
 -- Mechanics only: privileged QA fixture models a pre-existing accepted
 -- ride like G109 AUTO, bypassing NO legal gate in the public RPC.
 -- Such a state cannot be created by service_role under CI RLS.
 UPDATE public.mobility_stage_g100_moto_trips
 SET status='accepted',revision=2,driver_id=d,vehicle_id=v,
  accepted_offer_id=fake_offer,updated_at=pg_catalog.clock_timestamp()
 WHERE id=tr;
 IF (SELECT count(*) FROM public.mobility_stage_g100_moto_trips
   WHERE id=tr AND status='accepted' AND revision=2)<>1
 THEN RAISE EXCEPTION 'G118 QA fixture not accepted'; END IF;
 progress:=public.mobility_stage_g118_moto_driver_step_qa(b,d,2,'arriving',
  '11800000-0000-4118-8118-000000000030');
 IF progress->>'tripState'<>'arriving' OR progress->>'tripRevision'<>'3'
 THEN RAISE EXCEPTION 'G118 arriving state missing'; END IF;
 denied:=false;
 BEGIN PERFORM public.mobility_stage_g118_moto_driver_step_qa(b,foreign_p,3,
  'in_progress','11800000-0000-4118-8118-000000000031');
 EXCEPTION WHEN SQLSTATE 'P1181' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G118 foreign Driver advanced trip'; END IF;
 denied:=false;
 BEGIN PERFORM public.mobility_stage_g118_moto_driver_step_qa(b,d,2,
  'completed','11800000-0000-4118-8118-000000000032');
 EXCEPTION WHEN SQLSTATE 'P1181' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G118 skipped in_progress state'; END IF;
 -- Duplicate command returns current persisted state, never appends event.
 IF public.mobility_stage_g118_moto_driver_step_qa(b,d,2,'arriving',
   '11800000-0000-4118-8118-000000000030')<>progress
 THEN RAISE EXCEPTION 'G118 duplicate command modified receipt'; END IF;
 progress:=public.mobility_stage_g118_moto_driver_step_qa(b,d,3,'in_progress',
  '11800000-0000-4118-8118-000000000033');
 IF progress->>'tripState'<>'in_progress' OR progress->>'tripRevision'<>'4'
 THEN RAISE EXCEPTION 'G118 in_progress state missing'; END IF;
 denied:=false;
 BEGIN PERFORM public.mobility_stage_g100_moto_cancel_qa(p,b,
  '11800000-0000-4118-8118-000000000040');
 EXCEPTION WHEN SQLSTATE 'P1001' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G118 allowed cancellation reversal during ride'; END IF;
 progress:=public.mobility_stage_g118_moto_driver_step_qa(b,d,4,'completed',
  '11800000-0000-4118-8118-000000000034');
 IF progress->>'tripState'<>'completed' OR progress->>'tripRevision'<>'5'
 OR progress->>'financialState'<>'COMPLETED_UNSETTLED_QA'
 OR progress->>'pspCollected'<>'false'
 THEN RAISE EXCEPTION 'G118 completed cannot imply PSP settlement'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_g118_moto_events
   WHERE trip_id=tr)<>3
 OR (SELECT count(*) FROM public.mobility_stage_g100_moto_entries
   WHERE quote_id=(quote->>'quoteId')::uuid AND phase='reserve')<>4
 OR (SELECT count(*) FROM public.mobility_stage_g100_moto_entries
   WHERE quote_id=(quote->>'quoteId')::uuid AND phase='reverse')<>0
 THEN RAISE EXCEPTION 'G118 event or financial ledger lost'; END IF;
 IF public.mobility_stage_g100_moto_booking_receipt_qa(p,b)->>'tripState'<>'completed'
 OR public.mobility_stage_g100_moto_booking_receipt_qa(p,b)->>'financialState'
   <>'COMPLETED_UNSETTLED_QA'
 THEN RAISE EXCEPTION 'G118 original G100 readback diverges'; END IF;
 denied:=false;
 BEGIN PERFORM public.mobility_stage_g118_moto_driver_step_qa(b,d,5,
  'arriving','11800000-0000-4118-8118-000000000035');
 EXCEPTION WHEN SQLSTATE 'P1181' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G118 completed trip restarted'; END IF;
 -- No driver/vehicle identity, personal data, coordinates or ETA in read.
 IF progress ? 'driverId' OR progress ? 'vehicleId' OR progress ? 'coordinates'
 OR progress ? 'etaMinutes' OR progress ? 'bearer'
 THEN RAISE EXCEPTION 'G118 private Driver information leaked to Passenger'; END IF;
 RAISE NOTICE 'G118 PASS: real G100 MOTO booking, fail-closed legal offer and accept, synthetic-only accepted fixture, durable Driver arriving/in_progress/completed revisions, old quote and ledger unmodified, no PSP, private Passenger receipt';
END $suite$;
DO $permissions$
BEGIN
 IF has_table_privilege('service_role','public.mobility_stage_g100_moto_trips','UPDATE')
 OR has_table_privilege('service_role','public.mobility_stage_g118_moto_legal_zones','INSERT')
 OR has_table_privilege('authenticated','public.mobility_stage_g118_moto_events','SELECT')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g118_moto_driver_step_qa(uuid,uuid,bigint,text,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.mobility_stage_g118_moto_status_qa(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G118 direct Driver/Client or legal mint privilege leaked'; END IF;
END $permissions$;
ROLLBACK;
