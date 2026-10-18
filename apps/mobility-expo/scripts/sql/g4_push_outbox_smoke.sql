
-- G4 private push outbox: EPHEMERAL PostgreSQL 16 ONLY, after G4 acceptance race.
\ir ../../docs/backend/staging_only/G4_PUSH_OUTBOX_AT_MOST_ONCE_POSTGRES_CI_ONLY.sql

DO $check$ BEGIN
 IF has_function_privilege('authenticated','public.mobility_stage_claim_auto_demo_push(uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.mobility_stage_ack_auto_demo_push(uuid,uuid,text)','EXECUTE')
 OR has_function_privilege('anon','public.mobility_stage_claim_auto_demo_push(uuid)','EXECUTE')
 OR has_table_privilege('authenticated','public.mobility_stage_auto_demo_push_outbox','SELECT')
 THEN RAISE EXCEPTION 'Private push worker exposed to clients'; END IF;
END $check$;

SET ROLE service_role;
DO $check$
DECLARE old_trip uuid; old_driver uuid; new_trip uuid;
 pending_trip uuid; pending_offer uuid;
 got uuid; owner uuid; row_count integer; race_offer uuid;
BEGIN
 -- Inherited G4 winner is still busy: finish ONLY a fictional CI trip.
 SELECT id,driver_id INTO old_trip,old_driver
 FROM public.mobility_stage_auto_demo_trips
 WHERE request_key='e1000000-0000-4000-8000-000000000010';
 IF old_trip IS NULL OR old_driver IS NULL THEN RAISE EXCEPTION 'G4 race fixture missing'; END IF;
 PERFORM public.mobility_stage_auto_demo_transition(old_trip,old_driver,
  'arriving','f1000000-0000-4000-8000-000000000001');
 PERFORM public.mobility_stage_auto_demo_transition(old_trip,old_driver,
  'in_progress','f1000000-0000-4000-8000-000000000002');
 PERFORM public.mobility_stage_auto_demo_transition(old_trip,old_driver,
  'completed','f1000000-0000-4000-8000-000000000003');
 -- Expired, already won, withdrawn and declined offers must never be claimed.
 SELECT offer_id INTO got FROM public.mobility_stage_claim_auto_demo_push(
  'f2000000-0000-4000-8000-000000000001');
 IF FOUND THEN RAISE EXCEPTION 'Expired/declined/withdrawn push was claimed'; END IF;

 SELECT id INTO pending_trip FROM public.mobility_stage_auto_demo_trips
 WHERE request_key='e1000000-0000-4000-8000-000000000008' AND status='searching';
 IF pending_trip IS NULL THEN RAISE EXCEPTION 'Declined-offer trip fixture missing'; END IF;
 pending_offer:=public.mobility_stage_auto_demo_offer(
  pending_trip,'11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555555',
  'f1000000-0000-4000-8000-000000000004',30);
 SELECT offer_id,driver_id INTO got,owner
 FROM public.mobility_stage_claim_auto_demo_push('f2000000-0000-4000-8000-000000000002');
 IF got IS DISTINCT FROM pending_offer
 OR owner IS DISTINCT FROM '11111111-1111-4111-8111-111111111111'::uuid
 THEN RAISE EXCEPTION 'Wrong pending offer or driver claimed'; END IF;
 IF public.mobility_stage_ack_auto_demo_push(
  'f2000000-0000-4000-8000-000000000003',pending_offer,'ticket-xyz-0001')
 THEN RAISE EXCEPTION 'Foreign worker acknowledged a push'; END IF;
 IF NOT public.mobility_stage_ack_auto_demo_push(
  'f2000000-0000-4000-8000-000000000002',pending_offer,'ticket-xyz-0001')
 THEN RAISE EXCEPTION 'Owner failed to acknowledge accepted-for-processing ticket'; END IF;
 IF public.mobility_stage_ack_auto_demo_push(
  'f2000000-0000-4000-8000-000000000002',pending_offer,'ticket-xyz-0001')
 THEN RAISE EXCEPTION 'Push acknowledgement replay unexpectedly mutated row'; END IF;
 SELECT offer_id INTO got FROM public.mobility_stage_claim_auto_demo_push(
  'f2000000-0000-4000-8000-000000000001');
 IF FOUND THEN RAISE EXCEPTION 'Previously claimed push retried or repeated'; END IF;

 new_trip:=public.mobility_stage_auto_demo_request(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'f1000000-0000-4000-8000-000000000005',
  'PANTEON','COSTANERA','economico');
 race_offer:=public.mobility_stage_auto_demo_offer(
  new_trip,'44444444-4444-4444-8444-444444444444',
  '77777777-7777-4777-8777-777777777777',
  'f1000000-0000-4000-8000-000000000006',30);
 IF race_offer IS NULL THEN RAISE EXCEPTION 'Concurrent push fixture unavailable'; END IF;
END $check$;
RESET ROLE;
\echo PASS: G4 private outbox rejects expired, declined and withdrawn; one-shot claim; owner-only ticket ACK; no client grants.
