-- G12 recovery invariant: expired claims are cleaned, not automatically resent.
-- Run AFTER G12_DELIVERY_PUSH_DISPOSABLE_ASSERT_POSTGRES_CI_ONLY.sql on disposable PostgreSQL only.
DO $assert$
DECLARE
  worker uuid := '00000000-0000-4000-8000-000000000021';
  expired_offer uuid := '00000000-0000-4000-8000-000000000014';
  active_offer uuid := '00000000-0000-4000-8000-000000000015';
  n integer;
BEGIN
  -- Two additional synthetic claims: one expired and one still valid.
  INSERT INTO public.mobility_stage_delivery_offers
    (id,delivery_id,courier_id,status,expires_at) VALUES
    (expired_offer,'00000000-0000-4000-8000-000000000011',
     '00000000-0000-4000-8000-000000000013','offered',
     pg_catalog.clock_timestamp()-interval '30 seconds'),
    (active_offer,'00000000-0000-4000-8000-000000000011',
     '00000000-0000-4000-8000-000000000013','offered',
     pg_catalog.clock_timestamp()+interval '60 seconds');
  INSERT INTO public.mobility_stage_delivery_offer_outbox
    (offer_id,courier_id,claimed_at,claimed_by) VALUES
    (expired_offer,'00000000-0000-4000-8000-000000000013',
     pg_catalog.clock_timestamp()-interval '40 seconds',worker),
    (active_offer,'00000000-0000-4000-8000-000000000013',
     pg_catalog.clock_timestamp()-interval '40 seconds',worker);

  SELECT public.mobility_stage_expire_delivery_push_claims() INTO n;
  IF n<>1 THEN RAISE EXCEPTION 'G12 expiry cleanup affected %, expected 1',n; END IF;
  IF EXISTS (SELECT 1 FROM public.mobility_stage_delivery_offer_outbox
    WHERE offer_id=expired_offer AND
      (claimed_at IS NOT NULL OR claimed_by IS NOT NULL))
  THEN RAISE EXCEPTION 'G12 expired claim not cleaned'; END IF;
  IF EXISTS (SELECT 1 FROM public.mobility_stage_delivery_offer_outbox
    WHERE offer_id=active_offer AND
      (claimed_at IS NULL OR claimed_by IS NULL))
  THEN RAISE EXCEPTION 'G12 active claim was wrongly cleaned'; END IF;
  IF EXISTS (SELECT 1 FROM public.mobility_stage_delivery_offer_outbox
    WHERE offer_id='00000000-0000-4000-8000-000000000012'
      AND (accepted_for_processing_at IS NULL OR provider_ticket_id <> 'ticket_12345'))
  THEN RAISE EXCEPTION 'G12 acknowledged provider ticket lost'; END IF;

  -- Cleanup is idempotent and must never make expired offers eligible again.
  SELECT public.mobility_stage_expire_delivery_push_claims() INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'G12 repeated cleanup modified % rows',n; END IF;
  SELECT count(*) INTO n FROM public.mobility_stage_claim_delivery_push(worker);
  IF n<>0 THEN RAISE EXCEPTION 'G12 reclaimed an expired/active-owned offer'; END IF;
  IF public.mobility_stage_ack_delivery_push(worker,expired_offer,'ticket_12345')
  THEN RAISE EXCEPTION 'G12 ACK after expiry cleanup was accepted'; END IF;

  -- Function access must not leak to public/mobile actors.
  IF has_function_privilege('anon','public.mobility_stage_expire_delivery_push_claims()','EXECUTE')
    OR has_function_privilege('authenticated','public.mobility_stage_expire_delivery_push_claims()','EXECUTE')
  THEN RAISE EXCEPTION 'G12 cleanup available to mobile actors'; END IF;
  IF NOT has_function_privilege('service_role',
    'public.mobility_stage_expire_delivery_push_claims()','EXECUTE')
  THEN RAISE EXCEPTION 'G12 cleanup unavailable to trusted service'; END IF;
END $assert$;
