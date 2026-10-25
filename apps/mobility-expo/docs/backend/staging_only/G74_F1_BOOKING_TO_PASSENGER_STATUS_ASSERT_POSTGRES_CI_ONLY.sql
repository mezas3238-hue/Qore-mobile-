-- G74 F1 QA: prove the exact G73 reservation is the SAME G3/G4 trip
-- queried by Passenger RLS, never a second fake booking or Driver dispatch.
-- PG16 disposable chain only. No remote DDL, no payment, no LIVE.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g73_book(uuid,uuid,uuid)') IS NULL
 OR to_regclass('public.mobility_stage_auto_demo_trips') IS NULL
 THEN RAISE EXCEPTION 'G74 must run on disposable G73/G4 chain'; END IF;
 IF has_table_privilege('authenticated','public.mobility_stage_g72_auto_prequotes','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_g73_auto_routes','SELECT')
 OR has_function_privilege('authenticated','public.mobility_stage_g73_book(uuid,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G74 browser can bypass server quote/route consent'; END IF;
END $guard$;
INSERT INTO auth.users(id) VALUES
 ('74740000-0000-4747-8747-000000000001'),
 ('74740000-0000-4747-8747-000000000002');
SET ROLE service_role;
DO $qa$
DECLARE
 owner_id uuid:='74740000-0000-4747-8747-000000000001';
 stranger uuid:='74740000-0000-4747-8747-000000000002';
 routekey uuid:='74740000-0000-4747-8747-000000000010';
 quotekey uuid:='74740000-0000-4747-8747-000000000011';
 bookkey uuid:='74740000-0000-4747-8747-000000000012';
 rid uuid; qid uuid; tid uuid; receipt jsonb; statusrow record;
BEGIN
 rid:=public.mobility_stage_g73_route(owner_id,routekey,'economico',
  'CENTRO_FIXTURE','AEROPUERTO','ASUNCION_FIXTURE',2500,300,0);
 qid:=public.mobility_stage_g73_quote(owner_id,rid,quotekey);
 IF public.mobility_stage_g73_quote_receipt(owner_id,qid)->>'routeId'<>rid::text
 THEN RAISE EXCEPTION 'G74 independent price differs from route'; END IF;
 tid:=public.mobility_stage_g73_book(owner_id,qid,bookkey);
 receipt:=public.mobility_stage_g73_booking_receipt(owner_id,bookkey);
 IF receipt->>'tripId'<>tid::text OR receipt->>'routeId'<>rid::text
 OR receipt->>'quoteId'<>qid::text OR (receipt->>'revision')::int<>1
 THEN RAISE EXCEPTION 'G74 booking could not bind one G4 trip %',receipt; END IF;
 SELECT id,request_key,passenger_id,driver_id,vehicle_id,service,
   origin_tag,destination_tag,status,revision INTO statusrow
 FROM public.mobility_stage_auto_demo_trips
 WHERE id=tid AND passenger_id=owner_id;
 IF NOT FOUND OR statusrow.request_key<>bookkey
 OR statusrow.passenger_id<>owner_id OR statusrow.driver_id IS NOT NULL
 OR statusrow.vehicle_id IS NOT NULL OR statusrow.service<>'economico'
 OR statusrow.origin_tag<>'CENTRO_FIXTURE'
 OR statusrow.destination_tag<>'AEROPUERTO'
 OR statusrow.status<>'searching' OR statusrow.revision<>1
 THEN RAISE EXCEPTION 'G74 G4 persistent status diverged from G73 booking'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_auto_demo_trips
     WHERE request_key=bookkey)<>1
 OR (SELECT count(*) FROM public.mobility_stage_g72_auto_prequotes
     WHERE request_key=quotekey AND trip_id=tid AND route_id=rid)<>1
 THEN RAISE EXCEPTION 'G74 phantom trip or duplicate reserve'; END IF;
 IF public.mobility_stage_g73_booking_receipt(stranger,bookkey) IS NOT NULL
 THEN RAISE EXCEPTION 'G74 foreign booking reconciliation leaked'; END IF;
 RAISE NOTICE 'G74 PASS: one G73 booked trip is the same private G4 searching row';
END $qa$;
RESET ROLE;
-- Real RLS for the Passenger's verified JWT sub, not a service-role
-- projection that would bypass RLS.
SET ROLE authenticated;
SET request.jwt.claim.sub='74740000-0000-4747-8747-000000000001';
DO $own$
DECLARE tid uuid; st public.mobility_stage_trip_status; rev bigint; cnt int;
BEGIN
 SELECT id,status,revision INTO tid,st,rev
 FROM public.mobility_stage_auto_demo_trips
 WHERE request_key='74740000-0000-4747-8747-000000000012'::uuid;
 IF NOT FOUND OR tid IS NULL OR st<>'searching' OR rev<>1
 THEN RAISE EXCEPTION 'G74 own client cannot observe booked searching trip'; END IF;
 SELECT count(*) INTO cnt FROM public.mobility_stage_auto_demo_trips
 WHERE passenger_id='74740000-0000-4747-8747-000000000002'::uuid;
 IF cnt<>0 THEN RAISE EXCEPTION 'G74 cross-owner Passenger SELECT'; END IF;
END $own$;
SET request.jwt.claim.sub='74740000-0000-4747-8747-000000000002';
DO $foreign$
DECLARE cnt int;
BEGIN
 SELECT count(*) INTO cnt FROM public.mobility_stage_auto_demo_trips
 WHERE request_key='74740000-0000-4747-8747-000000000012'::uuid;
 IF cnt<>0 THEN RAISE EXCEPTION 'G74 foreign JWT read G73 trip'; END IF;
END $foreign$;
RESET ROLE;
-- G3/G4 lifecycle may only change by server RPC. Cancellation is the only
-- legal transition before assignment; G74 sees updated revision from same
-- underlying table; retry of bookkey must remain the original trip.
SET ROLE service_role;
DO $cancel$
DECLARE
 owner_id uuid:='74740000-0000-4747-8747-000000000001';
 bookkey uuid:='74740000-0000-4747-8747-000000000012';
 quote_id uuid; tid uuid; receipt jsonb; event_id uuid;
BEGIN
 SELECT id INTO quote_id FROM public.mobility_stage_g72_auto_prequotes
 WHERE request_key='74740000-0000-4747-8747-000000000011'::uuid;
 tid:=public.mobility_stage_g73_book(owner_id,quote_id,bookkey);
 event_id:=public.mobility_stage_auto_demo_transition(
  tid,owner_id,'cancelled','74740000-0000-4747-8747-000000000013'::uuid);
 IF event_id IS NULL THEN RAISE EXCEPTION 'G74 cancellation event missing'; END IF;
 receipt:=public.mobility_stage_g73_booking_receipt(owner_id,bookkey);
 IF receipt->>'tripId'<>tid::text OR (receipt->>'revision')::int<>2
 OR (SELECT status FROM public.mobility_stage_auto_demo_trips WHERE id=tid)<>'cancelled'
 THEN RAISE EXCEPTION 'G74 RLS/staging lifecycle drift after cancellation'; END IF;
 IF public.mobility_stage_g73_book(owner_id,quote_id,bookkey)<>tid
 THEN RAISE EXCEPTION 'G74 lost ACK rebooked a cancelled trip'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_auto_demo_trips
 WHERE passenger_id=owner_id)<>1
 THEN RAISE EXCEPTION 'G74 cancellation generated duplicate ride'; END IF;
 RAISE NOTICE 'G74 PASS: cancellation revision 2, same receipt and trip, no replay write';
END $cancel$;
RESET ROLE;
