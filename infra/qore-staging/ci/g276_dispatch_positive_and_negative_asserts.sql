-- G276 full disposable SQL path G262 route -> quote -> book ->
-- auto-enqueue -> wait -> verified road proof -> offer/outbox -> close.
-- NO Supabase, real Auth, real vehicle approval, real distance or money.
SET ROLE service_role;
DO $positive$
DECLARE
 a uuid:='00000000-0000-4000-8000-000000000101';
 b uuid:='00000000-0000-4000-8000-000000000102';
 booking uuid:='00000000-0000-4000-8000-000000000401';
 rid uuid; qid uuid; tid uuid; reply jsonb; blocked boolean;
BEGIN
 rid:=public.mobility_stage_g73_route(a,
  '00000000-0000-4000-8000-000000000402','economico',
  'PANTEON','TERMINAL','ASUNCION_FIXTURE',3500,650,0);
 qid:=public.mobility_stage_g73_quote(a,rid,
  '00000000-0000-4000-8000-000000000403');
 tid:=public.mobility_stage_g73_book(a,qid,booking);
 IF tid IS NULL OR public.mobility_stage_g73_book(a,qid,booking)<>tid
 THEN RAISE EXCEPTION 'G276 non-idempotent G262 booking'; END IF;
 PERFORM pg_catalog.set_config('qore.g276.trip_id',tid::text,false);
 reply:=public.mobility_stage_g90_passenger_dispatch_status_qa(a,booking);
 IF reply->>'tripId'<>tid::text
    OR reply->>'dispatchState'<>'SEARCHING_DRIVER'
 THEN RAISE EXCEPTION 'G276 booking not enqueued automatically: %',reply; END IF;
 IF public.mobility_stage_g90_passenger_dispatch_status_qa(b,booking) IS NOT NULL
 THEN RAISE EXCEPTION 'G276 other passenger received queue data'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_g112_run_booked_auto_dispatch_qa(b,booking,tid);
 EXCEPTION WHEN SQLSTATE 'P2693' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G276 foreign dispatcher was not denied'; END IF;
 reply:=public.mobility_stage_g112_run_booked_auto_dispatch_qa(a,booking,tid);
 IF reply->>'status'<>'WAITING' OR reply->>'tripId'<>tid::text
 THEN RAISE EXCEPTION 'G276 no-candidate result must WAIT: %',reply; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.mobility_stage_g269_register_pickup_road_proof(
   a,booking,tid,'00000000-0000-4000-8000-000000000103',
   '00000000-0000-4000-8000-000000000303',
   '00000000-0000-4000-8000-000000000404','GEOAPIFY',
   5001,pg_catalog.clock_timestamp());
 EXCEPTION WHEN SQLSTATE 'P2692' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'G276 Driver outside road radius passed'; END IF;
 RAISE NOTICE 'G276 route/quote/booking, zero-driver WAITING and owner fences PASS';
END $positive$;
RESET ROLE;
DO $audit$
DECLARE booking uuid:='00000000-0000-4000-8000-000000000401'; t uuid;
BEGIN
 t:=pg_catalog.current_setting('qore.g276.trip_id')::uuid;
 IF (SELECT count(*) FROM public.mobility_stage_g269_auto_dispatch_jobs
      WHERE booking_key=booking AND trip_id=t AND attempts=1
       AND status='WAITING')<>1
    OR (SELECT count(*) FROM public.mobility_stage_auto_demo_offers)<>0
    OR (SELECT count(*) FROM public.mobility_stage_auto_demo_push_outbox)<>0
 THEN RAISE EXCEPTION 'G276 queue side effects or duplicates before proof'; END IF;
 UPDATE public.mobility_stage_g269_auto_dispatch_jobs
 SET next_attempt_at=pg_catalog.clock_timestamp()-interval '1 second'
 WHERE booking_key=booking;
END $audit$;
SET ROLE service_role;
DO $offered$
DECLARE
 a uuid:='00000000-0000-4000-8000-000000000101';
 b uuid:='00000000-0000-4000-8000-000000000102';
 d uuid:='00000000-0000-4000-8000-000000000103';
 v uuid:='00000000-0000-4000-8000-000000000303';
 booking uuid:='00000000-0000-4000-8000-000000000401';
 proofkey uuid:='00000000-0000-4000-8000-000000000405';
 tid uuid:=pg_catalog.current_setting('qore.g276.trip_id')::uuid;
 verified_at timestamptz:=pg_catalog.clock_timestamp();
 proof_id uuid; reply jsonb; offer_id text; denied boolean;
BEGIN
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g269_register_pickup_road_proof(
    b,booking,tid,d,v,proofkey,'GEOAPIFY',2200,verified_at);
 EXCEPTION WHEN SQLSTATE 'P2692' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G276 proof for foreign passenger accepted'; END IF;
 proof_id:=public.mobility_stage_g269_register_pickup_road_proof(
    a,booking,tid,d,v,proofkey,'GEOAPIFY',2200,verified_at);
 IF proof_id IS NULL OR proof_id<>public.mobility_stage_g269_register_pickup_road_proof(
    a,booking,tid,d,v,proofkey,'GEOAPIFY',2200,verified_at)
 THEN RAISE EXCEPTION 'G276 proof idempotency failed'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g269_register_pickup_road_proof(
    a,booking,tid,d,v,proofkey,'GEOAPIFY',2100,verified_at);
 EXCEPTION WHEN SQLSTATE 'P2692' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G276 conflicting road-proof replay accepted'; END IF;
 reply:=public.mobility_stage_g112_run_booked_auto_dispatch_qa(a,booking,tid);
 IF reply->>'status'<>'OFFERED' OR reply->>'tripId'<>tid::text
  OR reply->>'offerId' IS NULL
 THEN RAISE EXCEPTION 'G276 verified candidate never offered: %',reply; END IF;
 offer_id:=reply->>'offerId';
 reply:=public.mobility_stage_g112_run_booked_auto_dispatch_qa(a,booking,tid);
 IF reply->>'status'<>'OFFERED' OR reply->>'offerId'<>offer_id
 THEN RAISE EXCEPTION 'G276 duplicate worker call changed offer: %',reply; END IF;
 reply:=public.mobility_stage_g90_passenger_dispatch_status_qa(a,booking);
 IF reply->>'dispatchState'<>'OFFER_PENDING'
    OR reply->>'offerPendingAcceptance'<>'true'
 THEN RAISE EXCEPTION 'G276 passenger status did not reflect offer: %',reply; END IF;
 IF public.mobility_stage_g90_passenger_dispatch_status_qa(b,booking) IS NOT NULL
 THEN RAISE EXCEPTION 'G276 passenger isolation after offer failed'; END IF;
 RAISE NOTICE 'G276 verified proof, dispatch, outbox and replay PASS';
END $offered$;
RESET ROLE;
DO $sideeffects$
DECLARE tid uuid:=pg_catalog.current_setting('qore.g276.trip_id')::uuid;
BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_auto_demo_offers
      WHERE trip_id=tid AND status='offered')<>1
 OR (SELECT count(*) FROM public.mobility_stage_auto_demo_push_outbox)<>1
 OR (SELECT count(*) FROM public.mobility_stage_g269_auto_dispatch_jobs
      WHERE trip_id=tid AND status='OFFERED' AND offer_id IS NOT NULL)<>1
 THEN RAISE EXCEPTION 'G276 offer/outbox not atomic or duplicate'; END IF;
 UPDATE public.mobility_stage_auto_demo_trips
  SET status='accepted' WHERE id=tid;
END $sideeffects$;
SET ROLE service_role;
DO $closed$
DECLARE
 a uuid:='00000000-0000-4000-8000-000000000101';
 booking uuid:='00000000-0000-4000-8000-000000000401';
 tid uuid:=pg_catalog.current_setting('qore.g276.trip_id')::uuid;
 reply jsonb;
BEGIN
 reply:=public.mobility_stage_g112_run_booked_auto_dispatch_qa(a,booking,tid);
 IF reply->>'status'<>'CLOSED' OR reply->>'tripId'<>tid::text
 THEN RAISE EXCEPTION 'G276 accepted trip not closed: %',reply; END IF;
 reply:=public.mobility_stage_g90_passenger_dispatch_status_qa(a,booking);
 IF reply->>'dispatchState'<>'CLOSED' OR reply->>'tripState'<>'accepted'
 THEN RAISE EXCEPTION 'G276 closed trip receipt inconsistent: %',reply; END IF;
 RAISE NOTICE 'G276 entire disposable SQL dispatch lifecycle PASS';
END $closed$;
RESET ROLE;
