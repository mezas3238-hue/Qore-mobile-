\set ON_ERROR_STOP on
-- G5 delivery/custody contract in the same disposable PostgreSQL 16 CI database.
-- This script never connects to Supabase or any remote environment.
\ir ../../docs/backend/staging_only/G5_DELIVERY_CUSTODY_POSTGRES_CI_ONLY.sql

DO $check$
BEGIN
 IF has_function_privilege('authenticated',
  'public.mobility_stage_delivery_request(uuid,uuid,public.mobility_vehicle_kind,public.mobility_stage_delivery_category,integer,integer,integer,integer,text,text,boolean)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_delivery_accept(uuid,uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_delivery_transition(uuid,uuid,text,uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_delivery_courier_preflight(uuid,uuid,uuid)','EXECUTE')
 OR has_table_privilege('authenticated',
  'public.mobility_stage_delivery_vehicle_clearance','SELECT')
 OR has_table_privilege('authenticated',
  'public.mobility_stage_delivery_events','SELECT')
 OR has_table_privilege('authenticated',
  'public.mobility_stage_deliveries','INSERT')
 OR has_table_privilege('authenticated',
  'public.mobility_stage_deliveries','UPDATE')
 OR has_table_privilege('service_role',
  'public.mobility_stage_delivery_events','UPDATE')
 OR has_table_privilege('service_role',
  'public.mobility_stage_delivery_events','DELETE')
 THEN RAISE EXCEPTION 'G5 private custody, clearance or server RPC exposed'; END IF;
 IF EXISTS(
  SELECT 1 FROM pg_catalog.pg_enum e
  JOIN pg_catalog.pg_type t ON t.oid=e.enumtypid
  WHERE t.typname='mobility_stage_delivery_category'
    AND e.enumlabel IN ('PHARMACY_CONTROLLED','ALCOHOL','WEAPONS')
 ) THEN RAISE EXCEPTION 'Restricted delivery category was enabled'; END IF;
END $check$;

-- Refresh fictional driver radar positions and install server-reviewed cargo limits.
UPDATE public.driver_locations SET available=true,updated_at=now()-interval '2 seconds'
 WHERE driver_id IN ('11111111-1111-4111-8111-111111111111',
                     '44444444-4444-4444-8444-444444444444');
INSERT INTO public.mobility_stage_delivery_vehicle_clearance
 (vehicle_id,delivery_authorized,cargo_insurance_valid_through,
  cargo_insurance_verified_at,max_grams,max_volume_cm3,max_edge_cm,
  reviewed_by,reviewed_at)
VALUES
 ('55555555-5555-4555-8555-555555555555',true,CURRENT_DATE+30,
  now()-interval '1 day',100000,1000000,200,
  '22222222-2222-4222-8222-222222222222',now()-interval '1 day'),
 ('66666666-6666-4666-8666-666666666666',true,CURRENT_DATE+30,
  now()-interval '1 day',10000,45000,60,
  '22222222-2222-4222-8222-222222222222',now()-interval '1 day'),
 ('77777777-7777-4777-8777-777777777777',true,CURRENT_DATE+30,
  now()-interval '1 day',100000,1000000,200,
  '22222222-2222-4222-8222-222222222222',now()-interval '1 day');

SET ROLE service_role;
DO $check$
DECLARE
 moto_delivery uuid; moto_replay uuid; auto_delivery uuid;
 accept_event uuid; replay_event uuid; proof uuid;
 blocked boolean; n integer;
BEGIN
 -- Hard platform limits reject an oversized motorcycle package and restricted items.
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_delivery_request(
   '88888888-8888-4888-8888-888888888888',
   '51000000-0000-4000-8000-000000000001','MOTO','PARCEL',
   10001,20,20,20,'WAREHOUSE_A','CUSTOMER_A',false);
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Oversized MOTO package accepted'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_delivery_request(
   '88888888-8888-4888-8888-888888888888',
   '51000000-0000-4000-8000-000000000002','MOTO','PHARMACY_OTC',
   500,10,10,10,'PHARMACY_A','CUSTOMER_A',true);
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Declared restricted item accepted'; END IF;

 -- Separately cleared MOTO cargo works while passenger MOTO remains gated in G2.
 moto_delivery:=public.mobility_stage_delivery_request(
  '88888888-8888-4888-8888-888888888888',
  '51000000-0000-4000-8000-000000000003','MOTO','DOCUMENTS',
  1200,30,20,10,'OFFICE_NORTH','OFFICE_SOUTH',false);
 moto_replay:=public.mobility_stage_delivery_request(
  '88888888-8888-4888-8888-888888888888',
  '51000000-0000-4000-8000-000000000003','MOTO','DOCUMENTS',
  1200,30,20,10,'OFFICE_NORTH','OFFICE_SOUTH',false);
 IF moto_delivery<>moto_replay THEN RAISE EXCEPTION 'Delivery request replay duplicated'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_delivery_request(
   '88888888-8888-4888-8888-888888888888',
   '51000000-0000-4000-8000-000000000003','MOTO','DOCUMENTS',
   1300,30,20,10,'OFFICE_NORTH','OFFICE_SOUTH',false);
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Conflicting request replay accepted'; END IF;
 IF NOT public.mobility_stage_delivery_courier_preflight(
  '11111111-1111-4111-8111-111111111111',
  '66666666-6666-4666-8666-666666666666',moto_delivery)
 THEN RAISE EXCEPTION 'Cleared MOTO cargo courier failed preflight'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_delivery_accept(
   moto_delivery,'44444444-4444-4444-8444-444444444444',
   '66666666-6666-4666-8666-666666666666',
   '52000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Courier accepted another driver vehicle'; END IF;
 accept_event:=public.mobility_stage_delivery_accept(
  moto_delivery,'11111111-1111-4111-8111-111111111111',
  '66666666-6666-4666-8666-666666666666',
  '52000000-0000-4000-8000-000000000002');
 replay_event:=public.mobility_stage_delivery_accept(
  moto_delivery,'11111111-1111-4111-8111-111111111111',
  '66666666-6666-4666-8666-666666666666',
  '52000000-0000-4000-8000-000000000002');
 IF accept_event<>replay_event THEN RAISE EXCEPTION 'Accept replay duplicated event'; END IF;
 PERFORM public.mobility_stage_delivery_transition(
  moto_delivery,'11111111-1111-4111-8111-111111111111','pickup',
  '53000000-0000-4000-8000-000000000001');
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_delivery_transition(
   moto_delivery,'11111111-1111-4111-8111-111111111111','deliver',
   '53000000-0000-4000-8000-000000000002');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Delivery completed without proof'; END IF;
 proof:='54000000-0000-4000-8000-000000000001';
 PERFORM public.mobility_stage_delivery_transition(
  moto_delivery,'11111111-1111-4111-8111-111111111111','deliver',
  '53000000-0000-4000-8000-000000000003',proof);
 IF (SELECT status FROM public.mobility_stage_deliveries WHERE id=moto_delivery)<>'delivered'
 OR (SELECT proof_ref FROM public.mobility_stage_deliveries WHERE id=moto_delivery)<>proof
 OR (SELECT revision FROM public.mobility_stage_deliveries WHERE id=moto_delivery)<>4
 THEN RAISE EXCEPTION 'MOTO chain of custody inconsistent'; END IF;

 -- AUTO commercial delivery and its post-delivery dispute/return custody trail.
 auto_delivery:=public.mobility_stage_delivery_request(
  '99999999-9999-4999-8999-999999999999',
  '51000000-0000-4000-8000-000000000004','AUTO','GROCERIES',
  25000,80,50,40,'SUPERMARKET_A','CUSTOMER_B',false);
 PERFORM public.mobility_stage_delivery_accept(
  auto_delivery,'44444444-4444-4444-8444-444444444444',
  '77777777-7777-4777-8777-777777777777',
  '52000000-0000-4000-8000-000000000003');
 PERFORM public.mobility_stage_delivery_transition(
  auto_delivery,'44444444-4444-4444-8444-444444444444','pickup',
  '53000000-0000-4000-8000-000000000004');
 proof:='54000000-0000-4000-8000-000000000002';
 PERFORM public.mobility_stage_delivery_transition(
  auto_delivery,'44444444-4444-4444-8444-444444444444','deliver',
  '53000000-0000-4000-8000-000000000005',proof);
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_delivery_transition(
   auto_delivery,'88888888-8888-4888-8888-888888888888','dispute',
   '53000000-0000-4000-8000-000000000006');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Foreign sender disputed delivery'; END IF;
 PERFORM public.mobility_stage_delivery_transition(
  auto_delivery,'99999999-9999-4999-8999-999999999999','dispute',
  '53000000-0000-4000-8000-000000000007');
 PERFORM public.mobility_stage_delivery_transition(
  auto_delivery,'44444444-4444-4444-8444-444444444444','return',
  '53000000-0000-4000-8000-000000000008');
 SELECT count(*) INTO n FROM public.mobility_stage_delivery_events
  WHERE delivery_id=auto_delivery;
 IF n<>5
 OR (SELECT status FROM public.mobility_stage_deliveries WHERE id=auto_delivery)<>'returned'
 OR (SELECT revision FROM public.mobility_stage_deliveries WHERE id=auto_delivery)<>6
 THEN RAISE EXCEPTION 'AUTO custody event chain inconsistent'; END IF;
END $check$;
RESET ROLE;

-- RLS reveals only participant records; no client can mutate operational truth.
SET ROLE authenticated;
SET request.jwt.claim.sub='88888888-8888-4888-8888-888888888888';
DO $check$ DECLARE n integer; blocked boolean:=false; BEGIN
 SELECT count(*) INTO n FROM public.mobility_stage_deliveries;
 IF n<>1 THEN RAISE EXCEPTION 'Sender cannot see exactly own delivery'; END IF;
 BEGIN
  INSERT INTO public.mobility_stage_deliveries
   (request_key,sender_id,requested_vehicle_kind,category,grams,length_cm,
    width_cm,height_cm,pickup_tag,delivery_tag)
  VALUES('55000000-0000-4000-8000-000000000001',auth.uid(),'AUTO','PARCEL',
   1,1,1,1,'FAKE_START','FAKE_END');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Authenticated sender wrote delivery table'; END IF;
END $check$;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $check$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.mobility_stage_deliveries;
 IF n<>1 THEN RAISE EXCEPTION 'Courier cannot see exactly assigned delivery'; END IF;
END $check$;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $check$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.mobility_stage_deliveries;
 IF n<>0 THEN RAISE EXCEPTION 'Outsider can see delivery'; END IF;
END $check$;
RESET ROLE;
\echo PASS: G5 AUTO/MOTO delivery capacity, private clearance, custody proof, disputes, append-only audit and RLS.
