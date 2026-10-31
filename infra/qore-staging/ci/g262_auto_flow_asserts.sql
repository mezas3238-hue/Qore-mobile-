-- G262 disposable PG16/PG17 assertions: never against real Auth or STAGING.
DO $p$ BEGIN
 IF NOT has_function_privilege('service_role',
  'public.mobility_stage_g73_route(uuid,uuid,public.mobility_service_kind,text,text,text,integer,integer,integer)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_g73_book(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g73_quote(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'qore_stage_internal.mobility_stage_g73_book(uuid,uuid,uuid)','EXECUTE')
 OR has_table_privilege('service_role','public.mobility_stage_g73_auto_routes','INSERT')
 OR has_table_privilege('authenticated','public.mobility_stage_g262_auto_prequotes','SELECT')
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.mobility_stage_g73_auto_routes'::regclass)
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.mobility_stage_g262_auto_prequotes'::regclass)
 THEN RAISE EXCEPTION 'G262 role privileges or RLS unsafe'; END IF;
END $p$;
SET ROLE service_role;
DO $assert$
DECLARE
 a uuid:='00000000-0000-4000-8000-000000000101';
 b uuid:='00000000-0000-4000-8000-000000000102';
 route_key uuid:='00000000-0000-4000-8000-000000000201';
 quote_key uuid:='00000000-0000-4000-8000-000000000202';
 booking_key uuid:='00000000-0000-4000-8000-000000000203';
 route2_key uuid:='00000000-0000-4000-8000-000000000204';
 quote2_key uuid:='00000000-0000-4000-8000-000000000205';
 book2_key uuid:='00000000-0000-4000-8000-000000000206';
 rid uuid; qid uuid; tid uuid; other_rid uuid; other_qid uuid;
 rec jsonb; blocked boolean;
BEGIN
 rid:=public.mobility_stage_g73_route(a,route_key,'economico',
 'PANTEON','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 IF rid IS NULL OR rid IS DISTINCT FROM public.mobility_stage_g73_route(
 a,route_key,'economico','PANTEON','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0)
 THEN RAISE EXCEPTION 'G262 route not idempotent'; END IF;
 rec:=public.mobility_stage_g73_route_receipt(a,rid);
 IF rec->>'ownerId'<>a::text OR rec->>'routeId'<>rid::text OR
  rec->>'routingVerified'<>'true' THEN
  RAISE EXCEPTION 'G262 private route receipt invalid'; END IF;
 IF public.mobility_stage_g73_route_receipt(b,rid) IS NOT NULL
 THEN RAISE EXCEPTION 'G262 foreign route exposed'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_g73_route(a,route_key,'economico',
  'MERCADO','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 EXCEPTION WHEN SQLSTATE 'P2621' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G262 route key reused with different origin'; END IF;
 blocked:=false;
 BEGIN PERFORM public.mobility_stage_g73_quote(b,rid,quote_key);
 EXCEPTION WHEN SQLSTATE 'P2622' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G262 foreign quote accepted'; END IF;
 qid:=public.mobility_stage_g73_quote(a,rid,quote_key);
 IF qid IS NULL OR qid IS DISTINCT FROM
  public.mobility_stage_g73_quote(a,rid,quote_key)
 THEN RAISE EXCEPTION 'G262 quote not idempotent'; END IF;
 rec:=public.mobility_stage_g73_quote_receipt(a,qid);
 IF rec->>'amountGs'<>'15000' OR rec->>'currency'<>'PYG' OR
  rec->>'ownerId'<>a::text OR rec->>'routeId'<>rid::text OR
  rec->>'serverPriced'<>'true' OR rec->>'status'<>'QUOTED_QA' OR
  (SELECT count(*) FROM pg_catalog.jsonb_object_keys(rec))<>15
 THEN RAISE EXCEPTION 'G262 B contract not met: %',rec; END IF;
 IF public.mobility_stage_g73_quote_receipt(b,qid) IS NOT NULL
 THEN RAISE EXCEPTION 'G262 foreign quote visible'; END IF;
 blocked:=false;
 BEGIN PERFORM public.mobility_stage_g73_quote(a,rid,pg_catalog.gen_random_uuid());
 EXCEPTION WHEN SQLSTATE 'P2622' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G262 double quote for route'; END IF;
 IF public.mobility_stage_g73_booking_receipt(a,booking_key) IS NOT NULL
 THEN RAISE EXCEPTION 'G262 fabricated unbooked receipt'; END IF;
 tid:=public.mobility_stage_g73_book(a,qid,booking_key);
 IF tid IS NULL OR tid IS DISTINCT FROM
   public.mobility_stage_g73_book(a,qid,booking_key)
 THEN RAISE EXCEPTION 'G262 booking not idempotent'; END IF;
 rec:=public.mobility_stage_g73_booking_receipt(a,booking_key);
 IF rec->>'tripId'<>tid::text OR rec->>'ownerId'<>a::text OR
  rec->>'routeId'<>rid::text OR rec->>'status'<>'ACCEPTED_QA' OR
  rec->>'serverPersisted'<>'true' OR
  (SELECT count(*) FROM pg_catalog.jsonb_object_keys(rec))<>10
 THEN RAISE EXCEPTION 'G262 B booking receipt invalid'; END IF;
 IF public.mobility_stage_g73_booking_receipt(b,booking_key) IS NOT NULL
 THEN RAISE EXCEPTION 'G262 cross-owner booking exposed'; END IF;
 blocked:=false;
 BEGIN PERFORM public.mobility_stage_g73_book(a,qid,pg_catalog.gen_random_uuid());
 EXCEPTION WHEN SQLSTATE 'P2623' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G262 same quote booked twice'; END IF;
 other_rid:=public.mobility_stage_g73_route(a,route2_key,'confort',
 'ESTACION','HOSPITAL','ASUNCION_FIXTURE',7000,800,0);
 other_qid:=public.mobility_stage_g73_quote(a,other_rid,quote2_key);
 blocked:=false;
 BEGIN PERFORM public.mobility_stage_g73_book(a,other_qid,book2_key);
 EXCEPTION WHEN SQLSTATE 'P2623' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G262 accepted two simultaneous active trips'; END IF;
 RAISE NOTICE 'G262 PASS: private route->quote->booking, idempotency, owner isolation, one-active';
END $assert$;
RESET ROLE;
