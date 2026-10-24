-- G73 real SQL contract consumed verbatim by B f1-auto-prequote-consent.
DO $g$ BEGIN
 IF to_regprocedure('public.mobility_stage_g73_book(uuid,uuid,uuid)') IS NULL
 OR has_function_privilege('service_role','public.mobility_stage_g72_prequote(uuid,uuid,public.mobility_service_kind,text,text,text,integer,integer,integer)','EXECUTE')
 OR has_function_privilege('service_role','public.mobility_stage_g72_book(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.mobility_stage_g73_book(uuid,uuid,uuid)','EXECUTE')
 OR has_table_privilege('authenticated','public.mobility_stage_g73_auto_routes','SELECT')
 THEN RAISE EXCEPTION 'G73 direct price/booking bypass exposed'; END IF;
END $g$;
INSERT INTO auth.users(id) VALUES('73730000-0000-4737-8737-000000000001');
SET ROLE service_role;
DO $t$
DECLARE
 actor uuid:='73730000-0000-4737-8737-000000000001';
 route_key uuid:='73730000-0000-4737-8737-000000000010';
 quote_key uuid:='73730000-0000-4737-8737-000000000011';
 booking_key uuid:='73730000-0000-4737-8737-000000000012';
 route_id uuid; quote_id uuid; trip_id uuid; v jsonb; r jsonb; denied boolean;
BEGIN
 route_id:=public.mobility_stage_g73_route(actor,route_key,'economico',
  'PANTEON','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 IF route_id<>public.mobility_stage_g73_route(actor,route_key,'economico',
  'PANTEON','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0)
 THEN RAISE EXCEPTION 'G73 route key not idempotent'; END IF;
 r:=public.mobility_stage_g73_route_receipt(actor,route_id);
 IF r->>'routeId'<>route_id::text OR r->>'ownerId'<>actor::text
 OR r->>'routingVerified'<>'true' THEN RAISE EXCEPTION 'G73 untrusted route'; END IF;
 denied:=false;
 BEGIN PERFORM public.mobility_stage_g73_route(actor,route_key,'economico',
  'SHOPPING','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 EXCEPTION WHEN SQLSTATE 'P7301' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G73 route replay changed origin'; END IF;
 quote_id:=public.mobility_stage_g73_quote(actor,route_id,quote_key);
 IF quote_id<>public.mobility_stage_g73_quote(actor,route_id,quote_key)
 THEN RAISE EXCEPTION 'G73 quote replay mismatch'; END IF;
 v:=public.mobility_stage_g73_quote_receipt(actor,quote_id);
 IF (SELECT count(*) FROM pg_catalog.jsonb_object_keys(v))<>15
 OR v->>'ownerId'<>actor::text OR v->>'routeId'<>route_id::text
 OR v->>'quoteRequestKey'<>quote_key::text OR v->>'currency'<>'PYG'
 OR v->>'status'<>'QUOTED_QA' OR v->>'amountGs'<>'15200'
 OR (v->>'expiresAt')::bigint<=floor(pg_catalog.extract(epoch from pg_catalog.clock_timestamp())*1000)::bigint
 THEN RAISE EXCEPTION 'G73 B exact 15-field prequote mismatch %',v; END IF;
 denied:=false;
 BEGIN PERFORM public.mobility_stage_g73_quote('33333333-3333-4333-8333-333333333333',
  route_id,pg_catalog.gen_random_uuid());
 EXCEPTION WHEN SQLSTATE 'P7301' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G73 cross-owner route quote'; END IF;
 IF public.mobility_stage_g73_booking_receipt(actor,booking_key) IS NOT NULL
 THEN RAISE EXCEPTION 'G73 fabricated booking without consent'; END IF;
 trip_id:=public.mobility_stage_g73_book(actor,quote_id,booking_key);
 IF trip_id<>public.mobility_stage_g73_book(actor,quote_id,booking_key)
 THEN RAISE EXCEPTION 'G73 duplicate booking on replay'; END IF;
 v:=public.mobility_stage_g73_booking_receipt(actor,booking_key);
 IF (SELECT count(*) FROM pg_catalog.jsonb_object_keys(v))<>11
 OR v->>'ownerId'<>actor::text OR v->>'requestKey'<>booking_key::text
 OR v->>'tripId'<>trip_id::text OR v->>'quoteId'<>quote_id::text
 OR v->>'routeId'<>route_id::text OR v->>'status'<>'ACCEPTED_QA'
 OR v->>'revision'<>'1'
 THEN RAISE EXCEPTION 'G73 B exact 11-field booking mismatch %',v; END IF;
 IF public.mobility_stage_g73_booking_receipt(
  '33333333-3333-4333-8333-333333333333',booking_key) IS NOT NULL
 THEN RAISE EXCEPTION 'G73 foreign reconciliation leak'; END IF;
 denied:=false;
 BEGIN PERFORM public.mobility_stage_g73_book(actor,quote_id,pg_catalog.gen_random_uuid());
 EXCEPTION WHEN SQLSTATE 'P7201' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G73 same quote booked twice'; END IF;
 RAISE NOTICE 'G73 PASS: verified route, B 15-field quote, B 11-field booking, idempotent recovery';
END $t$;
RESET ROLE;
