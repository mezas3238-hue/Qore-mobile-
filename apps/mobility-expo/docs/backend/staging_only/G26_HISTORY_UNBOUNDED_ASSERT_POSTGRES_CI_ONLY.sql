-- G26.2 disposable Postgres 16 integration: >1,000 historical operations.
-- No remote access, private documents, production credentials or real persons.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'Refusing non-disposable G26 history integration'; END IF;
END $guard$;
BEGIN;
INSERT INTO auth.users(id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc')
ON CONFLICT (id) DO NOTHING;

-- All 400 rows per table are TERMINAL; existing one-active-per-customer
-- uniqueness constraints remain in force and are never disabled.
INSERT INTO public.mobility_stage_auto_demo_trips
 (id,request_key,passenger_id,service,origin_tag,destination_tag,
 status,revision,created_at,changed_at)
SELECT md5('G26_RIDE_ID_'||n)::uuid,md5('G26_RIDE_KEY_'||n)::uuid,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
 'economico','PANTEON','SHOPPING','cancelled',1,
 '2026-10-22T23:00:00Z'::timestamptz-n*interval '1 minute',
 '2026-10-22T23:00:00Z'::timestamptz-n*interval '1 minute'
FROM generate_series(1,400) n;

INSERT INTO public.mobility_stage_deliveries
 (id,request_key,sender_id,requested_vehicle_kind,category,
 grams,length_cm,width_cm,height_cm,pickup_tag,delivery_tag,
 restricted_item_declared,status,revision,created_at,changed_at)
SELECT md5('G26_DEL_ID_'||n)::uuid,md5('G26_DEL_KEY_'||n)::uuid,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
 'MOTO','PARCEL',150,10,10,10,'SUPERMARKET_A','CUSTOMER_A',
 false,'cancelled',1,
 '2026-10-22T23:00:00Z'::timestamptz-n*interval '1 minute',
 '2026-10-22T23:00:00Z'::timestamptz-n*interval '1 minute'
FROM generate_series(1,400) n;

INSERT INTO public.mobility_stage_merchants
 (id,onboarding_key,owner_id,kind,display_tag,status)
VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 'RETAIL','STORE_SYNTHETIC','pending');
INSERT INTO public.mobility_stage_merchant_branches
 (id,merchant_id,branch_tag,pickup_tag,preparation_minutes)
VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'BRANCH_SYNTHETIC','STORE_PICKUP',20);
INSERT INTO public.mobility_stage_merchant_orders
 (id,request_key,buyer_id,merchant_id,branch_id,requested_vehicle_kind,
 items_request,subtotal_pyg,status,revision,created_at,changed_at)
SELECT md5('G26_ORDER_ID_'||n)::uuid,md5('G26_ORDER_KEY_'||n)::uuid,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid,
 'MOTO','[]'::jsonb,1000,'cancelled',1,
 '2026-10-22T23:00:00Z'::timestamptz-n*interval '1 minute',
 '2026-10-22T23:00:00Z'::timestamptz-n*interval '1 minute'
FROM generate_series(1,400) n;

DO $check$
DECLARE
 expected integer;
 actual integer;
 ix integer;
 nm text;
BEGIN
 SELECT count(*) INTO expected FROM (
  SELECT id FROM public.mobility_stage_auto_demo_trips WHERE passenger_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  UNION ALL
  SELECT id FROM public.mobility_stage_deliveries WHERE sender_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  UNION ALL
  SELECT id FROM public.mobility_stage_merchant_orders WHERE buyer_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 ) full_history;
 IF expected<>1200 THEN RAISE EXCEPTION 'G26 fixture expected 1200, got %',expected; END IF;
 FOREACH nm IN ARRAY ARRAY[
  'mobility_stage_history_rider_desc_g26',
  'mobility_stage_history_delivery_desc_g26',
  'mobility_stage_history_merchant_desc_g26'
 ] LOOP
  SELECT count(*) INTO ix FROM pg_indexes WHERE schemaname='public' AND indexname=nm;
  IF ix<>1 THEN RAISE EXCEPTION 'G26 missing covering index: %',nm; END IF;
 END LOOP;
 -- A different user with no history must not retrieve even one record.
 SELECT count(*) INTO actual FROM public.mobility_stage_auto_demo_trips
 WHERE passenger_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 IF actual<>0 THEN RAISE EXCEPTION 'G26 fixture isolation invalid'; END IF;
END $check$;

-- A single customer must reach ALL rows in descending chronological keyset
-- pages. This intentionally tests 24 complete pages of 50 rows (not a cap).
CREATE TEMP TABLE g26_visited (id uuid PRIMARY KEY) ON COMMIT DROP;
DO $pages$
DECLARE
 anchor timestamptz:='2026-10-23T00:00:00Z';
 last_time timestamptz:=NULL;
 last_id uuid:=NULL;
 last_kind text:=NULL;
 row record;
 n integer;
 count_all integer:=0;
 page_count integer:=0;
BEGIN
 LOOP
  n:=0;
  FOR row IN
   SELECT created_at,id,kind FROM (
    SELECT created_at,id,'RIDE'::text AS kind
     FROM public.mobility_stage_auto_demo_trips
     WHERE passenger_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND created_at<=anchor
      AND (last_time IS NULL OR (created_at,id,'RIDE'::text) <
       (last_time,last_id,last_kind))
    UNION ALL
    SELECT created_at,id,'DELIVERY'::text AS kind
     FROM public.mobility_stage_deliveries
     WHERE sender_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND created_at<=anchor
      AND (last_time IS NULL OR (created_at,id,'DELIVERY'::text) <
       (last_time,last_id,last_kind))
    UNION ALL
    SELECT created_at,id,'MERCHANT_ORDER'::text AS kind
     FROM public.mobility_stage_merchant_orders
     WHERE buyer_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND created_at<=anchor
      AND (last_time IS NULL OR (created_at,id,'MERCHANT_ORDER'::text) <
       (last_time,last_id,last_kind))
   ) all_sources
   ORDER BY created_at DESC,id DESC,kind DESC LIMIT 50
  LOOP
   INSERT INTO g26_visited(id) VALUES(row.id);
   last_time:=row.created_at;
   last_id:=row.id;
   last_kind:=row.kind;
   n:=n+1;
   count_all:=count_all+1;
  END LOOP;
  EXIT WHEN n=0;
  page_count:=page_count+1;
  IF page_count>30 THEN RAISE EXCEPTION 'G26 non-progressing cursor'; END IF;
 END LOOP;
 IF page_count<>24 OR count_all<>1200
 THEN RAISE EXCEPTION 'G26 pagination lost data: pages %, records %',
  page_count,count_all; END IF;
 RAISE NOTICE 'G26 unbounded PostgreSQL history: % records in % pages',count_all,page_count;
END $pages$;

-- Validate real PostgreSQL RLS policies for all THREE tables in one transaction.
DO $privileges$
BEGIN
 IF has_table_privilege('authenticated','public.mobility_stage_auto_demo_trips','INSERT')
 OR has_table_privilege('authenticated','public.mobility_stage_deliveries','INSERT')
 OR has_table_privilege('authenticated','public.mobility_stage_merchant_orders','INSERT')
 THEN RAISE EXCEPTION 'G26 mobile actor can bypass server mutation boundary'; END IF;
END $privileges$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $rls$
DECLARE n integer;
BEGIN
 SELECT (
  (SELECT count(*) FROM public.mobility_stage_auto_demo_trips)+
  (SELECT count(*) FROM public.mobility_stage_deliveries)+
  (SELECT count(*) FROM public.mobility_stage_merchant_orders)
 ) INTO n;
 IF n<>0 THEN RAISE EXCEPTION 'G26 RLS leaked % foreign entries',n; END IF;
END $rls$;
RESET ROLE;
SET LOCAL request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET LOCAL ROLE authenticated;
DO $own$
DECLARE n integer;
BEGIN
 SELECT (
  (SELECT count(*) FROM public.mobility_stage_auto_demo_trips)+
  (SELECT count(*) FROM public.mobility_stage_deliveries)+
  (SELECT count(*) FROM public.mobility_stage_merchant_orders)
 ) INTO n;
 IF n<>1200 THEN RAISE EXCEPTION 'G26 RLS hides own history: %',n; END IF;
END $own$;
RESET ROLE;
COMMIT;
