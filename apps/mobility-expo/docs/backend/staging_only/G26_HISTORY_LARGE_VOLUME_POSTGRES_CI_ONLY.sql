-- G26.3: Medium-volume real PostgreSQL keyset stress, disposable DB ONLY.
-- Adds 30,000 synthetic terminal operations to G26.2's 1,200 historical rows.
-- No remote Supabase, personal data, production access, mobile release or LIVE.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
 current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G26.3 must run in disposable CI only'; END IF;
 IF (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND
  indexname LIKE 'mobility_stage_history_%_desc_g26')<>3
 THEN RAISE EXCEPTION 'G26.3 needs exactly three history indexes'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
-- Terminal statuses allow thousands of historic operations without disabling
-- the one-active-order/rider/courier invariants.
INSERT INTO public.mobility_stage_auto_demo_trips
 (id,request_key,passenger_id,service,origin_tag,destination_tag,
  status,revision,created_at,changed_at)
SELECT md5('G263_RIDE_ID_'||i)::uuid,md5('G263_RIDE_REQ_'||i)::uuid,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
 'economico','PANTEON','SHOPPING','cancelled',1,
 '2026-10-01T00:00:00Z'::timestamptz-i*interval '1 second',
 '2026-10-01T00:00:00Z'::timestamptz-i*interval '1 second'
FROM generate_series(1,10000) AS i;
INSERT INTO public.mobility_stage_deliveries
 (id,request_key,sender_id,requested_vehicle_kind,category,
  grams,length_cm,width_cm,height_cm,pickup_tag,delivery_tag,
  restricted_item_declared,status,revision,created_at,changed_at)
SELECT md5('G263_DEL_ID_'||i)::uuid,md5('G263_DEL_REQ_'||i)::uuid,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
 'MOTO','PARCEL',150,10,10,10,'WAREHOUSE_ONE','CUSTOMER_ONE',
 false,'cancelled',1,
 '2026-10-01T00:00:00Z'::timestamptz-i*interval '1 second',
 '2026-10-01T00:00:00Z'::timestamptz-i*interval '1 second'
FROM generate_series(1,10000) AS i;
INSERT INTO public.mobility_stage_merchant_orders
 (id,request_key,buyer_id,merchant_id,branch_id,requested_vehicle_kind,
  items_request,subtotal_pyg,status,revision,created_at,changed_at)
SELECT md5('G263_ORD_ID_'||i)::uuid,md5('G263_ORD_REQ_'||i)::uuid,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid,
 'AUTO','[]'::jsonb,1000,'cancelled',1,
 '2026-10-01T00:00:00Z'::timestamptz-i*interval '1 second',
 '2026-10-01T00:00:00Z'::timestamptz-i*interval '1 second'
FROM generate_series(1,10000) AS i;

CREATE TEMP TABLE g263_seen (id uuid PRIMARY KEY) ON COMMIT DROP;
DO $walk$
DECLARE
 page record;
 last_time timestamptz:=NULL;
 last_id uuid:=NULL;
 last_kind text:=NULL;
 anchor timestamptz:='2026-10-23T00:00:00Z';
 count_total integer:=0;
 page_total integer:=0;
 page_size integer;
BEGIN
 LOOP
  page_size:=0;
  FOR page IN
   SELECT created_at,id,kind FROM (
    SELECT created_at,id,'RIDE'::text kind
    FROM public.mobility_stage_auto_demo_trips
    WHERE passenger_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND created_at<=anchor AND
      (last_time IS NULL OR (created_at,id,'RIDE'::text) <
       (last_time,last_id,last_kind))
    UNION ALL
    SELECT created_at,id,'DELIVERY'::text kind
    FROM public.mobility_stage_deliveries
    WHERE sender_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND created_at<=anchor AND
      (last_time IS NULL OR (created_at,id,'DELIVERY'::text) <
       (last_time,last_id,last_kind))
    UNION ALL
    SELECT created_at,id,'MERCHANT_ORDER'::text kind
    FROM public.mobility_stage_merchant_orders
    WHERE buyer_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND created_at<=anchor AND
      (last_time IS NULL OR (created_at,id,'MERCHANT_ORDER'::text) <
       (last_time,last_id,last_kind))
   ) q
   ORDER BY created_at DESC,id DESC,kind DESC LIMIT 50
  LOOP
   INSERT INTO g263_seen VALUES(page.id); -- unique across all pages
   page_size:=page_size+1;
   count_total:=count_total+1;
   last_time:=page.created_at;
   last_id:=page.id;
   last_kind:=page.kind;
  END LOOP;
  EXIT WHEN page_size=0;
  page_total:=page_total+1;
  IF page_total>625 THEN RAISE EXCEPTION 'Non-progressing history cursor'; END IF;
 END LOOP;
 IF count_total<>31200 OR page_total<>624
 THEN RAISE EXCEPTION 'History truncated: % total in % pages',
   count_total,page_total; END IF;
 RAISE NOTICE 'G26.3 POSTGRES: % owned historic rows / % pages / 0 duplicates',
   count_total,page_total;
END $walk$;
COMMIT;
