\set ON_ERROR_STOP on
\ir ../../docs/backend/staging_only/G9_MERCHANT_MANAGEMENT_POSTGRES_CI_ONLY.sql

DO $check$ BEGIN
 IF has_function_privilege('authenticated',
  'public.mobility_stage_merchant_onboarding_request(uuid,uuid,public.mobility_stage_merchant_kind,text)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_catalog_item_upsert(uuid,uuid,uuid,text,text,public.mobility_stage_catalog_class,integer,integer,integer,boolean)','EXECUTE')
 OR has_table_privilege('authenticated','public.mobility_stage_merchant_management_events','SELECT')
 OR has_table_privilege('service_role','public.mobility_stage_merchant_management_events','UPDATE')
 OR has_table_privilege('service_role','public.mobility_stage_merchant_management_events','DELETE')
 THEN RAISE EXCEPTION 'G9 merchant management authority exposed'; END IF;
END $check$;

SET ROLE service_role;
DO $check$
DECLARE v_merchant_id uuid; replay uuid; branch_id uuid; item_id uuid;
 review_event uuid; blocked boolean;
BEGIN
 v_merchant_id:=public.mobility_stage_merchant_onboarding_request(
  '99999999-9999-4999-8999-999999999999',
  '91000000-0000-4000-8000-000000000001','SUPERMARKET','MARKET_FIXTURE');
 replay:=public.mobility_stage_merchant_onboarding_request(
  '99999999-9999-4999-8999-999999999999',
  '91000000-0000-4000-8000-000000000001','SUPERMARKET','MARKET_FIXTURE');
 IF v_merchant_id<>replay THEN RAISE EXCEPTION 'Onboarding replay duplicated'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_merchant_review(v_merchant_id,
   '11111111-1111-4111-8111-111111111111','approve',
   '92000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Non-admin approved merchant'; END IF;
 review_event:=public.mobility_stage_merchant_review(v_merchant_id,
  '22222222-2222-4222-8222-222222222222','approve',
  '92000000-0000-4000-8000-000000000002');
 branch_id:=public.mobility_stage_merchant_branch_upsert(v_merchant_id,
  '99999999-9999-4999-8999-999999999999',
  '93000000-0000-4000-8000-000000000001','CENTRO','MARKET_CENTRO',15,true,true);
 IF branch_id<>public.mobility_stage_merchant_branch_upsert(v_merchant_id,
  '99999999-9999-4999-8999-999999999999',
  '93000000-0000-4000-8000-000000000001','CENTRO','MARKET_CENTRO',15,true,true)
 THEN RAISE EXCEPTION 'Branch replay duplicated'; END IF;
 item_id:=public.mobility_stage_catalog_item_upsert(branch_id,
  '99999999-9999-4999-8999-999999999999',
  '94000000-0000-4000-8000-000000000001','RICE_1','RICE_BAG','GENERAL',
  12000,1000,50,true);
 PERFORM public.mobility_stage_catalog_item_upsert(branch_id,
  '99999999-9999-4999-8999-999999999999',
  '94000000-0000-4000-8000-000000000002','RICE_1','RICE_BAG','GENERAL',
  12500,1000,45,true);
 IF (SELECT revision FROM public.mobility_stage_catalog_items WHERE id=item_id)<>2
  OR (SELECT unit_price_pyg FROM public.mobility_stage_catalog_items WHERE id=item_id)<>12500
 THEN RAISE EXCEPTION 'Catalog update or revision inconsistent'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_catalog_item_upsert(branch_id,
   '99999999-9999-4999-8999-999999999999',
   '94000000-0000-4000-8000-000000000003','RX_BAD','RX_BAD','PHARMACY_OTC',
   5000,50,2,true);
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'OTC catalog opened outside pharmacy'; END IF;
 PERFORM public.mobility_stage_merchant_review(v_merchant_id,
  '22222222-2222-4222-8222-222222222222','suspend',
  '92000000-0000-4000-8000-000000000003');
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_merchant_branch_upsert(v_merchant_id,
   '99999999-9999-4999-8999-999999999999',
   '93000000-0000-4000-8000-000000000002','CENTRO','MARKET_CENTRO',10,true,true);
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked OR (SELECT accepting_orders FROM public.mobility_stage_merchant_branches
  WHERE id=branch_id)<>false THEN RAISE EXCEPTION 'Suspended merchant remained operable'; END IF;
 IF review_event IS NULL OR (SELECT count(*)
  FROM public.mobility_stage_merchant_management_events e
  WHERE e.merchant_id=v_merchant_id)<>6
 THEN RAISE EXCEPTION 'Merchant management audit inconsistent'; END IF;
END $check$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
DO $check$ DECLARE n integer; blocked boolean:=false; BEGIN
 SELECT count(*) INTO n FROM public.mobility_stage_merchant_staff;
 IF n<>1 THEN RAISE EXCEPTION 'Owner cannot read own staff membership'; END IF;
 BEGIN UPDATE public.mobility_stage_catalog_items SET unit_price_pyg=100;
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Client mutated catalog directly'; END IF;
END $check$;
RESET ROLE;
\echo PASS: G9 idempotent merchant onboarding, admin approval, branch/catalog management, suspension and private audit.
