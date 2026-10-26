-- G123 adversarial proof: both newly persisted cargo services have
-- private G122 price consent, but unpriced G121 deliveries cannot create
-- Driver offers. KYC/G38 stay fully effective.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G123 assertion refused outside disposable SQL CI'; END IF;
END $guard$;

DO $test$
DECLARE m uuid; a uuid; un_m uuid; un_a uuid;
 err text; allowed boolean; blocked boolean; v uuid;
 n integer;
BEGIN
 SELECT id INTO m FROM public.mobility_stage_deliveries
 WHERE request_key='12200000-0000-4122-8122-000000000021';
 SELECT id INTO a FROM public.mobility_stage_deliveries
 WHERE request_key='12200000-0000-4122-8122-000000000022';
 SELECT id INTO un_m FROM public.mobility_stage_deliveries
 WHERE request_key='12100000-0000-4121-8121-000000000031';
 SELECT id INTO un_a FROM public.mobility_stage_deliveries
 WHERE request_key='12100000-0000-4121-8121-000000000032';
 IF m IS NULL OR a IS NULL OR un_m IS NULL OR un_a IS NULL
 THEN RAISE EXCEPTION 'G123 original G121/G122 E2E fixtures absent'; END IF;
 IF NOT public.mobility_stage_g123_delivery_priced_qa(m)
 OR NOT public.mobility_stage_g123_delivery_priced_qa(a)
 THEN RAISE EXCEPTION 'G123 rejected valid exact-price per-vehicle acceptance'; END IF;
 IF public.mobility_stage_g123_delivery_priced_qa(un_m)
 OR public.mobility_stage_g123_delivery_priced_qa(un_a)
 THEN RAISE EXCEPTION 'G123 accepted unpriced delivery'; END IF;
 FOR v IN SELECT un_m UNION ALL SELECT un_a LOOP
  blocked:=false;
  BEGIN
   PERFORM public.mobility_stage_delivery_offer(
    v,'12200000-0000-4122-8122-000000000001',
    '12200000-0000-4122-8122-000000000001',
    pg_catalog.gen_random_uuid(),30);
  EXCEPTION WHEN SQLSTATE 'P1231' THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'G123 unpriced private offer not rejected'; END IF;
 END LOOP;
 -- Positive G122 consent is NECESSARY but not sufficient: G71 must still veto
 -- the synthetic actor that has not been legally approved as a courier.
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_delivery_offer(
    m,'12200000-0000-4122-8122-000000000001',
    '12200000-0000-4122-8122-000000000001',
    pg_catalog.gen_random_uuid(),30);
 EXCEPTION WHEN SQLSTATE 'P7401' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G123 bypassed G71 Driver KYC veto'; END IF;
 SELECT count(*) INTO n FROM public.mobility_stage_delivery_offers
 WHERE delivery_id IN (m,a,un_m,un_a);
 IF n<>0 THEN RAISE EXCEPTION 'G123 generated fake Driver offers'; END IF;
 IF has_function_privilege('service_role',
  'public.mobility_stage_g123_previous_delivery_offer_qa(uuid,uuid,uuid,uuid,integer)','EXECUTE')
 OR has_function_privilege('service_role',
  'public.mobility_stage_g123_previous_delivery_accept_qa(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('service_role',
  'public.mobility_stage_g123_delivery_priced_qa(uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_delivery_offer(uuid,uuid,uuid,uuid,integer)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.mobility_stage_delivery_offer(uuid,uuid,uuid,uuid,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'G123 privilege leak/broken wrapper'; END IF;
 IF (SELECT count(*) FROM pg_trigger
     WHERE tgrelid='public.mobility_stage_delivery_offers'::regclass
      AND tgname='b10_g123_private_delivery_price' AND NOT tgisinternal)<>1
 OR (SELECT count(*) FROM pg_trigger
     WHERE tgrelid='public.mobility_stage_deliveries'::regclass
      AND tgname='b10_g123_delivery_assignment_price' AND NOT tgisinternal)<>1
 THEN RAISE EXCEPTION 'G123 row-level SQL assignment/offer fence missing'; END IF;
 RAISE NOTICE 'G123 priced cargo PASS: G122 MOTO/AUTO acceptance recognized; both G121 unpriced offers rejected, KYC still blocks, no phantom offers';
END $test$;

-- A historical G36/G38.0 accepted offer was valid before G122 existed,
-- but its old decision cannot be replayed through the new public RPC without
-- original sender fare consent. Legacy privileged cores remain sealed.
DO $test$
DECLARE old_offer public.mobility_stage_delivery_offers%ROWTYPE;
 refused boolean:=false;
BEGIN
 SELECT o.* INTO old_offer FROM public.mobility_stage_delivery_offers o
 JOIN public.mobility_stage_deliveries d ON d.id=o.delivery_id
 WHERE d.request_key='b6360000-0000-4636-8636-000000000013'
  AND o.status='accepted'
  AND o.decision_key IS NOT NULL
 LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'G123 old accepted offer fixture missing'; END IF;
 BEGIN
  PERFORM public.mobility_stage_delivery_accept_offer(
   old_offer.id,old_offer.courier_id,old_offer.decision_key);
 EXCEPTION WHEN SQLSTATE 'P1231' THEN refused:=true; END;
 IF NOT refused THEN RAISE EXCEPTION
  'G123 historical accepted offer replay bypassed sender price consent'; END IF;
 RAISE NOTICE 'G123 stale accepted replay PASS: legacy cargo decisions cannot bypass missing sender fare consent';
END $test$;

-- Safeguard SQL mutation directly at trigger boundary. The test changes only
-- disposable synthetic quotes (PostgreSQL owner), not quoted historical money.
DO $test$
DECLARE moto uuid; quote uuid; declined boolean:=false;
BEGIN
 SELECT delivery_id,quote_id INTO moto,quote
 FROM public.mobility_stage_g122_delivery_price_consents
 WHERE vehicle_kind='MOTO';
 IF moto IS NULL THEN RAISE EXCEPTION 'G123 no MOTO consent'; END IF;
 UPDATE public.mobility_stage_fare_quotes SET expires_at=
  pg_catalog.clock_timestamp()-interval '1 second'
 WHERE id=quote;
 IF public.mobility_stage_g123_delivery_priced_qa(moto)
 THEN RAISE EXCEPTION 'G123 expired quote still dispatchable'; END IF;
 BEGIN
  PERFORM public.mobility_stage_delivery_offer(
   moto,'12200000-0000-4122-8122-000000000001',
   '12200000-0000-4122-8122-000000000001',
   pg_catalog.gen_random_uuid(),30);
 EXCEPTION WHEN SQLSTATE 'P1231' THEN declined:=true; END;
 IF NOT declined THEN RAISE EXCEPTION 'G123 expired cargo quote was offered'; END IF;
 RAISE NOTICE 'G123 expiration PASS: expired accepted quote never authorizes dispatch';
END $test$;
