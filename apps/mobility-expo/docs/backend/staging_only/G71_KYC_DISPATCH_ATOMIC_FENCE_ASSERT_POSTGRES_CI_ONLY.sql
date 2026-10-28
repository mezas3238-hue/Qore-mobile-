-- G71 SQL tests: negative dispatch and acceptance; verified renewal; no PII.
DO $g$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g71_valid_locked_dossier(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G71 must run in isolated disposable chain'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_trigger WHERE NOT tgisinternal
   AND tgname IN ('a00_g71_auto_offer','a00_g71_delivery_offer',
   'a00_g71_auto_assign','a00_g71_delivery_assign'))<>4
 THEN RAISE EXCEPTION 'G71 missing one or more DML KYC fences'; END IF;
 IF has_function_privilege('service_role','public.mobility_stage_g71_valid_locked_dossier(uuid,uuid)','EXECUTE')
 OR has_function_privilege('service_role','public.mobility_stage_g71_auto_accept_core(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('service_role','public.mobility_stage_g71_delivery_offer_core(uuid,uuid,uuid,uuid,integer)','EXECUTE')
 OR has_function_privilege('authenticated','public.mobility_stage_auto_demo_offer(uuid,uuid,uuid,uuid,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'G71 exposed internal SQL authority'; END IF;
END $g$;

DO $t$
DECLARE
 d uuid:='00000000-0000-4000-8000-000000000181';
 v uuid:='71710000-0000-4717-8717-000000000101';
 trip uuid; cargo uuid; auto_offer uuid; delivery_offer uuid;
 rejected boolean; k uuid:=pg_catalog.gen_random_uuid();
BEGIN
 -- Expiry QA fixture ends with a suspended vehicle.
 IF public.mobility_stage_g71_valid_locked_dossier(d,v)
 THEN RAISE EXCEPTION 'G71 suspended dossier approved'; END IF;
 rejected:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_offer(pg_catalog.gen_random_uuid(),d,v,k,10);
 EXCEPTION WHEN SQLSTATE 'P7401' THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'G71 suspended AUTO offer escaped'; END IF;
 rejected:=false;
 BEGIN
  PERFORM public.mobility_stage_delivery_offer(pg_catalog.gen_random_uuid(),d,v,k,10);
 EXCEPTION WHEN SQLSTATE 'P7401' THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'G71 suspended DELIVERY offer escaped'; END IF;

 UPDATE public.mobility_vehicles SET review_status='approved' WHERE id=v;
 IF NOT public.mobility_stage_g71_valid_locked_dossier(d,v)
 THEN RAISE EXCEPTION 'G71 verified renewal not ready'; END IF;

 SELECT t.id INTO trip FROM public.mobility_stage_auto_demo_trips t
  WHERE NOT EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_offers o
   WHERE o.trip_id=t.id AND o.driver_id=d) ORDER BY t.id LIMIT 1;
 SELECT t.id INTO cargo FROM public.mobility_stage_deliveries t
  WHERE NOT EXISTS(SELECT 1 FROM public.mobility_stage_delivery_offers o
   WHERE o.delivery_id=t.id AND o.courier_id=d) ORDER BY t.id LIMIT 1;
 IF trip IS NULL OR cargo IS NULL
 THEN RAISE EXCEPTION 'G71 disposable delivery and trip fixtures absent'; END IF;
 INSERT INTO public.mobility_stage_auto_demo_offers(
  request_key,trip_id,driver_id,vehicle_id,ttl_seconds,expires_at)
 VALUES(pg_catalog.gen_random_uuid(),trip,d,v,10,
        pg_catalog.clock_timestamp()+interval '10 seconds') RETURNING id INTO auto_offer;
 INSERT INTO public.mobility_stage_delivery_offers(
  request_key,delivery_id,courier_id,vehicle_id,ttl_seconds,expires_at)
 VALUES(pg_catalog.gen_random_uuid(),cargo,d,v,10,
        pg_catalog.clock_timestamp()+interval '10 seconds') RETURNING id INTO delivery_offer;
 IF auto_offer IS NULL OR delivery_offer IS NULL
 THEN RAISE EXCEPTION 'G71 current dossier could not pass SQL offer guards'; END IF;

 UPDATE public.mobility_stage_kyc_verified_evidence_qa
 SET valid_until=pg_catalog.clock_timestamp()-interval '1 second',
     evidence_revision=evidence_revision+1
 WHERE driver_id=d AND vehicle_id=v AND kind='seguro';
 IF public.mobility_stage_g71_valid_locked_dossier(d,v)
 THEN RAISE EXCEPTION 'G71 expired insurance still eligible'; END IF;
 rejected:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_accept_offer(
    auto_offer,d,pg_catalog.gen_random_uuid());
 EXCEPTION WHEN SQLSTATE 'P7401' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G71 expired AUTO acceptance escaped'; END IF;
 rejected:=false;
 BEGIN
  PERFORM public.mobility_stage_delivery_accept_offer(
    delivery_offer,d,pg_catalog.gen_random_uuid());
 EXCEPTION WHEN SQLSTATE 'P7401' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G71 expired courier acceptance escaped'; END IF;
 rejected:=false;
 BEGIN
  INSERT INTO public.mobility_stage_delivery_offers(
   request_key,delivery_id,courier_id,vehicle_id,ttl_seconds,expires_at)
  VALUES(pg_catalog.gen_random_uuid(),cargo,d,v,10,
         pg_catalog.clock_timestamp()+interval '10 seconds');
 EXCEPTION WHEN SQLSTATE 'P7401' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G71 direct SQL offer bypassed expiry'; END IF;
 -- This assertion names a real SQL trigger path before G37/G38 older fences.
 rejected:=false;
 BEGIN
  UPDATE public.mobility_stage_auto_demo_trips SET
   driver_id=d,vehicle_id=v,status='accepted'
   WHERE id=trip AND status='searching';
 EXCEPTION WHEN SQLSTATE 'P7401' THEN rejected:=true; END;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_trips
   WHERE id=trip AND status='searching') AND NOT rejected
 THEN RAISE EXCEPTION 'G71 direct assignment KYC guard absent'; END IF;

 UPDATE public.mobility_stage_kyc_verified_evidence_qa SET
  valid_until=pg_catalog.clock_timestamp()+interval '40 days',
  evidence_revision=evidence_revision+1
 WHERE driver_id=d AND vehicle_id=v AND kind='seguro';
 IF NOT public.mobility_stage_g71_valid_locked_dossier(d,v)
 THEN RAISE EXCEPTION 'G71 verified renewal not restored'; END IF;
 PERFORM public.mobility_stage_register_driver_document(
  d,pg_catalog.gen_random_uuid(),'seguro',
  d::text||'/seguro-G71-PENDINGREPLACEMENT.jpg','image/jpeg',9001,repeat('e',64));
 IF public.mobility_stage_g71_valid_locked_dossier(d,v)
 THEN RAISE EXCEPTION 'G71 pending replacement reused old approval'; END IF;
 rejected:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_offer(trip,d,v,k,10);
 EXCEPTION WHEN SQLSTATE 'P7401' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G71 offer replay bypassed updated KYC'; END IF;
 RAISE NOTICE 'G71 PASS: offer, accept, assignment SQL, expiry, suspension, renewal, pending upload, replay';
END $t$;
SET ROLE service_role;
DO $p$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g71_valid_locked_dossier(
   '00000000-0000-4000-8000-000000000181',
   '71710000-0000-4717-8717-000000000101');
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G71 private helper leaked'; END IF;
END $p$;
RESET ROLE;
