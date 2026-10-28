-- G26.4: adversarial DB assertions against backdated service-role writes,
-- owner reassignment, changing the history cursor order, and identity edits.
-- Should be applied only after 31,200 synthetic historical seed rows.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G26.4 assertions must be disposable'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
DO $reject_update$
DECLARE
 src record;
 cmd text;
 denied boolean;
 rejected_count integer:=0;
BEGIN
 FOR src IN SELECT * FROM (VALUES
   ('mobility_stage_auto_demo_trips','passenger_id'),
   ('mobility_stage_deliveries','sender_id'),
   ('mobility_stage_merchant_orders','buyer_id')
 ) x(table_name,owner_column) LOOP
  FOR cmd IN SELECT test_sql FROM (VALUES
   (format('UPDATE public.%I SET created_at=created_at-interval ''90 days''
     WHERE id=(SELECT id FROM public.%I ORDER BY id LIMIT 1)',
     src.table_name,src.table_name)),
   (format('UPDATE public.%I SET %I=%L::uuid
     WHERE id=(SELECT id FROM public.%I ORDER BY id LIMIT 1)',
     src.table_name,src.owner_column,
     'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',src.table_name)),
   (format('UPDATE public.%I SET request_key=gen_random_uuid()
     WHERE id=(SELECT id FROM public.%I ORDER BY id LIMIT 1)',
     src.table_name,src.table_name)),
   (format('UPDATE public.%I SET id=gen_random_uuid()
     WHERE id=(SELECT id FROM public.%I ORDER BY id LIMIT 1)',
     src.table_name,src.table_name))
  ) checks(test_sql) LOOP
   denied:=false;
   BEGIN
    EXECUTE cmd;
   EXCEPTION WHEN SQLSTATE 'G2601' THEN denied:=true;
   END;
   IF NOT denied THEN RAISE EXCEPTION
    'G26.4 immutable history protection bypassed on table % with query %',
    src.table_name,cmd; END IF;
   rejected_count:=rejected_count+1;
  END LOOP;
 END LOOP;
 IF rejected_count<>12 THEN RAISE EXCEPTION
  'G26.4 checked only % of 12 historic UPDATE rejections',rejected_count; END IF;
 RAISE NOTICE 'G26.4 rejected % owner/date/id/request-key edits',rejected_count;
END $reject_update$;

DO $reject_insert$
DECLARE
 cmd text;
 denied boolean;
 count_denied integer:=0;
BEGIN
 FOR cmd IN SELECT sql_text FROM (VALUES
  ($sql$
   INSERT INTO public.mobility_stage_auto_demo_trips
    (request_key,passenger_id,service,origin_tag,destination_tag,status,created_at)
   VALUES(gen_random_uuid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
   'economico','PANTEON','SHOPPING','cancelled',
   '2020-01-01T00:00:00Z'::timestamptz)
   $sql$),
  ($sql$
   INSERT INTO public.mobility_stage_deliveries
    (request_key,sender_id,requested_vehicle_kind,category,
     grams,length_cm,width_cm,height_cm,pickup_tag,delivery_tag,status,created_at)
   VALUES(gen_random_uuid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'MOTO','PARCEL',150,10,10,10,'WAREHOUSE_ONE','CUSTOMER_ONE','cancelled',
    '2020-01-01T00:00:00Z'::timestamptz)
   $sql$),
  ($sql$
   INSERT INTO public.mobility_stage_merchant_orders
    (request_key,buyer_id,merchant_id,branch_id,requested_vehicle_kind,
     items_request,subtotal_pyg,status,created_at)
   VALUES(gen_random_uuid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
    'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid,
    'AUTO','[]'::jsonb,1000,'cancelled',
    '2020-01-01T00:00:00Z'::timestamptz)
   $sql$)
 ) t(sql_text) LOOP
  denied:=false;
  BEGIN EXECUTE cmd;
  EXCEPTION WHEN SQLSTATE 'G2601' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION
   'G26.4 backdated historic insert was accepted'; END IF;
  count_denied:=count_denied+1;
 END LOOP;
 IF count_denied<>3 THEN RAISE EXCEPTION
  'G26.4 only rejected % of 3 backdated inserts',count_denied; END IF;
 RAISE NOTICE 'G26.4 rejected % backdated INSERT operations',count_denied;
END $reject_insert$;

-- Legitimate new service-side writes must remain functional: server-default
-- transaction_timestamp() plus immutable identifiers with mutable lifecycle.
INSERT INTO public.mobility_stage_auto_demo_trips
 (id,request_key,passenger_id,service,origin_tag,destination_tag,status)
VALUES ('a1111111-1111-4111-8111-111111111111',
 'a2222222-2222-4222-8222-222222222222',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'economico','PANTEON','SHOPPING','cancelled');
INSERT INTO public.mobility_stage_deliveries
 (id,request_key,sender_id,requested_vehicle_kind,category,
  grams,length_cm,width_cm,height_cm,pickup_tag,delivery_tag,status)
VALUES ('b1111111-1111-4111-8111-111111111111',
 'b2222222-2222-4222-8222-222222222222',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'MOTO','PARCEL',150,10,10,10,'WAREHOUSE_ONE','CUSTOMER_ONE','cancelled');
INSERT INTO public.mobility_stage_merchant_orders
 (id,request_key,buyer_id,merchant_id,branch_id,requested_vehicle_kind,
  items_request,subtotal_pyg,status)
VALUES ('c1111111-1111-4111-8111-111111111111',
 'c2222222-2222-4222-8222-222222222222',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'ffffffff-ffff-4fff-8fff-ffffffffffff',
 'AUTO','[]'::jsonb,1000,'cancelled');

UPDATE public.mobility_stage_auto_demo_trips
 SET revision=revision+1,changed_at=now()
 WHERE id='a1111111-1111-4111-8111-111111111111';
UPDATE public.mobility_stage_deliveries
 SET revision=revision+1,changed_at=now()
 WHERE id='b1111111-1111-4111-8111-111111111111';
UPDATE public.mobility_stage_merchant_orders
 SET revision=revision+1,changed_at=now()
 WHERE id='c1111111-1111-4111-8111-111111111111';

DO $verify$
DECLARE
 n integer;
BEGIN
 SELECT count(*) INTO n FROM (
  SELECT created_at,revision FROM public.mobility_stage_auto_demo_trips
   WHERE id='a1111111-1111-4111-8111-111111111111'
  UNION ALL
  SELECT created_at,revision FROM public.mobility_stage_deliveries
   WHERE id='b1111111-1111-4111-8111-111111111111'
  UNION ALL
  SELECT created_at,revision FROM public.mobility_stage_merchant_orders
   WHERE id='c1111111-1111-4111-8111-111111111111'
 ) success WHERE revision=2 AND created_at=transaction_timestamp();
 IF n<>3 THEN RAISE EXCEPTION
  'G26.4 legitimate default timestamp/lifecycle updates rejected (% of 3)',n;
 END IF;
 RAISE NOTICE 'G26.4 3 valid default-timestamp inserts + lifecycle updates passed';
END $verify$;
ROLLBACK; -- Test rows and updates never leak from this script.
