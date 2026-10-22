\set ON_ERROR_STOP on
\ir ../../docs/backend/staging_only/G10_PRIVATE_DELIVERY_OFFERS_POSTGRES_CI_ONLY.sql

DO $check$ BEGIN
 IF has_function_privilege('authenticated',
  'public.mobility_stage_delivery_offer(uuid,uuid,uuid,uuid,integer)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_delivery_accept_offer(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('service_role',
  'public.mobility_stage_delivery_accept(uuid,uuid,uuid,uuid)','EXECUTE')
 OR has_table_privilege('authenticated','public.mobility_stage_delivery_offers','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_delivery_offer_outbox','SELECT')
 OR has_table_privilege('service_role','public.mobility_stage_delivery_offers','DELETE')
 THEN RAISE EXCEPTION 'G10 private dispatch authority exposed'; END IF;
END $check$;

UPDATE public.driver_locations SET available=true,updated_at=now()-interval '1 second'
 WHERE driver_id IN ('11111111-1111-4111-8111-111111111111',
                     '44444444-4444-4444-8444-444444444444');

SET ROLE service_role;
DO $check$
DECLARE d uuid; offer_a uuid; offer_b uuid; event_id uuid; replay uuid;
 blocked boolean:=false;
BEGIN
 d:=public.mobility_stage_delivery_request(
  '88888888-8888-4888-8888-888888888888',
  'a1000000-0000-4000-8000-000000000001','AUTO','PARCEL',
  2000,30,20,10,'DISPATCH_ORIGIN','DISPATCH_TARGET',false);
 offer_a:=public.mobility_stage_delivery_offer(
  d,'11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555',
  'a2000000-0000-4000-8000-000000000001',30);
 replay:=public.mobility_stage_delivery_offer(
  d,'11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555',
  'a2000000-0000-4000-8000-000000000001',30);
 IF replay<>offer_a THEN RAISE EXCEPTION 'Delivery offer replay duplicated'; END IF;
 offer_b:=public.mobility_stage_delivery_offer(
  d,'44444444-4444-4444-8444-444444444444',
  '77777777-7777-4777-8777-777777777777',
  'a2000000-0000-4000-8000-000000000002',30);
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_delivery_accept_offer(
   offer_a,'44444444-4444-4444-8444-444444444444',
   'a3000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Courier accepted foreign private offer'; END IF;
 event_id:=public.mobility_stage_delivery_accept_offer(
  offer_b,'44444444-4444-4444-8444-444444444444',
  'a3000000-0000-4000-8000-000000000002');
 replay:=public.mobility_stage_delivery_accept_offer(
  offer_b,'44444444-4444-4444-8444-444444444444',
  'a3000000-0000-4000-8000-000000000002');
 IF replay<>event_id THEN RAISE EXCEPTION 'Delivery acceptance replay duplicated'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_delivery_accept_offer(
   offer_a,'11111111-1111-4111-8111-111111111111',
   'a3000000-0000-4000-8000-000000000003');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Second courier won assigned delivery'; END IF;
 IF (SELECT status FROM public.mobility_stage_deliveries WHERE id=d)<>'accepted'
 OR (SELECT courier_id FROM public.mobility_stage_deliveries WHERE id=d)
    <>'44444444-4444-4444-8444-444444444444'
 OR (SELECT status FROM public.mobility_stage_delivery_offers WHERE id=offer_a)<>'withdrawn'
 OR (SELECT status FROM public.mobility_stage_delivery_offers WHERE id=offer_b)<>'accepted'
 OR (SELECT count(*) FROM public.mobility_stage_delivery_offer_outbox
     WHERE offer_id IN (offer_a,offer_b))<>2
 THEN RAISE EXCEPTION 'Private delivery assignment or outbox inconsistent'; END IF;
 -- Close the sequential fixture, then leave two active private offers for the
 -- following two-client concurrency gate.
 PERFORM public.mobility_stage_delivery_transition(d,
  '88888888-8888-4888-8888-888888888888','cancel',
  'a3000000-0000-4000-8000-000000000004');
 d:=public.mobility_stage_delivery_request(
  '99999999-9999-4999-8999-999999999999',
  'a1000000-0000-4000-8000-000000000002','AUTO','DOCUMENTS',
  1000,20,15,5,'RACE_ORIGIN','RACE_TARGET',false);
 PERFORM public.mobility_stage_delivery_offer(d,
  '11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555',
  'a2000000-0000-4000-8000-000000000003',45);
 PERFORM public.mobility_stage_delivery_offer(d,
  '44444444-4444-4444-8444-444444444444',
  '77777777-7777-4777-8777-777777777777',
  'a2000000-0000-4000-8000-000000000004',45);
END $check$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $check$ DECLARE blocked boolean:=false; BEGIN
 BEGIN SELECT count(*) FROM public.mobility_stage_delivery_offers;
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Courier enumerated delivery offers'; END IF;
END $check$;
RESET ROLE;
\echo PASS: G10 private AUTO/MOTO courier offers, TTL, replay, exclusive assignment and hidden outbox.
