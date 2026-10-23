-- G46: detect all legacy G6/G9 commerce grants including PUBLIC-inherited,
-- and prove service_role can neither read nor mutate nor call spoofable RPC.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g45_reserve_order_qa(uuid,uuid,bigint,uuid,uuid,bigint,public.mobility_vehicle_kind,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'G46 assertions refuse remote/incomplete DB'; END IF;
END $guard$;
BEGIN;
DO $audit$
DECLARE
 target text; rel text; permission text; signature text;
 tables text[]:=ARRAY[
 'mobility_stage_merchants',
 'mobility_stage_merchant_staff',
 'mobility_stage_merchant_branches',
 'mobility_stage_catalog_items',
 'mobility_stage_merchant_orders',
 'mobility_stage_merchant_order_lines',
 'mobility_stage_merchant_order_events',
 'mobility_stage_merchant_management_events'
 ];
 routines text[]:=ARRAY[
 'public.mobility_stage_merchant_order_request(uuid,uuid,uuid,public.mobility_vehicle_kind,jsonb)',
 'public.mobility_stage_merchant_order_transition(uuid,uuid,text,uuid)',
 'public.mobility_stage_merchant_order_attach_delivery(uuid,uuid,uuid,uuid)',
 'public.mobility_stage_merchant_onboarding_request(uuid,uuid,public.mobility_stage_merchant_kind,text)',
 'public.mobility_stage_merchant_review(uuid,uuid,text,uuid)',
 'public.mobility_stage_merchant_branch_upsert(uuid,uuid,uuid,text,text,integer,boolean,boolean)',
 'public.mobility_stage_catalog_item_upsert(uuid,uuid,uuid,text,text,public.mobility_stage_catalog_class,integer,integer,integer,boolean)',
 'public.mobility_stage_g44_buyer_branches_page(uuid,uuid,bigint,text,text,uuid,integer)',
 'public.mobility_stage_g44_buyer_catalog_page(uuid,uuid,bigint,uuid,bigint,uuid,integer)',
 'public.mobility_stage_g45_reserve_order_qa(uuid,uuid,bigint,uuid,uuid,bigint,public.mobility_vehicle_kind,jsonb)',
 'public.mobility_stage_g45_cancel_order_qa(uuid,uuid,bigint,uuid,uuid)'
 ];
BEGIN
 FOREACH target IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  FOREACH rel IN ARRAY tables LOOP
   FOREACH permission IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE',
     'TRUNCATE','REFERENCES','TRIGGER'] LOOP
    IF pg_catalog.has_table_privilege(target,'public.'||rel,permission)
    THEN RAISE EXCEPTION 'G46 privilege leak: %.% %',target,rel,permission; END IF;
   END LOOP;
  END LOOP;
  FOREACH signature IN ARRAY routines LOOP
   IF pg_catalog.to_regprocedure(signature) IS NULL
   THEN RAISE EXCEPTION 'G46 missing procedure: %',signature; END IF;
   IF pg_catalog.has_function_privilege(target,signature,'EXECUTE')
   THEN RAISE EXCEPTION 'G46 executable spoofable commerce RPC: % %',
      target,signature; END IF;
  END LOOP;
 END LOOP;
 IF NOT pg_catalog.has_function_privilege(current_user,
    routines[10],'EXECUTE')
 OR NOT pg_catalog.has_function_privilege(current_user,
    routines[11],'EXECUTE')
 THEN RAISE EXCEPTION 'G46 fixture DB owner lost legitimate internal authority'; END IF;
 RAISE NOTICE 'G46 PASS: 8 tables x 3 roles x 7 rights; 11 functions x 3 roles; owner preserved';
END $audit$;
SET LOCAL ROLE service_role;
DO $attack$
DECLARE denied boolean;
BEGIN
 denied:=false;
 BEGIN
  PERFORM 1 FROM public.mobility_stage_catalog_items LIMIT 1;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G46 service_role SELECT catalog bypass'; END IF;
 denied:=false;
 BEGIN
  UPDATE public.mobility_stage_catalog_items SET stock_units=1000 WHERE false;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G46 service_role UPDATE inventory bypass'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_merchant_order_request(
   NULL::uuid,NULL::uuid,NULL::uuid,
   NULL::public.mobility_vehicle_kind,NULL::jsonb);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G46 service_role legacy G6 RPC bypass'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g44_buyer_catalog_page(
    NULL::uuid,NULL::uuid,NULL::bigint,NULL::uuid,NULL::bigint,NULL::uuid,100);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G46 service_role G44 actor spoof bypass'; END IF;
 RAISE NOTICE 'G46 PASS: service_role direct SELECT/UPDATE/G6/G44 refused';
END $attack$;
RESET ROLE;
ROLLBACK;
