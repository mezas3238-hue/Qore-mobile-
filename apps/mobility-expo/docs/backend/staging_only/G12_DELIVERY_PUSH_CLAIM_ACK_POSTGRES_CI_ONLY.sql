-- G12: private delivery push outbox, POSTGRES 16 DISPOSABLE CI ONLY.
-- Apply AFTER G10. NEVER remote / LIVE. Claim is at-most-once; no automatic retry. Expired claims may be cleared safely.
BEGIN;
ALTER TABLE public.mobility_stage_delivery_offer_outbox
 ADD COLUMN claimed_at timestamptz,
 ADD COLUMN claimed_by uuid,
 ADD COLUMN provider_ticket_id text,
 ADD CONSTRAINT mobility_stage_delivery_push_claim_pair
 CHECK ((claimed_at IS NULL AND claimed_by IS NULL) OR
        (claimed_at IS NOT NULL AND claimed_by IS NOT NULL)),
 ADD CONSTRAINT mobility_stage_delivery_push_ack_claim
 CHECK (accepted_for_processing_at IS NULL OR claimed_at IS NOT NULL),
 ADD CONSTRAINT mobility_stage_delivery_push_ticket_format
 CHECK (provider_ticket_id IS NULL OR
   (char_length(provider_ticket_id) BETWEEN 8 AND 120
    AND provider_ticket_id ~ '^[A-Za-z0-9_-]+$')),
 ADD CONSTRAINT mobility_stage_delivery_push_ack_ticket_pair
 CHECK ((accepted_for_processing_at IS NULL AND provider_ticket_id IS NULL)
    OR (accepted_for_processing_at IS NOT NULL AND provider_ticket_id IS NOT NULL));
CREATE INDEX mobility_stage_delivery_push_unclaimed_idx
 ON public.mobility_stage_delivery_offer_outbox(created_at,offer_id)
 WHERE claimed_at IS NULL;
CREATE FUNCTION public.mobility_stage_claim_delivery_push(_worker_id uuid)
 RETURNS TABLE(offer_id uuid,courier_id uuid,delivery_id uuid,expires_at timestamptz)
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
  WHERE o.claimed_at IS NULL AND o.accepted_for_processing_at IS NULL
   AND f.status='offered' AND d.status='requested'
   AND f.courier_id=o.courier_id
   AND f.expires_at>pg_catalog.clock_timestamp()+interval '3 seconds'
  ORDER BY o.created_at,o.offer_id
  FOR UPDATE OF o SKIP LOCKED LIMIT 1
 ), claimed AS (
  UPDATE public.mobility_stage_delivery_offer_outbox o
  SET claimed_at=pg_catalog.clock_timestamp(),claimed_by=_worker_id
  FROM candidate c
  WHERE o.offer_id=c.offer_id AND o.claimed_at IS NULL
  RETURNING o.offer_id,o.courier_id
 )
 SELECT c.offer_id,c.courier_id,f.delivery_id,f.expires_at
 FROM claimed c JOIN public.mobility_stage_delivery_offers f ON f.id=c.offer_id;
END $fn$;
CREATE FUNCTION public.mobility_stage_ack_delivery_push(
 _worker_id uuid,_offer_id uuid,_ticket_id text
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE was_ack boolean;
BEGIN
 IF _worker_id IS NULL OR _offer_id IS NULL OR _ticket_id IS NULL
 OR char_length(_ticket_id) NOT BETWEEN 8 AND 120
 OR _ticket_id !~ '^[A-Za-z0-9_-]+$'
 THEN RAISE EXCEPTION 'Invalid private delivery provider ticket'; END IF;
 UPDATE public.mobility_stage_delivery_offer_outbox o
 SET accepted_for_processing_at=pg_catalog.clock_timestamp(),
     provider_ticket_id=_ticket_id
 WHERE o.offer_id=_offer_id AND o.claimed_by=_worker_id
  AND o.claimed_at IS NOT NULL AND o.accepted_for_processing_at IS NULL
 RETURNING true INTO was_ack;
 RETURN COALESCE(was_ack,false);
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_claim_delivery_push(uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_ack_delivery_push(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_claim_delivery_push(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_ack_delivery_push(uuid,uuid,text) TO service_role;

-- Recovery is deliberately limited to expired offers: never resend an active offer
-- after an ambiguous provider outcome without verified provider-side deduplication.
CREATE FUNCTION public.mobility_stage_expire_delivery_push_claims()
 RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE affected integer;
BEGIN
 -- Bounded cleanup must never wait for a concurrent worker's row lock.
 WITH expired AS (
  SELECT o.offer_id
  FROM public.mobility_stage_delivery_offer_outbox o
  JOIN public.mobility_stage_delivery_offers f ON f.id=o.offer_id
  WHERE o.claimed_at IS NOT NULL AND o.accepted_for_processing_at IS NULL
    AND f.expires_at<=pg_catalog.clock_timestamp()
  ORDER BY o.claimed_at,o.offer_id
  FOR UPDATE OF o SKIP LOCKED LIMIT 100
 )
 UPDATE public.mobility_stage_delivery_offer_outbox o
 SET claimed_at=NULL,claimed_by=NULL
 FROM expired e
 WHERE o.offer_id=e.offer_id
   AND o.accepted_for_processing_at IS NULL
   AND o.claimed_at IS NOT NULL;
 GET DIAGNOSTICS affected = ROW_COUNT;
 RETURN affected;
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_expire_delivery_push_claims()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_expire_delivery_push_claims() TO service_role;
COMMIT;
