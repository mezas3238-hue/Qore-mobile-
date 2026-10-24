
-- QORE G4: CI-only private push lease-less, at-most-once claim. NEVER REMOTE.
BEGIN;
ALTER TABLE public.mobility_stage_auto_demo_push_outbox
 ADD COLUMN claimed_at timestamptz,
 ADD COLUMN claimed_by uuid,
 ADD COLUMN provider_ticket_id text,
 ADD CONSTRAINT mobility_stage_push_claim_pair
  CHECK ((claimed_at IS NULL AND claimed_by IS NULL) OR (claimed_at IS NOT NULL AND claimed_by IS NOT NULL)),
 ADD CONSTRAINT mobility_stage_push_ticket_format
  CHECK (provider_ticket_id IS NULL OR
   (char_length(provider_ticket_id) BETWEEN 8 AND 120 AND provider_ticket_id ~ '^[A-Za-z0-9_-]+$')),
 ADD CONSTRAINT mobility_stage_push_ack_requires_claim
  CHECK (accepted_for_processing_at IS NULL OR claimed_at IS NOT NULL);
CREATE INDEX mobility_stage_push_unclaimed_idx
 ON public.mobility_stage_auto_demo_push_outbox(created_at,offer_id)
 WHERE claimed_at IS NULL;

CREATE FUNCTION public.mobility_stage_claim_auto_demo_push(_worker_id uuid)
 RETURNS TABLE(offer_id uuid,driver_id uuid,trip_id uuid,expires_at timestamptz)
 LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
BEGIN
 IF _worker_id IS NULL THEN RAISE EXCEPTION 'Server worker required'; END IF;
 RETURN QUERY
 WITH candidate AS (
  SELECT o.offer_id
  FROM public.mobility_stage_auto_demo_push_outbox o
  JOIN public.mobility_stage_auto_demo_offers f ON f.id=o.offer_id
  JOIN public.mobility_stage_auto_demo_trips t ON t.id=f.trip_id
  WHERE o.claimed_at IS NULL AND o.accepted_for_processing_at IS NULL
   AND f.status='offered' AND t.status='searching'
   AND f.driver_id=o.driver_id
   AND f.expires_at>pg_catalog.clock_timestamp()+interval '3 seconds'
  ORDER BY o.created_at,o.offer_id
  FOR UPDATE OF o SKIP LOCKED LIMIT 1
 ), claimed AS (
  UPDATE public.mobility_stage_auto_demo_push_outbox o
  SET claimed_at=pg_catalog.clock_timestamp(),claimed_by=_worker_id
  FROM candidate c
  WHERE o.offer_id=c.offer_id AND o.claimed_at IS NULL
  RETURNING o.offer_id,o.driver_id
 )
 SELECT c.offer_id,c.driver_id,f.trip_id,f.expires_at
 FROM claimed c JOIN public.mobility_stage_auto_demo_offers f ON f.id=c.offer_id;
END $fn$;
CREATE FUNCTION public.mobility_stage_ack_auto_demo_push(
 _worker_id uuid,_offer_id uuid,_ticket_id text
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE was_ack boolean;
BEGIN
 IF _worker_id IS NULL OR _offer_id IS NULL OR _ticket_id IS NULL
 OR char_length(_ticket_id) NOT BETWEEN 8 AND 120
 OR _ticket_id !~ '^[A-Za-z0-9_-]+$'
 THEN RAISE EXCEPTION 'Invalid private processing ticket'; END IF;
 UPDATE public.mobility_stage_auto_demo_push_outbox o
 SET accepted_for_processing_at=pg_catalog.clock_timestamp(),
  provider_ticket_id=_ticket_id
 WHERE o.offer_id=_offer_id AND o.claimed_by=_worker_id
  AND o.claimed_at IS NOT NULL AND o.accepted_for_processing_at IS NULL
 RETURNING true INTO was_ack;
 RETURN COALESCE(was_ack,false);
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_claim_auto_demo_push(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_claim_auto_demo_push(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_ack_auto_demo_push(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_ack_auto_demo_push(uuid,uuid,text) TO service_role;
COMMIT;
