-- Verify courier polling after G14 synthetic second-courier fixture.
-- Disposable PostgreSQL 16 only; never connect to remote or real identities.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G15 requires disposable chain database'; END IF;
 IF has_function_privilege('authenticated',
  'public.mobility_stage_poll_courier_delivery_offers(uuid)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_poll_courier_delivery_offers(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G15 polling exposed to client SQL role'; END IF;
 IF NOT has_function_privilege('service_role',
  'public.mobility_stage_poll_courier_delivery_offers(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G15 service worker cannot poll'; END IF;
END $guard$;

INSERT INTO auth.users(id) VALUES ('00000000-0000-4000-8000-000000000171');
SET ROLE service_role;
DO $assert$
DECLARE
 v_sender uuid:='00000000-0000-4000-8000-000000000171';
 v_courier uuid:='00000000-0000-4000-8000-000000000163';
 v_vehicle uuid:='00000000-0000-4000-8000-000000000164';
 v_delivery uuid;
 v_offer uuid;
 n integer;
BEGIN
 SELECT public.mobility_stage_delivery_request(v_sender,
  '00000000-0000-4000-8000-000000000172','MOTO','PARCEL',
  200,10,10,10,'CENTRO','LAMBRARE',false) INTO v_delivery;
 SELECT public.mobility_stage_delivery_offer(v_delivery,v_courier,v_vehicle,
  '00000000-0000-4000-8000-000000000173',30) INTO v_offer;

 SELECT count(*) INTO n FROM public.mobility_stage_poll_courier_delivery_offers(v_courier)
 WHERE offer_id=v_offer;
 IF n<>1 THEN RAISE EXCEPTION 'G15 private courier cannot discover own offer'; END IF;
 SELECT count(*) INTO n FROM public.mobility_stage_poll_courier_delivery_offers(v_sender);
 IF n<>0 THEN RAISE EXCEPTION 'G15 sender discovered another actor offer'; END IF;

 -- Simulate a provider timeout after BEGIN: G13 leaves the row uncertain.
 UPDATE public.mobility_stage_delivery_offer_outbox o SET
  claimed_at=pg_catalog.clock_timestamp()-interval '1 second',
  claimed_by='00000000-0000-4000-8000-000000000111',
  claim_nonce=pg_catalog.gen_random_uuid(),
  send_started_at=pg_catalog.clock_timestamp()
 WHERE o.offer_id=v_offer;
 SELECT count(*) INTO n FROM public.mobility_stage_poll_courier_delivery_offers(v_courier)
 WHERE offer_id=v_offer;
 IF n<>1 THEN RAISE EXCEPTION 'G15 lost private offer after ambiguous push'; END IF;

 -- Expiry is authoritative regardless of push status.
 UPDATE public.mobility_stage_delivery_offers f
 SET offered_at=pg_catalog.clock_timestamp()-interval '60 seconds',
     expires_at=pg_catalog.clock_timestamp()-interval '20 seconds'
 WHERE f.id=v_offer;
 SELECT count(*) INTO n FROM public.mobility_stage_poll_courier_delivery_offers(v_courier)
 WHERE offer_id=v_offer;
 IF n<>0 THEN RAISE EXCEPTION 'G15 surfaced expired private offer'; END IF;
END $assert$;
RESET ROLE;
