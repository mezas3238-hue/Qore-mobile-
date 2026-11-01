-- G277 CI_ONLY: exact G262 booking -> G269 enqueue, verified scope,
-- limited offer and G113 expiry/retry. Disposable actors are NOT legal KYC.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_g277_ci' THEN
  RAISE EXCEPTION 'G277 CI_ONLY cannot run on persistent DB'; END IF;
 IF NOT has_function_privilege('service_role',
 'public.mobility_stage_g112_run_booked_auto_dispatch_qa(uuid,uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role',
 'public.mobility_stage_g113_run_due_auto_batch_qa(integer)','EXECUTE')
 OR has_function_privilege('anon',
 'public.mobility_stage_g113_run_due_auto_batch_qa(integer)','EXECUTE')
 OR has_function_privilege('authenticated',
 'public.mobility_stage_g90_passenger_dispatch_status_qa(uuid,uuid)','EXECUTE')
 OR has_table_privilege('service_role',
 'public.mobility_stage_g269_auto_dispatch_jobs','SELECT')
 OR NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
  WHERE oid='public.mobility_stage_g269_auto_dispatch_jobs'::regclass)
 THEN RAISE EXCEPTION 'G277 G269 public RPC ACL or queue RLS violation'; END IF;
END $guard$;

DO $test$
DECLARE
 passenger uuid:='00000000-0000-4000-8000-000000000101';
 other_passenger uuid:='00000000-0000-4000-8000-000000000102';
 driver uuid:='00000000-0000-4000-8000-000000000103';
 vehicle uuid:='00000000-0000-4000-8000-000000000301';
 rk uuid:='00000000-0000-4000-8000-000000000401';
 qk uuid:='00000000-0000-4000-8000-000000000402';
 bk uuid:='00000000-0000-4000-8000-000000000403';
 pk uuid:='00000000-0000-4000-8000-000000000404';
 route_id uuid; quote_id uuid; trip_id uuid; proof_id uuid;
 receipt jsonb; refused boolean;
BEGIN
 route_id:=public.mobility_stage_g73_route(passenger,rk,'economico',
  'PANTEON','AEROPUERTO','ASUNCION_FIXTURE',5000,600,0);
 quote_id:=public.mobility_stage_g73_quote(passenger,route_id,qk);
 trip_id:=public.mobility_stage_g73_book(passenger,quote_id,bk);
 IF public.mobility_stage_g73_book(passenger,quote_id,bk)<>trip_id
  OR (SELECT count(*) FROM public.mobility_stage_g269_auto_dispatch_jobs
   WHERE trip_id=trip_id AND booking_key=bk AND passenger_id=passenger)<>1
 THEN RAISE EXCEPTION 'G277 original trip booking not exactly once queued'; END IF;
 receipt:=public.mobility_stage_g90_passenger_dispatch_status_qa(passenger,bk);
 IF receipt->>'dispatchState'<>'SEARCHING_DRIVER'
  OR receipt->>'tripId'<>trip_id::text
  OR public.mobility_stage_g90_passenger_dispatch_status_qa(other_passenger,bk) IS NOT NULL
 THEN RAISE EXCEPTION 'G277 G90 wrong passenger scope or dispatch state: %',receipt; END IF;
 refused:=false;
 BEGIN
  PERFORM public.mobility_stage_g269_register_pickup_road_proof(
   other_passenger,bk,trip_id,driver,vehicle,pk,
   'GEOAPIFY',2300,pg_catalog.clock_timestamp());
 EXCEPTION WHEN SQLSTATE 'P2692' THEN refused:=true; END;
 IF NOT refused THEN RAISE EXCEPTION 'G277 cross-owner provider proof admitted'; END IF;
 refused:=false;
 BEGIN
  PERFORM public.mobility_stage_g269_register_pickup_road_proof(
   passenger,bk,trip_id,driver,vehicle,pk,
   'GEOAPIFY',7000,pg_catalog.clock_timestamp());
 EXCEPTION WHEN SQLSTATE 'P2692' THEN refused:=true; END;
 IF NOT refused THEN RAISE EXCEPTION 'G277 out-of-radius Driver admitted'; END IF;
 proof_id:=public.mobility_stage_g269_register_pickup_road_proof(
  passenger,bk,trip_id,driver,vehicle,pk,
  'GEOAPIFY',2300,pg_catalog.clock_timestamp());
 IF proof_id IS NULL THEN RAISE EXCEPTION 'G277 verified proof not persisted'; END IF;
 receipt:=public.mobility_stage_g112_run_booked_auto_dispatch_qa(passenger,bk,trip_id);
 IF receipt->>'status'<>'OFFERED'
  OR (SELECT count(*) FROM public.mobility_stage_auto_demo_push_outbox)<>1
  OR (SELECT status FROM public.mobility_stage_g269_auto_dispatch_jobs
      WHERE booking_key=bk)<>'OFFERED'
  OR (SELECT attempts FROM public.mobility_stage_g269_auto_dispatch_jobs
      WHERE booking_key=bk)<>1
  OR (SELECT j.next_attempt_at=o.expires_at
    FROM public.mobility_stage_g269_auto_dispatch_jobs j
    JOIN public.mobility_stage_auto_demo_offers o ON o.id=j.offer_id
    WHERE j.booking_key=bk) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'G277 offer or expiry was not durably scheduled: %',receipt; END IF;
 receipt:=public.mobility_stage_g90_passenger_dispatch_status_qa(passenger,bk);
 IF receipt->>'dispatchState'<>'OFFER_PENDING'
 THEN RAISE EXCEPTION 'G277 passenger pending receipt wrong: %',receipt; END IF;
 receipt:=public.mobility_stage_g113_run_due_auto_batch_qa(5);
 IF receipt->>'processed'<>'0'
 THEN RAISE EXCEPTION 'G277 G113 touched offer before expiry: %',receipt; END IF;
 -- Simulate expiration ONLY in disposable PG17. Never change real offers.
 UPDATE public.mobility_stage_auto_demo_offers
 SET expires_at=pg_catalog.clock_timestamp()-interval '2 seconds',
  status='expired' WHERE trip_id=trip_id;
 UPDATE public.mobility_stage_g269_auto_dispatch_jobs
 SET next_attempt_at=pg_catalog.clock_timestamp()-interval '2 seconds'
 WHERE booking_key=bk;
 receipt:=public.mobility_stage_g113_run_due_auto_batch_qa(5);
 IF receipt->>'processed'<>'1' OR receipt->>'waiting'<>'1'
  OR (SELECT attempts FROM public.mobility_stage_g269_auto_dispatch_jobs
      WHERE booking_key=bk)<>2
  OR (SELECT status FROM public.mobility_stage_g269_auto_dispatch_jobs
      WHERE booking_key=bk)<>'WAITING'
  OR (SELECT offer_id FROM public.mobility_stage_g269_auto_dispatch_jobs
      WHERE booking_key=bk) IS NOT NULL
  OR (SELECT count(*) FROM public.mobility_stage_auto_demo_push_outbox)<>1
 THEN RAISE EXCEPTION 'G277 expired offer not safely retried: %',receipt; END IF;
 receipt:=public.mobility_stage_g113_run_due_auto_batch_qa(5);
 IF receipt->>'processed'<>'0'
 THEN RAISE EXCEPTION 'G277 duplicate automatic immediate retry: %',receipt; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_g269_auto_dispatch_jobs)<>1
 THEN RAISE EXCEPTION 'G277 booking identity or queue duplicated'; END IF;
 RAISE NOTICE 'G277 disposable exact G262+G269+G113 booking, proof, offer, expiry, RLS PASS';
END $test$;
