-- G13 real-schema SQL assertions, after synthetic G12 delivery E2E.
-- Database is disposable on localhost. Never migrate any remote database.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'Not a disposable G13 CI database'; END IF;
END $guard$;

INSERT INTO auth.users(id) VALUES ('00000000-0000-4000-8000-000000000118');

DO $assert$
BEGIN
 IF has_function_privilege('service_role',
   'public.mobility_stage_claim_delivery_push(uuid)','EXECUTE')
 OR has_function_privilege('service_role',
   'public.mobility_stage_ack_delivery_push(uuid,uuid,text)','EXECUTE')
 OR has_function_privilege('service_role',
   'public.mobility_stage_expire_delivery_push_claims()','EXECUTE')
 THEN RAISE EXCEPTION 'Legacy G12 unsafe worker entrypoints still enabled'; END IF;
 IF has_function_privilege('authenticated',
   'public.mobility_stage_claim_delivery_push_v2(uuid)','EXECUTE')
 OR has_function_privilege('anon',
   'public.mobility_stage_begin_delivery_push_v2(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
   'public.mobility_stage_ack_delivery_push_v2(uuid,uuid,uuid,text)','EXECUTE')
 OR has_function_privilege('anon',
   'public.mobility_stage_expire_delivery_push_claims_v2()','EXECUTE')
 THEN RAISE EXCEPTION 'G13 fenced RPC privileges exposed to clients'; END IF;
 IF NOT has_function_privilege('service_role',
   'public.mobility_stage_begin_delivery_push_v2(uuid,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G13 trusted worker denied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.mobility_stage_delivery_offer_outbox o
  WHERE o.provider_ticket_id='ticket_12345'
   AND o.accepted_for_processing_at IS NOT NULL
   AND o.claim_nonce IS NOT NULL AND o.send_started_at IS NOT NULL)
 THEN RAISE EXCEPTION 'G13 unsafe migration lost previously accepted G12 ticket'; END IF;
END $assert$;

SET ROLE service_role;
DO $assert$
DECLARE sender uuid:='00000000-0000-4000-8000-000000000102';
 another_sender uuid:='00000000-0000-4000-8000-000000000118';
 courier uuid:='00000000-0000-4000-8000-000000000103';
 vehicle uuid:='00000000-0000-4000-8000-000000000104';
 worker_a uuid:='00000000-0000-4000-8000-000000000111';
 worker_b uuid:='00000000-0000-4000-8000-000000000112';
 delivery_id uuid;
 v_offer uuid;
 old_nonce uuid;
 ticket_id text;
 c record;
 n integer;
BEGIN
 SELECT public.mobility_stage_delivery_request(sender,
  '00000000-0000-4000-8000-000000000131','MOTO','DOCUMENTS',
  200,8,8,8,'CENTRO','LAMBRARE',false) INTO delivery_id;
 SELECT public.mobility_stage_delivery_offer(delivery_id,courier,vehicle,
  '00000000-0000-4000-8000-000000000132',30) INTO v_offer;
 SELECT * INTO c FROM public.mobility_stage_claim_delivery_push_v2(worker_a);
 IF NOT FOUND OR c.offer_id<>v_offer OR c.claim_nonce IS NULL
 THEN RAISE EXCEPTION 'G13 first claim missing valid token'; END IF;
 old_nonce:=c.claim_nonce;

 -- Simulated 13-second pause before any provider call. Only an UNSENT claim is reclaimable.
 UPDATE public.mobility_stage_delivery_offer_outbox o
 SET claimed_at=pg_catalog.clock_timestamp()-interval '13 seconds'
 WHERE o.offer_id=v_offer;
 SELECT * INTO c FROM public.mobility_stage_claim_delivery_push_v2(worker_b);
 IF NOT FOUND OR c.offer_id<>v_offer OR c.claim_nonce=old_nonce
 THEN RAISE EXCEPTION 'G13 did not rotate stale pre-send lease'; END IF;
 IF public.mobility_stage_begin_delivery_push_v2(worker_a,v_offer,old_nonce)
 THEN RAISE EXCEPTION 'G13 stale worker was permitted to send'; END IF;
 IF public.mobility_stage_ack_delivery_push_v2(worker_a,v_offer,old_nonce,'ticket_old_123')
 THEN RAISE EXCEPTION 'G13 stale worker was permitted to ACK'; END IF;
 IF NOT public.mobility_stage_begin_delivery_push_v2(worker_b,v_offer,c.claim_nonce)
 THEN RAISE EXCEPTION 'G13 current worker could not prepare'; END IF;
 IF public.mobility_stage_begin_delivery_push_v2(worker_b,v_offer,c.claim_nonce)
 THEN RAISE EXCEPTION 'G13 duplicate begin succeeded'; END IF;
 IF NOT public.mobility_stage_ack_delivery_push_v2(worker_b,v_offer,c.claim_nonce,
  'ticket_new_123') THEN RAISE EXCEPTION 'G13 current worker ACK failed'; END IF;
 IF public.mobility_stage_ack_delivery_push_v2(worker_b,v_offer,c.claim_nonce,
  'ticket_new_123') THEN RAISE EXCEPTION 'G13 duplicate ACK succeeded'; END IF;
 IF (SELECT o.receipt_confirmed_at IS NOT NULL
   FROM public.mobility_stage_delivery_offer_outbox o WHERE o.offer_id=v_offer)
 THEN RAISE EXCEPTION 'G13 provider ACK wrongly implied device receipt'; END IF;

 -- A distinct requested delivery simulates a crashed worker AFTER BEGIN.
 SELECT public.mobility_stage_delivery_request(another_sender,
  '00000000-0000-4000-8000-000000000133','MOTO','PARCEL',
  400,10,10,10,'CENTRO','MARIANO_ROQUE',false) INTO delivery_id;
 SELECT public.mobility_stage_delivery_offer(delivery_id,courier,vehicle,
  '00000000-0000-4000-8000-000000000134',30) INTO v_offer;
 SELECT * INTO c FROM public.mobility_stage_claim_delivery_push_v2(worker_a);
 IF NOT FOUND OR c.offer_id<>v_offer THEN
  RAISE EXCEPTION 'G13 prepared-send scenario did not claim expected offer'; END IF;
 IF NOT public.mobility_stage_begin_delivery_push_v2(worker_a,v_offer,c.claim_nonce)
 THEN RAISE EXCEPTION 'G13 BEGIN failed'; END IF;
 UPDATE public.mobility_stage_delivery_offer_outbox o
 SET claimed_at=pg_catalog.clock_timestamp()-interval '30 seconds'
 WHERE o.offer_id=v_offer;
 SELECT count(*) INTO n FROM public.mobility_stage_claim_delivery_push_v2(worker_b);
 IF n<>0 THEN RAISE EXCEPTION 'G13 retried ambiguous prepared send'; END IF;
 UPDATE public.mobility_stage_delivery_offers f
 SET offered_at=pg_catalog.clock_timestamp()-interval '60 seconds',
     expires_at=pg_catalog.clock_timestamp()-interval '20 seconds'
 WHERE f.id=v_offer;
 SELECT public.mobility_stage_expire_delivery_push_claims_v2() INTO n;
 IF n<>0 THEN RAISE EXCEPTION 'G13 discarded an ambiguous prepared send'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.mobility_stage_delivery_offer_outbox o
  WHERE o.offer_id=v_offer AND o.send_started_at IS NOT NULL
   AND o.claimed_by=worker_a AND o.provider_ticket_id IS NULL)
 THEN RAISE EXCEPTION 'G13 failed to retain ambiguous prepared send for support'; END IF;

 -- An expired but UNSENT claimed offer may be released without ever re-sending.
 -- The ambiguous row remains intentionally available for manual reconciliation,
 -- never eligible for automatic resend even though its offer has expired.
END $assert$;
RESET ROLE;
