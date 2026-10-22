-- G13 staged fenced push protocol. POSTGRESQL 16 DISPOSABLE CI ONLY; NEVER REMOTE/LIVE.
-- Apply AFTER G12. Fencing prevents stale CLAIMED workers from starting a send.
-- SENDING is deliberately NOT reclaimable (ambiguous provider outcome -> poll/manual reconciliation).
-- No promise of provider or device delivery. Never retry an ambiguous send automatically.
BEGIN;

ALTER TABLE public.mobility_stage_delivery_offer_outbox
 ADD COLUMN claim_nonce uuid,
 ADD COLUMN send_started_at timestamptz;

-- Fail-closed upgrade: legacy G12 claims may already have contacted the provider.
-- Classify ALL old claims as possibly sending; do not silently resurrect them.
UPDATE public.mobility_stage_delivery_offer_outbox
 SET claim_nonce=pg_catalog.gen_random_uuid(),send_started_at=claimed_at
 WHERE claimed_at IS NOT NULL;

ALTER TABLE public.mobility_stage_delivery_offer_outbox
 ADD CONSTRAINT mobility_stage_delivery_push_fenced_pair
 CHECK (
  (claimed_at IS NULL AND claimed_by IS NULL AND claim_nonce IS NULL AND send_started_at IS NULL)
  OR (claimed_at IS NOT NULL AND claimed_by IS NOT NULL AND claim_nonce IS NOT NULL
      AND (send_started_at IS NULL OR send_started_at>=claimed_at))
 );

-- Prevent legacy G12 worker from bypassing fencing once G13 has been installed.
REVOKE EXECUTE ON FUNCTION public.mobility_stage_claim_delivery_push(uuid) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.mobility_stage_ack_delivery_push(uuid,uuid,text) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.mobility_stage_expire_delivery_push_claims() FROM service_role;
CREATE INDEX mobility_stage_delivery_push_recoverable_idx
 ON public.mobility_stage_delivery_offer_outbox(claimed_at,offer_id)
 WHERE accepted_for_processing_at IS NULL AND send_started_at IS NULL;

CREATE FUNCTION public.mobility_stage_claim_delivery_push_v2(_worker_id uuid)
 RETURNS TABLE(offer_id uuid,courier_id uuid,delivery_id uuid,
               expires_at timestamptz,claim_nonce uuid)
 LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
BEGIN
 IF _worker_id IS NULL THEN RAISE EXCEPTION 'Worker required'; END IF;
 RETURN QUERY
 WITH candidate AS (
  SELECT o.offer_id
  FROM public.mobility_stage_delivery_offer_outbox o
  JOIN public.mobility_stage_delivery_offers f ON f.id=o.offer_id
  JOIN public.mobility_stage_deliveries d ON d.id=f.delivery_id
  WHERE o.accepted_for_processing_at IS NULL
   AND o.send_started_at IS NULL
   AND (o.claimed_at IS NULL OR
     o.claimed_at<=pg_catalog.clock_timestamp()-interval '12 seconds')
   AND f.status='offered' AND d.status='requested'
   AND f.courier_id=o.courier_id
   AND f.expires_at>pg_catalog.clock_timestamp()+interval '3 seconds'
  ORDER BY o.created_at,o.offer_id
  FOR UPDATE OF o SKIP LOCKED LIMIT 1
 ), claimed AS (
  UPDATE public.mobility_stage_delivery_offer_outbox o
  SET claimed_at=pg_catalog.clock_timestamp(),claimed_by=_worker_id,
      claim_nonce=pg_catalog.gen_random_uuid()
  FROM candidate c
  WHERE o.offer_id=c.offer_id
    AND o.send_started_at IS NULL AND o.accepted_for_processing_at IS NULL
  RETURNING o.offer_id,o.courier_id,o.claim_nonce
 )
 SELECT c.offer_id,c.courier_id,f.delivery_id,f.expires_at,c.claim_nonce
 FROM claimed c JOIN public.mobility_stage_delivery_offers f ON f.id=c.offer_id;
END $fn$;

-- Atomic permission to begin a provider call. An old claim nonce cannot prepare.
CREATE FUNCTION public.mobility_stage_begin_delivery_push_v2(
 _worker_id uuid,_offer_id uuid,_claim_nonce uuid
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE changed boolean;
BEGIN
 IF _worker_id IS NULL OR _offer_id IS NULL OR _claim_nonce IS NULL
 THEN RAISE EXCEPTION 'Invalid fenced send preparation'; END IF;
 UPDATE public.mobility_stage_delivery_offer_outbox o
 SET send_started_at=pg_catalog.clock_timestamp()
 FROM public.mobility_stage_delivery_offers f,
      public.mobility_stage_deliveries d
 WHERE o.offer_id=_offer_id AND f.id=o.offer_id AND d.id=f.delivery_id
   AND f.status='offered' AND d.status='requested'
   AND f.courier_id=o.courier_id
   AND f.expires_at>pg_catalog.clock_timestamp()+interval '3 seconds'
   AND o.claimed_by=_worker_id AND o.claim_nonce=_claim_nonce
   AND o.claimed_at>pg_catalog.clock_timestamp()-interval '12 seconds'
   AND o.send_started_at IS NULL AND o.accepted_for_processing_at IS NULL
 RETURNING true INTO changed;
 RETURN COALESCE(changed,false);
END $fn$;

CREATE FUNCTION public.mobility_stage_ack_delivery_push_v2(
 _worker_id uuid,_offer_id uuid,_claim_nonce uuid,_ticket_id text
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE changed boolean;
BEGIN
 IF _worker_id IS NULL OR _offer_id IS NULL OR _claim_nonce IS NULL
 OR _ticket_id IS NULL OR char_length(_ticket_id) NOT BETWEEN 8 AND 120
 OR _ticket_id !~ '^[A-Za-z0-9_-]+$'
 THEN RAISE EXCEPTION 'Invalid fenced provider ticket'; END IF;
 UPDATE public.mobility_stage_delivery_offer_outbox o
 SET accepted_for_processing_at=pg_catalog.clock_timestamp(),
     provider_ticket_id=_ticket_id
 WHERE o.offer_id=_offer_id AND o.claimed_by=_worker_id
   AND o.claim_nonce=_claim_nonce AND o.send_started_at IS NOT NULL
   AND o.accepted_for_processing_at IS NULL
 RETURNING true INTO changed;
 RETURN COALESCE(changed,false);
END $fn$;

-- Safe cleanup may clear expired claims only BEFORE begin/send.
-- Prepared rows are intentionally retained for support reconciliation.
CREATE OR REPLACE FUNCTION public.mobility_stage_expire_delivery_push_claims_v2()
 RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE affected integer;
BEGIN
 WITH expired AS (
  SELECT o.offer_id
  FROM public.mobility_stage_delivery_offer_outbox o
  JOIN public.mobility_stage_delivery_offers f ON f.id=o.offer_id
  WHERE o.claimed_at IS NOT NULL AND o.send_started_at IS NULL
    AND o.accepted_for_processing_at IS NULL
    AND f.expires_at<=pg_catalog.clock_timestamp()
  ORDER BY o.claimed_at,o.offer_id
  FOR UPDATE OF o SKIP LOCKED LIMIT 100
 )
 UPDATE public.mobility_stage_delivery_offer_outbox o
 SET claimed_at=NULL,claimed_by=NULL,claim_nonce=NULL
 FROM expired e
 WHERE o.offer_id=e.offer_id AND o.send_started_at IS NULL
   AND o.accepted_for_processing_at IS NULL;
 GET DIAGNOSTICS affected = ROW_COUNT;
 RETURN affected;
END $fn$;

REVOKE ALL ON FUNCTION public.mobility_stage_claim_delivery_push_v2(uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_begin_delivery_push_v2(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_ack_delivery_push_v2(uuid,uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_expire_delivery_push_claims_v2()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_claim_delivery_push_v2(uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_begin_delivery_push_v2(uuid,uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_ack_delivery_push_v2(uuid,uuid,uuid,text)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_expire_delivery_push_claims_v2()
 TO service_role;
COMMIT;
