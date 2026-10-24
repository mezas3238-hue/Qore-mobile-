\set ON_ERROR_STOP on
-- G6 merchant/order contract on disposable PostgreSQL after G5 custody smoke.
\ir ../../docs/backend/staging_only/G6_MERCHANT_ORDERS_POSTGRES_CI_ONLY.sql

DO $check$ BEGIN
 IF has_function_privilege('authenticated',
  'public.mobility_stage_merchant_order_request(uuid,uuid,uuid,public.mobility_vehicle_kind,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_merchant_order_transition(uuid,uuid,text,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_merchant_order_attach_delivery(uuid,uuid,uuid,uuid)','EXECUTE')
 OR has_table_privilege('authenticated','public.mobility_stage_merchant_orders','INSERT')
 OR has_table_privilege('authenticated','public.mobility_stage_catalog_items','UPDATE')
 OR has_table_privilege('authenticated','public.mobility_stage_merchant_order_events','SELECT')
 OR has_table_privilege('service_role','public.mobility_stage_merchant_order_events','UPDATE')
 OR has_table_privilege('service_role','public.mobility_stage_merchant_order_events','DELETE')
 THEN RAISE EXCEPTION 'G6 server RPC, inventory or audit exposed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_enum e JOIN pg_catalog.pg_type t ON t.oid=e.enumtypid
  WHERE t.typname='mobility_stage_catalog_class'
   AND e.enumlabel IN ('PRESCRIPTION','CONTROLLED'))
 THEN RAISE EXCEPTION 'Regulated pharmacy category enabled'; END IF;
END $check$;

INSERT INTO public.mobility_stage_merchants
 (id,onboarding_key,owner_id,kind,display_tag,status,reviewed_by,reviewed_at)
VALUES('60000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000011',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','RESTAURANT','RESTAURANT_FIXTURE',
 'approved','22222222-2222-4222-8222-222222222222',now()-interval '1 day');
INSERT INTO public.mobility_stage_merchant_staff(merchant_id,user_id,staff_role)
VALUES('60000000-0000-4000-8000-000000000001',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner');
INSERT INTO public.mobility_stage_merchant_branches
 (id,merchant_id,branch_tag,pickup_tag,active,accepting_orders,preparation_minutes)
VALUES('60000000-0000-4000-8000-000000000002',
 '60000000-0000-4000-8000-000000000001','CENTRO','RESTAURANT_HQ',true,true,20);
INSERT INTO public.mobility_stage_catalog_items
 (id,branch_id,sku,item_tag,item_class,unit_price_pyg,unit_grams,stock_units)
VALUES
 ('60000000-0000-4000-8000-000000000003',
  '60000000-0000-4000-8000-000000000002','FOOD_A','MEAL_A','GENERAL',15000,500,10),
 ('60000000-0000-4000-8000-000000000004',
  '60000000-0000-4000-8000-000000000002','FOOD_B','DRINK_A','GENERAL',10000,300,10),
 ('60000000-0000-4000-8000-000000000005',
  '60000000-0000-4000-8000-000000000002','OTC_BAD','OTC_WRONG_STORE','PHARMACY_OTC',5000,50,2);
UPDATE public.driver_locations SET available=true,updated_at=now()-interval '2 seconds'
 WHERE driver_id='11111111-1111-4111-8111-111111111111';

SET ROLE service_role;
DO $check$
DECLARE order_id uuid; replay uuid; cancelled uuid; delivery_id uuid;
 proof uuid:='64000000-0000-4000-8000-000000000001';
 blocked boolean; before_stock integer; n integer;
 basket jsonb:='[{"itemId":"60000000-0000-4000-8000-000000000003","quantity":2},{"itemId":"60000000-0000-4000-8000-000000000004","quantity":1}]';
BEGIN
 order_id:=public.mobility_stage_merchant_order_request(
  '33333333-3333-4333-8333-333333333333',
  '61000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000002','AUTO',basket);
 replay:=public.mobility_stage_merchant_order_request(
  '33333333-3333-4333-8333-333333333333',
  '61000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000002','AUTO',basket);
 IF order_id<>replay OR
  (SELECT subtotal_pyg FROM public.mobility_stage_merchant_orders WHERE id=order_id)<>40000
 OR (SELECT stock_units FROM public.mobility_stage_catalog_items
     WHERE id='60000000-0000-4000-8000-000000000003')<>8
 THEN RAISE EXCEPTION 'Idempotent basket, subtotal or reservation inconsistent'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_merchant_order_request(
   '33333333-3333-4333-8333-333333333333',
   '61000000-0000-4000-8000-000000000001',
   '60000000-0000-4000-8000-000000000002','AUTO',
   '[{"itemId":"60000000-0000-4000-8000-000000000003","quantity":3}]');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Conflicting order replay accepted'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_merchant_order_request(
   '88888888-8888-4888-8888-888888888888',
   '61000000-0000-4000-8000-000000000002',
   '60000000-0000-4000-8000-000000000002','MOTO',
   '[{"itemId":"60000000-0000-4000-8000-000000000005","quantity":1}]');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'OTC sold by non-pharmacy'; END IF;

 PERFORM public.mobility_stage_merchant_order_transition(order_id,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','confirm',
  '62000000-0000-4000-8000-000000000001');
 PERFORM public.mobility_stage_merchant_order_transition(order_id,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','start_preparing',
  '62000000-0000-4000-8000-000000000002');
 PERFORM public.mobility_stage_merchant_order_transition(order_id,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ready',
  '62000000-0000-4000-8000-000000000003');
 delivery_id:=public.mobility_stage_delivery_request(
  '33333333-3333-4333-8333-333333333333',
  '63000000-0000-4000-8000-000000000001','AUTO','RESTAURANT',
  1300,40,30,25,'RESTAURANT_HQ','CUSTOMER_C',false);
 PERFORM public.mobility_stage_merchant_order_attach_delivery(order_id,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',delivery_id,
  '62000000-0000-4000-8000-000000000004');
 PERFORM public.mobility_stage_delivery_accept(delivery_id,
  '11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555',
  '63000000-0000-4000-8000-000000000002');
 PERFORM public.mobility_stage_delivery_transition(delivery_id,
  '11111111-1111-4111-8111-111111111111','pickup',
  '63000000-0000-4000-8000-000000000003');
 PERFORM public.mobility_stage_merchant_order_transition(order_id,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','hand_to_courier',
  '62000000-0000-4000-8000-000000000005');
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_merchant_order_transition(order_id,
   '33333333-3333-4333-8333-333333333333','complete',
   '62000000-0000-4000-8000-000000000006');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Order completed before delivery proof'; END IF;
 PERFORM public.mobility_stage_delivery_transition(delivery_id,
  '11111111-1111-4111-8111-111111111111','deliver',
  '63000000-0000-4000-8000-000000000004',proof);
 PERFORM public.mobility_stage_merchant_order_transition(order_id,
  '33333333-3333-4333-8333-333333333333','complete',
  '62000000-0000-4000-8000-000000000007');
 IF (SELECT status FROM public.mobility_stage_merchant_orders WHERE id=order_id)<>'delivered'
 OR (SELECT revision FROM public.mobility_stage_merchant_orders WHERE id=order_id)<>7
 THEN RAISE EXCEPTION 'Merchant preparation/delivery chain inconsistent'; END IF;

 SELECT stock_units INTO before_stock FROM public.mobility_stage_catalog_items
  WHERE id='60000000-0000-4000-8000-000000000004';
 cancelled:=public.mobility_stage_merchant_order_request(
  '88888888-8888-4888-8888-888888888888',
  '61000000-0000-4000-8000-000000000003',
  '60000000-0000-4000-8000-000000000002','MOTO',
  '[{"itemId":"60000000-0000-4000-8000-000000000004","quantity":2}]');
 PERFORM public.mobility_stage_merchant_order_transition(cancelled,
  '88888888-8888-4888-8888-888888888888','cancel',
  '62000000-0000-4000-8000-000000000008');
 IF (SELECT stock_units FROM public.mobility_stage_catalog_items
     WHERE id='60000000-0000-4000-8000-000000000004')<>before_stock
 THEN RAISE EXCEPTION 'Cancelled order did not restore inventory'; END IF;
 SELECT count(*) INTO n FROM public.mobility_stage_merchant_order_events e
  WHERE e.order_id=(SELECT id FROM public.mobility_stage_merchant_orders
   WHERE request_key='61000000-0000-4000-8000-000000000001');
 IF n<>6 THEN RAISE EXCEPTION 'Append-only order event count inconsistent'; END IF;
END $check$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $check$ DECLARE n integer; blocked boolean:=false; BEGIN
 SELECT count(*) INTO n FROM public.mobility_stage_merchant_orders;
 IF n<>1 THEN RAISE EXCEPTION 'Buyer cannot see exactly own order'; END IF;
 BEGIN UPDATE public.mobility_stage_catalog_items SET stock_units=999;
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Buyer mutated catalog inventory'; END IF;
END $check$;
SET request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $check$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.mobility_stage_merchant_orders;
 IF n<>2 THEN RAISE EXCEPTION 'Merchant staff cannot see branch orders'; END IF;
END $check$;
SET request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';
DO $check$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.mobility_stage_merchant_orders;
 IF n<>0 THEN RAISE EXCEPTION 'Outsider can see merchant orders'; END IF;
END $check$;
RESET ROLE;
\echo PASS: G6 merchant catalog, atomic inventory, preparation, G5 delivery linkage and participant RLS.
