-- G254: private document-reminder claim/ack. Supabase STAGING, NO LIVE.
-- Provider attestation and dispatch gates remain untouched. The G250 hard
-- worker_enabled=false CHECK intentionally makes real claims impossible.
-- Claimed rows are NEVER automatically retried after unknown provider result.
DO $guard$
BEGIN
 IF to_regclass('public.mobility_stage_document_expiry_alert_outbox') IS NULL
 OR to_regclass('public.mobility_stage_document_expiry_scan_checkpoint') IS NULL
 OR to_regclass('public.mobility_stage_driver_document_attestations') IS NULL
 OR to_regprocedure('public.mobility_stage_g251_pending_current_alerts_owner(integer)') IS NULL
 OR (SELECT count(*) FROM auth.users)<>0
 OR (SELECT count(*) FROM public.mobility_stage_document_expiry_alert_outbox)<>0
 THEN RAISE EXCEPTION 'G254 isolated empty STAGING and G251 required'; END IF;
END $guard$;

ALTER TABLE public.mobility_stage_document_expiry_alert_outbox
 ADD COLUMN notification_claim_worker uuid,
 ADD COLUMN notification_claimed_at timestamptz,
 ADD COLUMN provider_ticket_id text,
 ADD COLUMN provider_accepted_at timestamptz,
 ADD CONSTRAINT mobility_stage_g254_claim_both_or_none CHECK(
  (notification_claim_worker IS NULL)=(notification_claimed_at IS NULL)),
 ADD CONSTRAINT mobility_stage_g254_ticket_both_or_none CHECK(
  (provider_ticket_id IS NULL)=(provider_accepted_at IS NULL)),
 ADD CONSTRAINT mobility_stage_g254_ticket_valid CHECK(
  provider_ticket_id IS NULL OR provider_ticket_id ~ '^[A-Za-z0-9_-]{8,120}$'),
 ADD CONSTRAINT mobility_stage_g254_provider_requires_claim CHECK(
  provider_ticket_id IS NULL OR notification_claim_worker IS NOT NULL);
CREATE INDEX mobility_stage_g254_unclaimed_alerts_idx
 ON public.mobility_stage_document_expiry_alert_outbox(id)
 WHERE delivery_state='PENDING' AND notification_claim_worker IS NULL;

-- Claims at most one valid, independently verified, latest document alert.
-- Return no device tokens or personal documentation. A worker is a trusted
-- server identity; no browser and no service_role SQL EXECUTE.
CREATE FUNCTION public.mobility_stage_g254_claim_reminder_owner(
 _worker uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE
 entry public.mobility_stage_document_expiry_alert_outbox%ROWTYPE;
 enabled boolean;
BEGIN
 IF _worker IS NULL THEN RAISE EXCEPTION 'G254 worker UUID required'; END IF;
 SELECT worker_enabled INTO enabled
 FROM public.mobility_stage_document_expiry_scan_checkpoint
 WHERE singleton=true;
 IF enabled IS DISTINCT FROM true THEN
  RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
   'status','DISABLED','qaOnly',true,'productionEnabled',false);
 END IF;

 SELECT o.* INTO entry
 FROM public.mobility_stage_document_expiry_alert_outbox o
 JOIN public.mobility_stage_driver_document_attestations a
  ON a.driver_id=o.driver_id AND a.vehicle_id=o.vehicle_id
  AND a.source_document_id=o.source_document_id AND a.kind=o.kind
  AND a.evidence_revision=o.document_revision AND a.valid_until=o.valid_until
 JOIN public.mobility_stage_driver_documents d
  ON d.id=a.source_document_id AND d.driver_id=a.driver_id
  AND d.kind::text=a.kind
 WHERE o.delivery_state='PENDING' AND o.notification_claim_worker IS NULL
  AND a.attestation_state='verified'
  AND a.verified_at<=pg_catalog.clock_timestamp()
  AND a.authenticity_verified AND a.issuer_verified AND a.malware_scan_passed
  AND (a.kind<>'rostro_selfie' OR (
   a.photo_received AND a.consent_for_face
   AND a.liveness_verified AND a.id_face_match_verified))
  AND d.status='approved' AND d.reviewer_id IS NOT NULL AND d.reviewed_at IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM public.mobility_stage_driver_documents newer
   WHERE newer.driver_id=a.driver_id AND newer.kind=d.kind
    AND (newer.submitted_at,newer.id)>(d.submitted_at,d.id))
  AND ((o.band='EXPIRED' AND a.valid_until<=pg_catalog.clock_timestamp())
   OR (o.band='D01' AND a.valid_until>pg_catalog.clock_timestamp()
    AND a.valid_until<=pg_catalog.clock_timestamp()+interval '1 day')
   OR (o.band='D07' AND a.valid_until>pg_catalog.clock_timestamp()+interval '1 day'
    AND a.valid_until<=pg_catalog.clock_timestamp()+interval '7 days')
   OR (o.band='D15' AND a.valid_until>pg_catalog.clock_timestamp()+interval '7 days'
    AND a.valid_until<=pg_catalog.clock_timestamp()+interval '15 days')
   OR (o.band='D30' AND a.valid_until>pg_catalog.clock_timestamp()+interval '15 days'
    AND a.valid_until<=pg_catalog.clock_timestamp()+interval '30 days'))
 ORDER BY o.id LIMIT 1 FOR UPDATE OF o SKIP LOCKED;
 IF NOT FOUND THEN
  RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
   'status','IDLE','qaOnly',true,'productionEnabled',false);
 END IF;
 UPDATE public.mobility_stage_document_expiry_alert_outbox
 SET notification_claim_worker=_worker,
  notification_claimed_at=pg_catalog.clock_timestamp()
 WHERE id=entry.id AND notification_claim_worker IS NULL
  AND delivery_state='PENDING';
 RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
  'status','CLAIMED','qaOnly',true,'productionEnabled',false,
  'alert',pg_catalog.jsonb_build_object(
  'alertId',entry.id,'eventKey',entry.event_key,
  'driverId',entry.driver_id,'kind',entry.kind,'band',entry.band,
  'documentRevision',entry.document_revision,
  'validUntilMs',(extract(epoch FROM entry.valid_until)*1000)::bigint));
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g254_claim_reminder_owner(uuid)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mobility_stage_g254_claim_still_valid_owner(
 _worker uuid,_alert bigint,_event_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $body$
 SELECT COALESCE(
  (SELECT EXISTS(
   SELECT 1 FROM public.mobility_stage_document_expiry_alert_outbox o
   JOIN public.mobility_stage_driver_document_attestations a
    ON a.driver_id=o.driver_id AND a.vehicle_id=o.vehicle_id
    AND a.source_document_id=o.source_document_id AND a.kind=o.kind
    AND a.evidence_revision=o.document_revision AND a.valid_until=o.valid_until
   JOIN public.mobility_stage_driver_documents d ON d.id=a.source_document_id
   WHERE o.id=_alert AND o.event_key=_event_key
    AND o.notification_claim_worker=_worker
    AND o.notification_claimed_at IS NOT NULL
    AND o.delivery_state='PENDING'
    AND a.attestation_state='verified'
    AND a.verified_at<=pg_catalog.clock_timestamp()
    AND a.authenticity_verified AND a.issuer_verified AND a.malware_scan_passed
    AND (a.kind<>'rostro_selfie' OR
     (a.consent_for_face AND a.photo_received
      AND a.liveness_verified AND a.id_face_match_verified))
    AND d.driver_id=o.driver_id AND d.kind::text=o.kind
    AND d.status='approved' AND d.reviewed_at IS NOT NULL
    AND d.reviewer_id IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM public.mobility_stage_driver_documents newer
     WHERE newer.driver_id=o.driver_id AND newer.kind=d.kind
      AND (newer.submitted_at,newer.id)>(d.submitted_at,d.id))
    AND ((o.band='EXPIRED' AND a.valid_until<=pg_catalog.clock_timestamp())
     OR (o.band='D01' AND a.valid_until>pg_catalog.clock_timestamp()
      AND a.valid_until<=pg_catalog.clock_timestamp()+interval '1 day')
     OR (o.band='D07' AND a.valid_until>pg_catalog.clock_timestamp()+interval '1 day'
      AND a.valid_until<=pg_catalog.clock_timestamp()+interval '7 days')
     OR (o.band='D15' AND a.valid_until>pg_catalog.clock_timestamp()+interval '7 days'
      AND a.valid_until<=pg_catalog.clock_timestamp()+interval '15 days')
     OR (o.band='D30' AND a.valid_until>pg_catalog.clock_timestamp()+interval '15 days'
      AND a.valid_until<=pg_catalog.clock_timestamp()+interval '30 days'))
  ) FROM public.mobility_stage_document_expiry_scan_checkpoint s
   WHERE s.singleton AND s.worker_enabled),false)
$body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g254_claim_still_valid_owner(uuid,bigint,text)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mobility_stage_g254_ack_ticket_owner(
 _worker uuid,_alert bigint,_event_key text,_ticket text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE modified integer;
BEGIN
 IF _worker IS NULL OR _alert IS NULL OR _alert<=0 OR
 _event_key IS NULL OR _ticket IS NULL OR
 _ticket !~ '^[A-Za-z0-9_-]{8,120}$'
 THEN RAISE EXCEPTION 'G254 invalid private processing acknowledgement';END IF;
 UPDATE public.mobility_stage_document_expiry_alert_outbox o
 SET delivery_state='SENT',provider_ticket_id=_ticket,
  provider_accepted_at=pg_catalog.clock_timestamp()
 WHERE o.id=_alert AND o.event_key=_event_key AND
  o.notification_claim_worker=_worker AND
  o.notification_claimed_at IS NOT NULL AND
  o.delivery_state='PENDING' AND o.provider_ticket_id IS NULL
  AND EXISTS(SELECT 1 FROM public.mobility_stage_document_expiry_scan_checkpoint s
   WHERE s.singleton AND s.worker_enabled=true);
 GET DIAGNOSTICS modified=ROW_COUNT;
 -- SENT means accepted by provider, not delivered to a phone:
 -- delivered_at remains NULL until verified provider receipt (not installed).
 RETURN modified=1;
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g254_ack_ticket_owner(uuid,bigint,text,text)
 FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON COLUMN public.mobility_stage_document_expiry_alert_outbox.provider_accepted_at
 IS 'Provider accepted for processing only; no delivery/Driver approval is implied';
