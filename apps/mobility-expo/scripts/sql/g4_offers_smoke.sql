-- QORE G4: only disposable Postgres CI, AFTER G3 synthetic race.
\ir ../../docs/backend/staging_only/G4_PRIVATE_AUTO_OFFERS_POSTGRES_CI_ONLY.sql

INSERT INTO auth.users(id) VALUES
 ('88888888-8888-4888-8888-888888888888'),
 ('99999999-9999-4999-8999-999999999999'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

DO $check$ BEGIN
 IF has_function_privilege('authenticated',
  'public.mobility_stage_auto_demo_offer(uuid,uuid,uuid,uuid,integer)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_auto_demo_accept_offer(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_auto_demo_decline_offer(uuid,uuid,uuid)','EXECUTE')
 OR has_table_privilege('authenticated','public.mobility_stage_auto_demo_offers','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_auto_demo_push_outbox','SELECT')
 OR has_table_privilege('service_role','public.mobility_stage_auto_demo_offers','DELETE')
 OR has_table_privilege('service_role','public.mobility_stage_auto_demo_push_outbox','DELETE')
 OR has_function_privilege('service_role',
  'public.mobility_stage_auto_demo_accept(uuid,uuid,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G4 offers, push outbox or old direct-accept exposed'; END IF;
END $check$;

SET ROLE service_role;
DO $check$
DECLARE
 old_trip uuid; old_winner uuid;
 new_trip uuid; offer_a uuid; offer_b uuid;
 replay uuid; event_a uuid; event_replay uuid;
 expiry_trip uuid; expired_offer uuid;
 decline_trip uuid; declined_offer uuid;
 race_trip uuid; competitor_a uuid; competitor_b uuid;
 blocked boolean;
BEGIN
 -- Clear winner of the preceding G3 concurrency test in ephemeral fixtures.
 SELECT id,driver_id INTO old_trip,old_winner
 FROM public.mobility_stage_auto_demo_trips
 WHERE request_key='a1000000-0000-4000-8000-000000000005';
 IF old_trip IS NULL OR old_winner IS NULL
 THEN RAISE EXCEPTION 'G3 two-client fixture missing before G4'; END IF;
 PERFORM public.mobility_stage_auto_demo_transition(
  old_trip,old_winner,'arriving','d1000000-0000-4000-8000-000000000001');
 PERFORM public.mobility_stage_auto_demo_transition(
  old_trip,old_winner,'in_progress','d1000000-0000-4000-8000-000000000002');
 PERFORM public.mobility_stage_auto_demo_transition(
  old_trip,old_winner,'completed','d1000000-0000-4000-8000-000000000003');

 new_trip:=public.mobility_stage_auto_demo_request(
  '88888888-8888-4888-8888-888888888888',
  'e1000000-0000-4000-8000-000000000001','PANTEON','AIRPORT','economico');
 offer_a:=public.mobility_stage_auto_demo_offer(
  new_trip,'11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555',
  'e1000000-0000-4000-8000-000000000002',30);
 replay:=public.mobility_stage_auto_demo_offer(
  new_trip,'11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555',
  'e1000000-0000-4000-8000-000000000002',30);
 IF offer_a<>replay THEN RAISE EXCEPTION 'Offer replay generated a new offer'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_offer(
   new_trip,'11111111-1111-4111-8111-111111111111',
   '55555555-5555-4555-8555-555555555555',
   'e1000000-0000-4000-8000-000000000002',29);
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Offer replay changed expiry'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_offer(
   new_trip,'11111111-1111-4111-8111-111111111111',
   '55555555-5555-4555-8555-555555555555',
   'e1000000-0000-4000-8000-000000000003',31);
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Oversized TTL offered'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_offer(
   new_trip,'44444444-4444-4444-8444-444444444444',
   '55555555-5555-4555-8555-555555555555',
   'e1000000-0000-4000-8000-000000000004',20);
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Cross-driver car received offer'; END IF;
 offer_b:=public.mobility_stage_auto_demo_offer(
  new_trip,'44444444-4444-4444-8444-444444444444',
  '77777777-7777-4777-8777-777777777777',
  'e1000000-0000-4000-8000-000000000005',30);

 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_accept_offer(
   offer_a,'44444444-4444-4444-8444-444444444444',
   'e2000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Other driver accepted foreign offer'; END IF;

 event_a:=public.mobility_stage_auto_demo_accept_offer(
  offer_a,'11111111-1111-4111-8111-111111111111',
  'e2000000-0000-4000-8000-000000000002');
 event_replay:=public.mobility_stage_auto_demo_accept_offer(
  offer_a,'11111111-1111-4111-8111-111111111111',
  'e2000000-0000-4000-8000-000000000002');
 IF event_a<>event_replay
 OR (SELECT status FROM public.mobility_stage_auto_demo_offers WHERE id=offer_a)<>'accepted'
 OR (SELECT status FROM public.mobility_stage_auto_demo_offers WHERE id=offer_b)<>'withdrawn'
 OR (SELECT revision FROM public.mobility_stage_auto_demo_trips WHERE id=new_trip)<>2
 OR (SELECT count(*) FROM public.mobility_stage_auto_demo_events
     WHERE trip_id=new_trip AND next_status='accepted')<>1
 OR (SELECT count(*) FROM public.mobility_stage_auto_demo_push_outbox
     WHERE offer_id IN (offer_a,offer_b))<>2
 THEN RAISE EXCEPTION 'Private winner/losers/audit/outbox inconsistent'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_accept_offer(
   offer_b,'44444444-4444-4444-8444-444444444444',
   'e2000000-0000-4000-8000-000000000003');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Lost offer later accepted'; END IF;

 -- Complete for both drivers to become free for subsequent race.
 PERFORM public.mobility_stage_auto_demo_transition(
  new_trip,'11111111-1111-4111-8111-111111111111',
  'arriving','e3000000-0000-4000-8000-000000000001');
 PERFORM public.mobility_stage_auto_demo_transition(
  new_trip,'11111111-1111-4111-8111-111111111111',
  'in_progress','e3000000-0000-4000-8000-000000000002');
 PERFORM public.mobility_stage_auto_demo_transition(
  new_trip,'11111111-1111-4111-8111-111111111111',
  'completed','e3000000-0000-4000-8000-000000000003');

 expiry_trip:=public.mobility_stage_auto_demo_request(
  '99999999-9999-4999-8999-999999999999',
  'e1000000-0000-4000-8000-000000000006','PANTEON','TERMINAL','economico');
 expired_offer:=public.mobility_stage_auto_demo_offer(
  expiry_trip,'11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555',
  'e1000000-0000-4000-8000-000000000007',5);
 -- Simulate passage of wall time without 5-second CI wait.
 UPDATE public.mobility_stage_auto_demo_offers
 SET offered_at=now()-interval '2 minutes',
     expires_at=now()-interval '1 minute'
 WHERE id=expired_offer;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_accept_offer(
   expired_offer,'11111111-1111-4111-8111-111111111111',
   'e2000000-0000-4000-8000-000000000004');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Expired private offer was accepted'; END IF;

 decline_trip:=public.mobility_stage_auto_demo_request(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'e1000000-0000-4000-8000-000000000008','PANTEON','COSTANERA','economico');
 declined_offer:=public.mobility_stage_auto_demo_offer(
  decline_trip,'44444444-4444-4444-8444-444444444444',
  '77777777-7777-4777-8777-777777777777',
  'e1000000-0000-4000-8000-000000000009',25);
 IF public.mobility_stage_auto_demo_decline_offer(
   declined_offer,'44444444-4444-4444-8444-444444444444',
   'e2000000-0000-4000-8000-000000000005')<>declined_offer
 OR public.mobility_stage_auto_demo_decline_offer(
   declined_offer,'44444444-4444-4444-8444-444444444444',
   'e2000000-0000-4000-8000-000000000005')<>declined_offer
 THEN RAISE EXCEPTION 'Decline replay was not idempotent'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_auto_demo_accept_offer(
   declined_offer,'44444444-4444-4444-8444-444444444444',
   'e2000000-0000-4000-8000-000000000006');
 EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Declined offer could be accepted'; END IF;

 -- Two fresh, still-eligible drivers contend for a fresh synthetic trip.
 race_trip:=public.mobility_stage_auto_demo_request(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'e1000000-0000-4000-8000-000000000010','PANTEON','BOTANICO','economico');
 competitor_a:=public.mobility_stage_auto_demo_offer(
  race_trip,'11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555',
  'e1000000-0000-4000-8000-000000000011',30);
 competitor_b:=public.mobility_stage_auto_demo_offer(
  race_trip,'44444444-4444-4444-8444-444444444444',
  '77777777-7777-4777-8777-777777777777',
  'e1000000-0000-4000-8000-000000000012',30);
 IF competitor_a=competitor_b
 THEN RAISE EXCEPTION 'Distinct driver offers collapsed'; END IF;
END $check$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='88888888-8888-4888-8888-888888888888';
DO $check$ BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_auto_demo_offers)<>0
 OR (SELECT count(*) FROM public.mobility_stage_auto_demo_push_outbox)<>0
 THEN RAISE EXCEPTION 'Offers/notification metadata leaked to passenger'; END IF;
END $check$;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $check$ BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_auto_demo_offers)<>0
 THEN RAISE EXCEPTION 'Driver can enumerate private offers bypassing API'; END IF;
END $check$;
RESET ROLE;
\echo PASS: G4 expiring per-driver private offers, replay, decline, atomic winner, outbox and client RLS.
