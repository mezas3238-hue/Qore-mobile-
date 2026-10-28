-- G45: transactional order, server pricing, idempotent replay, no oversell,
-- stale revision and exact restock after cancellation. PG16 disposable only.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g45_reserve_order_qa(uuid,uuid,bigint,uuid,uuid,bigint,public.mobility_vehicle_kind,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'G45 SQL tests refuse unsafe DB'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='75s';
INSERT INTO auth.users(id) VALUES
 ('45450000-0000-4545-8545-000000000001'),
 ('45450000-0000-4545-8545-000000000002'),
 ('45450000-0000-4545-8545-000000000003'),
 ('45450000-0000-4545-8545-000000000004'),
 ('45450000-0000-4545-8545-000000000005')
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('45450000-0000-4545-8545-000000000001','passenger'),
 ('45450000-0000-4545-8545-000000000002','passenger'),
 ('45450000-0000-4545-8545-000000000003','passenger')
ON CONFLICT DO NOTHING;
INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind
) SELECT
 ('45450000-0000-4545-8545-'||lpad(n::text,12,'0'))::uuid,
 ('45450000-0000-4545-8545-'||lpad((100+n)::text,12,'0'))::uuid,
 pg_catalog.clock_timestamp()-interval '1 hour',
 pg_catalog.clock_timestamp()-interval '2 minutes',
 pg_catalog.clock_timestamp()+interval '1 hour',
 'QA_SYNTHETIC_PROVIDER_SESSION_ONLY'
 FROM pg_catalog.generate_series(1,3) n;
INSERT INTO public.mobility_stage_g31_zone_coverage(
 zone_id,municipality,service_kind,coverage_status
) VALUES('45450000-0000-4545-8545-000000000010','Asuncion','AUTO_DELIVERY','ACTIVE');
INSERT INTO public.mobility_stage_merchants(
 id,onboarding_key,owner_id,kind,display_tag,status,reviewed_by,reviewed_at
) VALUES(
 '45450000-0000-4545-8545-000000000020',
 '45450000-0000-4545-8545-000000000021',
 '45450000-0000-4545-8545-000000000004',
 'SUPERMARKET','QA_SHOP','approved',
 '45450000-0000-4545-8545-000000000005',pg_catalog.clock_timestamp()
);
INSERT INTO public.mobility_stage_merchant_branches(
 id,merchant_id,branch_tag,pickup_tag,preparation_minutes,active,accepting_orders
) VALUES(
 '45450000-0000-4545-8545-000000000030',
 '45450000-0000-4545-8545-000000000020',
 'QA_BRANCH','QA_PICKUP',12,true,true);
INSERT INTO public.mobility_stage_g44_branch_geography(branch_id,zone_id,service_kind)
 VALUES('45450000-0000-4545-8545-000000000030',
        '45450000-0000-4545-8545-000000000010','AUTO_DELIVERY');
INSERT INTO public.mobility_stage_catalog_items(
 id,branch_id,sku,item_tag,item_class,unit_price_pyg,unit_grams,stock_units
) VALUES('45450000-0000-4545-8545-000000000040',
 '45450000-0000-4545-8545-000000000030',
 'G45SKU','G45_TEST_ITEM','GENERAL',25000,300,2);

DO $checks$
DECLARE
 buyer uuid:='45450000-0000-4545-8545-000000000001';
 second_buyer uuid:='45450000-0000-4545-8545-000000000002';
 third_buyer uuid:='45450000-0000-4545-8545-000000000003';
 session uuid:='45450000-0000-4545-8545-000000000101';
 ses2 uuid:='45450000-0000-4545-8545-000000000102';
 ses3 uuid:='45450000-0000-4545-8545-000000000103';
 branch uuid:='45450000-0000-4545-8545-000000000030';
 stock_item uuid:='45450000-0000-4545-8545-000000000040';
 request1 uuid:='45450000-0000-4545-8545-000000000201';
 request2 uuid:='45450000-0000-4545-8545-000000000202';
 request3 uuid:='45450000-0000-4545-8545-000000000203';
 cancel1 uuid:='45450000-0000-4545-8545-000000000301';
 iat bigint:=floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint;
 version1 bigint;version2 bigint;version3 bigint;
 items jsonb:='[{"itemId":"45450000-0000-4545-8545-000000000040","quantity":1}]'::jsonb;
 a jsonb;b jsonb;c jsonb; d jsonb;
 denied boolean;
BEGIN
 IF has_function_privilege('service_role',
  'public.mobility_stage_g45_reserve_order_qa(uuid,uuid,bigint,uuid,uuid,bigint,public.mobility_vehicle_kind,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g45_cancel_order_qa(uuid,uuid,bigint,uuid,uuid)','EXECUTE')
 OR has_table_privilege('service_role','public.mobility_stage_g45_order_receipts','INSERT')
 THEN RAISE EXCEPTION 'G45 owner-only QA privileges leaked'; END IF;

 SELECT revision INTO version1 FROM public.mobility_stage_g44_catalog_versions
 WHERE branch_id=branch;
 a:=public.mobility_stage_g45_reserve_order_qa(
 buyer,session,iat,request1,branch,version1,'AUTO',items);
 b:=public.mobility_stage_g45_reserve_order_qa(
 buyer,session,iat,request1,branch,version1,'AUTO',items);
 IF a<>b OR (a->>'subtotalPyg')::integer<>25000
 OR a->>'receiptStatus'<>'QA_RESERVED_NO_PAYMENT'
 OR (a->>'orderEnabled')<>'false'
 OR (SELECT stock_units FROM public.mobility_stage_catalog_items
    WHERE id=stock_item)<>1
 THEN RAISE EXCEPTION 'G45 server pricing or idempotent stock failed'; END IF;

 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g45_reserve_order_qa(
    second_buyer,ses2,iat,request1,branch,version1,'AUTO',items);
 EXCEPTION WHEN SQLSTATE 'G4509' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G45 cross-buyer replay accepted'; END IF;

 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g45_reserve_order_qa(
    second_buyer,ses2,iat,request2,branch,version1,'AUTO',items);
 EXCEPTION WHEN SQLSTATE 'G4509' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G45 stale version consumed stock'; END IF;

 SELECT revision INTO version2 FROM public.mobility_stage_g44_catalog_versions
 WHERE branch_id=branch;
 c:=public.mobility_stage_g45_reserve_order_qa(
 second_buyer,ses2,iat,request2,branch,version2,'AUTO',items);
 IF (c->>'subtotalPyg')::integer<>25000 OR
 (SELECT stock_units FROM public.mobility_stage_catalog_items
 WHERE id=stock_item)<>0 THEN RAISE EXCEPTION 'G45 second reservation oversold'; END IF;

 SELECT revision INTO version3 FROM public.mobility_stage_g44_catalog_versions
 WHERE branch_id=branch;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g45_reserve_order_qa(
    third_buyer,ses3,iat,request3,branch,version3,'AUTO',items);
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied OR EXISTS(SELECT 1 FROM public.mobility_stage_merchant_orders
  WHERE request_key=request3)
 THEN RAISE EXCEPTION 'G45 out of stock wrote phantom order'; END IF;

 d:=public.mobility_stage_g45_cancel_order_qa(
 buyer,session,iat,(a->>'orderId')::uuid,cancel1);
 IF d->>'receiptStatus'<>'QA_CANCELLED_STOCK_RESTORED'
 OR d->>'refundStatus'<>'NO_PSP_NO_FINANCIAL_REFUND'
 OR d<>public.mobility_stage_g45_cancel_order_qa(
 buyer,session,iat,(a->>'orderId')::uuid,cancel1)
 OR (SELECT stock_units FROM public.mobility_stage_catalog_items
  WHERE id=stock_item)<>1
 THEN RAISE EXCEPTION 'G45 cancel replay or precise restock failed'; END IF;

 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g45_cancel_order_qa(
   second_buyer,ses2,iat,(a->>'orderId')::uuid,
   '45450000-0000-4545-8545-000000000302');
 EXCEPTION WHEN SQLSTATE 'G4503' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G45 foreign order cancelled'; END IF;

 -- G140: AUTO-only branch must fail MOTO even with valid fresh revision.
 SELECT revision INTO version3 FROM public.mobility_stage_g44_catalog_versions
 WHERE branch_id=branch;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g45_reserve_order_qa(
   third_buyer,ses3,iat,request3,branch,version3,'MOTO',items);
 EXCEPTION WHEN SQLSTATE 'G4503' THEN denied:=true; END;
 IF NOT denied OR EXISTS(SELECT 1 FROM public.mobility_stage_merchant_orders
   WHERE request_key=request3)
 THEN RAISE EXCEPTION 'G140 mismatched MOTO on AUTO zone'; END IF;
 -- G44 synthetic geography never grants real courier legality.
 INSERT INTO public.mobility_stage_g31_zone_coverage(
  zone_id,municipality,service_kind,coverage_status
 ) VALUES('45450000-0000-4545-8545-000000000010',
   'Asuncion','MOTO_DELIVERY','ACTIVE');
 UPDATE public.mobility_stage_g44_branch_geography
 SET service_kind='MOTO_DELIVERY' WHERE branch_id=branch;
 SELECT revision INTO version3 FROM public.mobility_stage_g44_catalog_versions
 WHERE branch_id=branch;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g45_reserve_order_qa(
   buyer,session,iat,'45450000-0000-4545-8545-000000000204',
   branch,version3,'AUTO',items);
 EXCEPTION WHEN SQLSTATE 'G4503' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G140 AUTO accepted MOTO-only zone'; END IF;
 a:=public.mobility_stage_g45_reserve_order_qa(
   third_buyer,ses3,iat,request3,branch,version3,'MOTO',items);
 IF a->>'receiptStatus'<>'QA_RESERVED_NO_PAYMENT'
 OR (SELECT requested_vehicle_kind FROM public.mobility_stage_merchant_orders
   WHERE id=(a->>'orderId')::uuid) IS DISTINCT FROM 'MOTO'
 OR (SELECT stock_units FROM public.mobility_stage_catalog_items
   WHERE id=stock_item)<>0
 THEN RAISE EXCEPTION 'G140 MOTO stock reservation failed'; END IF;
 IF a<>public.mobility_stage_g45_reserve_order_qa(
   third_buyer,ses3,iat,request3,branch,version3,'MOTO',items)
 THEN RAISE EXCEPTION 'G140 MOTO key replay consumed stock'; END IF;
 d:=public.mobility_stage_g45_cancel_order_qa(
   third_buyer,ses3,iat,(a->>'orderId')::uuid,
   '45450000-0000-4545-8545-000000000303');
 IF d->>'receiptStatus'<>'QA_CANCELLED_STOCK_RESTORED'
 OR (SELECT stock_units FROM public.mobility_stage_catalog_items
   WHERE id=stock_item)<>1
 THEN RAISE EXCEPTION 'G140 MOTO cancellation restock failed'; END IF;
 RAISE NOTICE 'G140 PASS: mapped MOTO and AUTO branches cannot cross; PG16 reservation, idempotency and stock release';
 RAISE NOTICE 'G45 PASS: durable idempotent receipts, server PYG, version fence, stock and exact cancel';
END $checks$;
SET LOCAL ROLE service_role;
DO $denied$
DECLARE forbidden boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g45_reserve_order_qa(
  '45450000-0000-4545-8545-000000000001',
  '45450000-0000-4545-8545-000000000101',
  floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint,
  '45450000-0000-4545-8545-000000000401',
  '45450000-0000-4545-8545-000000000030',1,'AUTO','[]'::jsonb);
 EXCEPTION WHEN insufficient_privilege THEN forbidden:=true; END;
 IF NOT forbidden THEN RAISE EXCEPTION 'G45 service_role invoked owner-only order fixture'; END IF;
END $denied$;
RESET ROLE;
ROLLBACK;
