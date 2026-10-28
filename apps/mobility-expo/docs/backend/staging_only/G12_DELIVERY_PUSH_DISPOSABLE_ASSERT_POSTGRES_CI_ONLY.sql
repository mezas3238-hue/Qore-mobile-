-- G12 executable assertions after disposable fixture + migration.
DO $assert$
DECLARE a uuid:='00000000-0000-4000-8000-000000000021';
 b uuid:='00000000-0000-4000-8000-000000000022';
 offer uuid:='00000000-0000-4000-8000-000000000012';
 n integer;
BEGIN
 SELECT count(*) INTO n FROM public.mobility_stage_claim_delivery_push(a);
 IF n<>1 THEN RAISE EXCEPTION 'G12 first claim expected one offer, got %',n; END IF;
 SELECT count(*) INTO n FROM public.mobility_stage_claim_delivery_push(b);
 IF n<>0 THEN RAISE EXCEPTION 'G12 duplicate claim returned %',n; END IF;
 IF public.mobility_stage_ack_delivery_push(b,offer,'ticket_12345')
 THEN RAISE EXCEPTION 'G12 wrong worker ACK succeeded'; END IF;
 IF NOT public.mobility_stage_ack_delivery_push(a,offer,'ticket_12345')
 THEN RAISE EXCEPTION 'G12 owner ACK failed'; END IF;
 IF public.mobility_stage_ack_delivery_push(a,offer,'ticket_12345')
 THEN RAISE EXCEPTION 'G12 duplicate ACK succeeded'; END IF;
 IF (SELECT receipt_confirmed_at IS NOT NULL
     FROM public.mobility_stage_delivery_offer_outbox WHERE offer_id=offer)
 THEN RAISE EXCEPTION 'G12 provider ACK falsely confirmed device receipt'; END IF;
END $assert$;
