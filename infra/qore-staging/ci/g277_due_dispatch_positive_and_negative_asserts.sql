-- G277 disposable PG16/17-only end-to-end due batch: never run in Supabase.
DO $acl$
BEGIN
 IF NOT has_function_privilege('service_role',
  'public.mobility_stage_g113_run_due_auto_batch_qa(integer)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_g113_run_due_auto_batch_qa(integer)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g113_run_due_auto_batch_qa(integer)','EXECUTE')
 OR has_function_privilege('authenticated',
  'qore_stage_internal.mobility_stage_g113_run_due_auto_batch_qa(integer)','EXECUTE')
 THEN RAISE EXCEPTION 'G277 private worker privilege leak'; END IF;
END $acl$;
SET ROLE service_role;
DO $enqueue$
DECLARE
 b uuid:='00000000-0000-4000-8000-000000000102';
 booking uuid:='00000000-0000-4000-8000-000000000501';
 route_id uuid; quote_id uuid; trip_id uuid;
 reply jsonb; denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g113_run_due_auto_batch_qa(0);
 EXCEPTION WHEN SQLSTATE 'P2771' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G277 accepted unbounded 0 budget'; END IF;
 route_id:=public.mobility_stage_g73_route(b,
  '00000000-0000-4000-8000-000000000502','confort',
  'MERCADO','COSTANERA','ASUNCION_FIXTURE',4600,680,0);
 quote_id:=public.mobility_stage_g73_quote(b,route_id,
  '00000000-0000-4000-8000-000000000503');
 trip_id:=public.mobility_stage_g73_book(b,quote_id,booking);
 PERFORM pg_catalog.set_config('qore.g277.trip_id',trip_id::text,false);
 reply:=public.mobility_stage_g113_run_due_auto_batch_qa(1);
 IF reply IS NULL OR reply->>'processed'<>'1'
  OR reply->>'waiting'<>'1' OR reply->>'offered'<>'0'
  OR reply->>'commercialEnabled'<>'false'
  OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(reply))<>7
 THEN RAISE EXCEPTION 'G277 bounded first attempt not WAITING: %',reply; END IF;
 reply:=public.mobility_stage_g113_run_due_auto_batch_qa(1);
 IF reply->>'processed'<>'0' OR reply->>'waiting'<>'0'
 THEN RAISE EXCEPTION 'G277 due backoff ignored: %',reply; END IF;
 RAISE NOTICE 'G277 first automatically enqueued attempt and no premature retry PASS';
END $enqueue$;
RESET ROLE;
UPDATE public.mobility_stage_g269_auto_dispatch_jobs
 SET next_attempt_at=pg_catalog.clock_timestamp()-interval '1 second'
 WHERE booking_key='00000000-0000-4000-8000-000000000501';
SET ROLE service_role;
DO $offer$
DECLARE
 b uuid:='00000000-0000-4000-8000-000000000102';
 booking uuid:='00000000-0000-4000-8000-000000000501';
 t uuid:=pg_catalog.current_setting('qore.g277.trip_id')::uuid;
 d uuid:='00000000-0000-4000-8000-000000000103';
 v uuid:='00000000-0000-4000-8000-000000000303';
 proof uuid:='00000000-0000-4000-8000-000000000504';
 reply jsonb;
BEGIN
 PERFORM public.mobility_stage_g269_register_pickup_road_proof(
  b,booking,t,d,v,proof,'GEOAPIFY',1800,pg_catalog.clock_timestamp());
 reply:=public.mobility_stage_g113_run_due_auto_batch_qa(1);
 IF reply->>'processed'<>'1' OR reply->>'offered'<>'1'
 THEN RAISE EXCEPTION 'G277 real SQL due batch did not offer: %',reply; END IF;
 reply:=public.mobility_stage_g113_run_due_auto_batch_qa(1);
 IF reply->>'processed'<>'0'
 THEN RAISE EXCEPTION 'G277 active offer retried before expiry: %',reply; END IF;
 RAISE NOTICE 'G277 verified fresh road proof delivered one offer, no premature duplicate';
END $offer$;
RESET ROLE;
DO $accepted$
DECLARE t uuid:=pg_catalog.current_setting('qore.g277.trip_id')::uuid;
BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_auto_demo_offers WHERE trip_id=t)<>1
  OR (SELECT count(*) FROM public.mobility_stage_auto_demo_push_outbox p
     JOIN public.mobility_stage_auto_demo_offers o ON o.id=p.offer_id
     WHERE o.trip_id=t)<>1
 THEN RAISE EXCEPTION 'G277 did not preserve unique offer/outbox'; END IF;
 UPDATE public.mobility_stage_auto_demo_trips SET status='accepted' WHERE id=t;
END $accepted$;
SET ROLE service_role;
DO $close$
DECLARE reply jsonb;
BEGIN
 reply:=public.mobility_stage_g113_run_due_auto_batch_qa(1);
 IF reply->>'processed'<>'1' OR reply->>'closed'<>'1'
 THEN RAISE EXCEPTION 'G277 did not reconcile accepted ride: %',reply; END IF;
 reply:=public.mobility_stage_g113_run_due_auto_batch_qa(1);
 IF reply->>'processed'<>'0'
 THEN RAISE EXCEPTION 'G277 repeated closed ride: %',reply; END IF;
 RAISE NOTICE 'G277 bounded G113 dispatch and accepted-state cleanup PASS';
END $close$;
RESET ROLE;
