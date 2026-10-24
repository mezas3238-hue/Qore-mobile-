-- G72 QA: complete SQL quote->explicit accept->one durable booking->read receipt.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
 current_setting('application_name')<>'qore_ci_disposable_chain' OR
 to_regprocedure('public.mobility_stage_g72_book(uuid,uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G72 disposable chain unavailable'; END IF;
 IF has_function_privilege('service_role',
  'public.mobility_stage_g72_auto_request_core(uuid,uuid,text,text,public.mobility_service_kind)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g72_book(uuid,uuid,uuid)','EXECUTE')
 OR has_table_privilege('service_role','public.mobility_stage_g72_auto_prequotes','INSERT')
 OR has_table_privilege('authenticated','public.mobility_stage_g72_auto_prequotes','SELECT')
 OR to_regprocedure('public.mobility_stage_auto_demo_request(uuid,uuid,text,text,public.mobility_service_kind)') IS NOT NULL
 THEN RAISE EXCEPTION 'G72 bypass or private fare authority exposed'; END IF;
END $guard$;
INSERT INTO auth.users(id) VALUES('72720000-0000-4727-8727-000000000001');
INSERT INTO public.mobility_stage_fare_rules
 (rule_key,mode,zone_tag,base_pyg,per_km_pyg,per_minute_pyg,minimum_pyg,
  commission_bps,valid_from,valid_until,active,approved_by,approved_at)
 VALUES('g72-qa-auto-v1','AUTO','ASUNCION_FIXTURE',4000,2000,120,7000,
  1000,pg_catalog.clock_timestamp()-interval '2 hours',
  pg_catalog.clock_timestamp()+interval '2 hours',true,
  '72720000-0000-4727-8727-000000000001',
  pg_catalog.clock_timestamp()-interval '3 hours');

SET ROLE service_role;
DO $qa$
DECLARE actor uuid:='72720000-0000-4727-8727-000000000001';
 pre_key uuid:='72720000-0000-4727-8727-000000000010';
 key uuid:='72720000-0000-4727-8727-000000000011';
 q uuid; t uuid; again uuid; body jsonb; rec jsonb; denied boolean; n bigint;
BEGIN
 q:=public.mobility_stage_g72_prequote(actor,pre_key,'economico','PANTEON','AEROPUERTO',
  'ASUNCION_FIXTURE',5000,600,0);
 IF q<>public.mobility_stage_g72_prequote(actor,pre_key,'economico','PANTEON','AEROPUERTO',
  'ASUNCION_FIXTURE',5000,600,0)
 THEN RAISE EXCEPTION 'G72 prequote replay not stable'; END IF;
 body:=public.mobility_stage_g72_prequote_receipt(actor,q);
 IF body->>'ownerId'<>actor::text OR (body->>'amountGs')::int<>15200
 OR body->>'fareVersion'<>'g72-qa-auto-v1' OR body->>'bookingId' IS NOT NULL
 THEN RAISE EXCEPTION 'G72 PYG quote/receipt incorrect %',body; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g72_prequote(actor,pre_key,'economico','PANTEON','SHOPPING',
    'ASUNCION_FIXTURE',5000,600,0);
 EXCEPTION WHEN SQLSTATE 'P7201' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G72 conflicting route reused prequote key'; END IF;
 denied:=false;
 BEGIN PERFORM public.mobility_stage_g72_book('33333333-3333-4333-8333-333333333333',q,key);
 EXCEPTION WHEN SQLSTATE 'P7201' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G72 foreign actor accepted quote'; END IF;
 IF public.mobility_stage_g72_booking_receipt(actor,key) IS NOT NULL
 THEN RAISE EXCEPTION 'G72 booking fabricated before consent'; END IF;
 t:=public.mobility_stage_g72_book(actor,q,key);
 again:=public.mobility_stage_g72_book(actor,q,key);
 IF t IS NULL OR t<>again THEN RAISE EXCEPTION 'G72 duplicate booking'; END IF;
 rec:=public.mobility_stage_g72_booking_receipt(actor,key);
 IF rec IS NULL OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(rec))<>9 OR
 rec->>'serviceId'<>t::text OR rec->>'operation'<>'rideRequest' OR
 rec->>'ownerId'<>actor::text OR rec->>'requestKey'<>key::text OR
 rec->>'status'<>'ACCEPTED_QA' OR (rec->>'revision')::int<>1
 OR public.mobility_stage_g72_booking_receipt('33333333-3333-4333-8333-333333333333',key) IS NOT NULL
 THEN RAISE EXCEPTION 'G72 strict B receipt/owner reconciliation broken %',rec; END IF;
 SELECT count(*) INTO n FROM public.mobility_stage_auto_demo_trips WHERE request_key=key;
 IF n<>1 THEN RAISE EXCEPTION 'G72 booked duplicates'; END IF;
 denied:=false;
 BEGIN PERFORM public.mobility_stage_g72_book(actor,q,pg_catalog.gen_random_uuid());
 EXCEPTION WHEN SQLSTATE 'P7201' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G72 same quote booked twice'; END IF;
 q:=public.mobility_stage_g72_prequote(actor,
  '72720000-0000-4727-8727-000000000012','economico',
  'PANTEON','SHOPPING','ASUNCION_FIXTURE',1000,60,0);
 IF q IS NULL THEN RAISE EXCEPTION 'G72 second prequote missing'; END IF;
 RAISE NOTICE 'G72 PASS: fare Gs before trip; one booking; B 9-field receipt; lost ACK; actor and expired quote';
END $qa$;
RESET ROLE;

-- Owner modifies only disposable clock data; service_role has no table UPDATE.
UPDATE public.mobility_stage_g72_auto_prequotes
SET quoted_at=pg_catalog.clock_timestamp()-interval '10 minutes',
    expires_at=pg_catalog.clock_timestamp()-interval '1 second'
WHERE request_key IN ('72720000-0000-4727-8727-000000000010',
                       '72720000-0000-4727-8727-000000000012');
SET ROLE service_role;
DO $expiry$
DECLARE actor uuid:='72720000-0000-4727-8727-000000000001';
 booked uuid; unbooked uuid; trip uuid; blocked boolean:=false;
BEGIN
 booked:=public.mobility_stage_g72_prequote(actor,
  '72720000-0000-4727-8727-000000000010','economico',
  'PANTEON','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 unbooked:=public.mobility_stage_g72_prequote(actor,
  '72720000-0000-4727-8727-000000000012','economico',
  'PANTEON','SHOPPING','ASUNCION_FIXTURE',1000,60,0);
 trip:=public.mobility_stage_g72_book(actor,booked,
  '72720000-0000-4727-8727-000000000011');
 IF trip IS NULL THEN RAISE EXCEPTION 'G72 lost ACK recovery after expiry'; END IF;
 BEGIN PERFORM public.mobility_stage_g72_book(actor,unbooked,pg_catalog.gen_random_uuid());
 EXCEPTION WHEN SQLSTATE 'P7201' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G72 expired quote could still book'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_auto_demo_trips WHERE passenger_id=actor)<>1
 THEN RAISE EXCEPTION 'G72 duplicate trip after expiry'; END IF;
 RAISE NOTICE 'G72 PASS: expired unbooked denied; already committed booking reconciled';
END $expiry$;
RESET ROLE;
