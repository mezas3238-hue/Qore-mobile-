-- G154 original G139/G148/G150/G151 receipt before any Driver private offer.
-- All IDs are synthetic disposable fixtures; no fake legal Driver approvals.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g154_merchant_dispatch_ready_qa(uuid)') IS NULL
 THEN RAISE EXCEPTION 'G154 test refuses non-disposable chain'; END IF;
END $guard$;

DO $test$
DECLARE linked uuid; old_underweight uuid; generic uuid;
 other uuid; quote uuid; amount integer; version text;
 fake_vehicle uuid; fake_courier uuid;
 denied boolean:=false; legal_denied boolean:=false;
BEGIN
 SELECT delivery_id INTO linked FROM public.mobility_stage_merchant_orders
 WHERE request_key='13800000-0000-4138-8138-000000000242'
 AND status='ready' AND revision=5;
 SELECT id INTO old_underweight FROM public.mobility_stage_deliveries
 WHERE request_key='15000000-0000-4150-8150-000000000016';
 SELECT id INTO generic FROM public.mobility_stage_deliveries
 WHERE request_key='12200000-0000-4122-8122-000000000022';
 IF linked IS NULL OR old_underweight IS NULL OR generic IS NULL
 THEN RAISE EXCEPTION 'G154 original E2E fixtures missing'; END IF;
 IF NOT public.mobility_stage_g154_merchant_dispatch_ready_qa(linked)
 OR public.mobility_stage_g154_merchant_dispatch_ready_qa(old_underweight)
 OR NOT public.mobility_stage_g154_merchant_dispatch_ready_qa(generic)
 THEN RAISE EXCEPTION 'G154 source-linked readiness/provenance or generic cargo classification wrong'; END IF;
 IF NOT public.mobility_stage_g123_delivery_priced_qa(linked)
 THEN RAISE EXCEPTION 'G154 original linked delivery lost G122 fare provenance'; END IF;

 -- A SECOND Buyer can create an original G5 parcel from the same branch,
 -- but it cannot impersonate a linked G45 COMMERCE order, even after G122
 -- price acceptance. G37 immutable cargo and G71 real KYC remain intact.
 INSERT INTO auth.users(id)
 VALUES('15400000-0000-4154-8154-000000000001');
 INSERT INTO public.user_roles(user_id,role)
 VALUES('15400000-0000-4154-8154-000000000001','passenger');
 other:=public.mobility_stage_delivery_request(
  '15400000-0000-4154-8154-000000000001',
  '15400000-0000-4154-8154-000000000002',
  'MOTO','GROCERIES',350,30,20,10,'QA_PICKUP','UNLINKED_DESTINATION',false);
 IF other IS NULL OR public.mobility_stage_g154_merchant_dispatch_ready_qa(other)
 THEN RAISE EXCEPTION 'G154 unlinked authentic Buyer parcel was classified ready'; END IF;
 quote:=public.mobility_stage_fare_quote(
  '15400000-0000-4154-8154-000000000001',
  '15400000-0000-4154-8154-000000000003','DELIVERY','DELIVERY',
  other,'CARGA_MOTO_QA',4800,750,0);
 SELECT q.total_pyg,r.rule_key INTO amount,version
 FROM public.mobility_stage_fare_quotes q
 JOIN public.mobility_stage_fare_rules r ON r.id=q.rule_id WHERE q.id=quote;
 IF amount IS NULL THEN RAISE EXCEPTION 'G154 source quote missing'; END IF;
 PERFORM public.mobility_stage_g122_accept_delivery_quote_qa(
  '15400000-0000-4154-8154-000000000001',
  other,quote,'15400000-0000-4154-8154-000000000004',
  amount,version);
 IF NOT public.mobility_stage_g123_delivery_priced_qa(other)
 OR public.mobility_stage_g154_merchant_dispatch_ready_qa(other)
 THEN RAISE EXCEPTION 'G154 an accepted G122 tariff bypassed missing G45 merchant order'; END IF;

 SELECT id,driver_id INTO fake_vehicle,fake_courier FROM public.mobility_vehicles LIMIT 1;
 IF fake_vehicle IS NULL THEN RAISE EXCEPTION 'G154 test requires original vehicle fixture'; END IF;
 BEGIN
  INSERT INTO public.mobility_stage_delivery_offers(
   request_key,delivery_id,courier_id,vehicle_id,ttl_seconds,expires_at)
  VALUES ('15400000-0000-4154-8154-000000000005',other,
    fake_courier,fake_vehicle,30,pg_catalog.statement_timestamp()+interval '30 seconds');
 EXCEPTION WHEN SQLSTATE 'P1541' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G154 direct offer DML passed without merchant order'; END IF;
 IF EXISTS (SELECT 1 FROM public.mobility_stage_delivery_offers
  WHERE delivery_id=other)
 THEN RAISE EXCEPTION 'G154 unauthorized offer inserted'; END IF;
 -- Positive G154 source is necessary, NOT sufficient: G71 must independently
 -- block the synthetic actor when issuing a real private offer.
 BEGIN
  PERFORM public.mobility_stage_delivery_offer(linked,fake_courier,
   fake_vehicle,'15400000-0000-4154-8154-000000000006',30);
 EXCEPTION WHEN SQLSTATE 'P7401' THEN legal_denied:=true; END;
 IF NOT legal_denied THEN RAISE EXCEPTION 'G154 source readiness bypassed legal Driver gate'; END IF;
 IF EXISTS (SELECT 1 FROM public.mobility_stage_delivery_offers
  WHERE delivery_id=linked)
 THEN RAISE EXCEPTION 'G154 forged legal Driver offer'; END IF;
 IF has_function_privilege('service_role',
  'public.mobility_stage_g154_merchant_dispatch_ready_qa(uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g154_merchant_dispatch_ready_qa(uuid)','EXECUTE')
 OR (SELECT count(*) FROM pg_trigger WHERE
  tgrelid='public.mobility_stage_delivery_offers'::regclass
  AND tgname='b11_g154_commerce_offer_ready' AND NOT tgisinternal)<>1
 OR (SELECT count(*) FROM pg_trigger WHERE
  tgrelid='public.mobility_stage_deliveries'::regclass
  AND tgname='b11_g154_commerce_assignment_ready' AND NOT tgisinternal)<>1
 THEN RAISE EXCEPTION 'G154 anti-bypass or privilege fence missing'; END IF;
 RAISE NOTICE 'G154 original B COMMERCE ready/G150 price-consented linked delivery PASS; price-only unlinked merchant cargo blocked by SQL trigger; independent legal Driver veto maintained';
END $test$;
