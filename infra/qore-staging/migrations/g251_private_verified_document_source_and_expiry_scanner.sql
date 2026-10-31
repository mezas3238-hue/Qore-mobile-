
-- G251: independent KYC evidence + owner-only expiry scanner for external STAGING.
-- Requires G243/G250. NO production, no active scheduler, no public grants.
-- This is NOT an attestation provider: until trusted issuer/biometric verification
-- is separately certified, this table stays empty and cannot authorize Driver.
DO $pre$
BEGIN
 IF to_regclass('public.mobility_stage_driver_documents') IS NULL
 OR to_regclass('public.mobility_stage_document_expiry_alert_outbox') IS NULL
 OR to_regclass('public.mobility_stage_document_expiry_scan_checkpoint') IS NULL
 OR to_regclass('public.mobility_stage_driver_document_attestations') IS NOT NULL
 OR (SELECT count(*) FROM auth.users)<>0
 OR (SELECT count(*) FROM public.mobility_stage_driver_documents)<>0
 THEN RAISE EXCEPTION 'G251 requires empty isolated QORE STAGING';END IF;
END $pre$;

CREATE TABLE public.mobility_stage_driver_document_attestations (
 driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 vehicle_id uuid NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 source_document_id uuid NOT NULL UNIQUE
  REFERENCES public.mobility_stage_driver_documents(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN (
  'licencia','identidad_frente','identidad_dorso','cedula_verde',
  'habilitacion','seguro','inspeccion','rostro_selfie')),
 evidence_revision bigint NOT NULL CHECK(evidence_revision>0),
 verified_at timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 attestation_state text NOT NULL DEFAULT 'revoked'
  CHECK(attestation_state IN ('verified','revoked')),
 evidence_origin text NOT NULL CHECK(evidence_origin='INDEPENDENT_ATTESTOR'),
 provider_receipt_sha256 text NOT NULL CHECK(
  provider_receipt_sha256 ~ '^[0-9a-f]{64}$'),
 authenticity_verified boolean NOT NULL DEFAULT false,
 issuer_verified boolean NOT NULL DEFAULT false,
 malware_scan_passed boolean NOT NULL DEFAULT false,
 consent_for_face boolean NOT NULL DEFAULT false,
 photo_received boolean NOT NULL DEFAULT false,
 liveness_verified boolean NOT NULL DEFAULT false,
 id_face_match_verified boolean NOT NULL DEFAULT false,
 PRIMARY KEY(driver_id,vehicle_id,kind),
 CHECK(valid_until>verified_at),
 CHECK(kind='rostro_selfie' OR
  (NOT consent_for_face AND NOT photo_received AND
   NOT liveness_verified AND NOT id_face_match_verified))
);
CREATE INDEX mobility_stage_driver_attestation_validity_idx
 ON public.mobility_stage_driver_document_attestations(valid_until,source_document_id);
ALTER TABLE public.mobility_stage_driver_document_attestations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_driver_document_attestations
 FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY qore_attestation_no_client_read
 ON public.mobility_stage_driver_document_attestations
 FOR SELECT TO authenticated USING(false);

COMMENT ON TABLE public.mobility_stage_driver_document_attestations IS
 'Empty by default. Owner-only independently verified evidence; upload or document approval alone never suffices; NO automatic account activation.';

-- The earlier G250 worker_enabled CHECK(false) is preserved. This function
-- cannot run in STAGING until an Owner-reviewed later migration separately
-- enables the worker after a real issuer verifier and operational gates.
CREATE FUNCTION public.mobility_stage_g251_document_expiry_batch_owner(
 _limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER
 SET search_path=''
AS $body$
DECLARE
 st public.mobility_stage_document_expiry_scan_checkpoint%ROWTYPE;
 item record;
 checked integer:=0;
 written integer:=0;
 dupes integer:=0;
 change_count integer;
 next_id uuid;
 has_more boolean:=false;
 band_code text;
 key text;
 now_at timestamptz:=pg_catalog.clock_timestamp();
BEGIN
 IF _limit IS NULL OR _limit<1 OR _limit>50
 THEN RAISE EXCEPTION 'G251 bounded private scan only' USING ERRCODE='P7511';END IF;
 SELECT * INTO st FROM public.mobility_stage_document_expiry_scan_checkpoint
 WHERE singleton=true FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN
  IF NOT EXISTS(SELECT 1 FROM public.mobility_stage_document_expiry_scan_checkpoint WHERE singleton=true)
  THEN RAISE EXCEPTION 'G251 missing durable checkpoint' USING ERRCODE='P7512';END IF;
  RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY','status','BUSY',
   'productionEnabled',false,'qaOnly',true,'driverDispatchAuthorized',false);
 END IF;
 IF NOT st.worker_enabled THEN
  RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY','status','DISABLED',
   'productionEnabled',false,'qaOnly',true,'driverDispatchAuthorized',false);
 END IF;
 FOR item IN
  SELECT e.driver_id,e.vehicle_id,e.source_document_id,e.kind,
   e.evidence_revision,e.valid_until
  FROM public.mobility_stage_driver_document_attestations e
  JOIN public.mobility_stage_driver_documents doc
   ON doc.id=e.source_document_id AND doc.driver_id=e.driver_id
   AND doc.kind::text=e.kind
  JOIN public.mobility_vehicles v
   ON v.id=e.vehicle_id AND v.driver_id=e.driver_id
  WHERE (st.resume_document_id IS NULL OR e.source_document_id>st.resume_document_id)
   AND e.attestation_state='verified'
   AND e.verified_at<=now_at
   AND e.valid_until<=now_at+interval '30 days'
   AND e.authenticity_verified AND e.issuer_verified AND e.malware_scan_passed
   AND (e.kind<>'rostro_selfie' OR (e.consent_for_face AND
     e.photo_received AND e.liveness_verified AND e.id_face_match_verified))
   AND doc.status='approved' AND doc.reviewed_at IS NOT NULL
   AND doc.reviewer_id IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.mobility_stage_driver_documents newer
    WHERE newer.driver_id=e.driver_id AND newer.kind=doc.kind
    AND (newer.submitted_at,newer.id)>(doc.submitted_at,doc.id))
  ORDER BY e.source_document_id
  LIMIT _limit+1
 LOOP
  IF checked=_limit THEN has_more:=true;EXIT;END IF;
  checked:=checked+1;next_id:=item.source_document_id;
  band_code:=CASE
   WHEN item.valid_until<=now_at THEN 'EXPIRED'
   WHEN item.valid_until<=now_at+interval '1 day' THEN 'D01'
   WHEN item.valid_until<=now_at+interval '7 days' THEN 'D07'
   WHEN item.valid_until<=now_at+interval '15 days' THEN 'D15'
   ELSE 'D30' END;
  key:='G251:'||item.source_document_id::text||':'||
   item.evidence_revision::text||':'||
   (pg_catalog.extract(epoch FROM item.valid_until)*1000)::bigint::text||
   ':'||band_code;
  INSERT INTO public.mobility_stage_document_expiry_alert_outbox
  (event_key,driver_id,vehicle_id,source_document_id,document_revision,
   kind,valid_until,band)
  VALUES(key,item.driver_id,item.vehicle_id,item.source_document_id,
   item.evidence_revision,item.kind,item.valid_until,band_code)
  ON CONFLICT(event_key) DO NOTHING;
  GET DIAGNOSTICS change_count=ROW_COUNT;
  written:=written+change_count;dupes:=dupes+1-change_count;
 END LOOP;
 UPDATE public.mobility_stage_document_expiry_scan_checkpoint
 SET resume_document_id=CASE WHEN has_more THEN next_id ELSE NULL END,
  revision=st.revision+1,last_processed_at=pg_catalog.clock_timestamp(),
  last_completed_at=CASE WHEN has_more THEN st.last_completed_at
   ELSE pg_catalog.clock_timestamp() END,
  updated_at=pg_catalog.clock_timestamp()
 WHERE singleton=true;
 RETURN pg_catalog.jsonb_build_object('mode','STAGING_DEMO_ONLY',
  'status','PROCESSED','processed',checked,'inserted',written,
  'duplicate',dupes,'cycleCompleted',NOT has_more,
  'resumeCursor',CASE WHEN has_more THEN next_id::text ELSE NULL END,
  'checkpointRevision',st.revision+1,
  'productionEnabled',false,'qaOnly',true,'driverDispatchAuthorized',false);
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g251_document_expiry_batch_owner(integer)
 FROM PUBLIC,anon,authenticated,service_role;

-- A private read for future trusted notifier; never exposes document images.
-- Alerts are revalidated against newest independently attested and approved
-- document. Revoked/updated evidence cannot result in a stale push.
CREATE FUNCTION public.mobility_stage_g251_pending_current_alerts_owner(
 _limit integer DEFAULT 50)
RETURNS TABLE(event_key text,driver_id uuid,kind text,band text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $body$
BEGIN
 IF _limit IS NULL OR _limit<1 OR _limit>50
 THEN RAISE EXCEPTION 'G251 private read only' USING ERRCODE='P7513';END IF;
 RETURN QUERY SELECT o.event_key,o.driver_id,o.kind,o.band
 FROM public.mobility_stage_document_expiry_alert_outbox o
 JOIN public.mobility_stage_driver_document_attestations e
  ON e.driver_id=o.driver_id AND e.vehicle_id=o.vehicle_id
  AND e.source_document_id=o.source_document_id AND e.kind=o.kind
  AND e.evidence_revision=o.document_revision AND e.valid_until=o.valid_until
 JOIN public.mobility_stage_driver_documents doc
  ON doc.id=e.source_document_id AND doc.driver_id=e.driver_id
  AND doc.kind::text=e.kind
 WHERE o.delivery_state='PENDING' AND e.attestation_state='verified'
  AND e.authenticity_verified AND e.issuer_verified AND e.malware_scan_passed
  AND e.verified_at<=pg_catalog.clock_timestamp()
  AND (e.kind<>'rostro_selfie' OR (e.consent_for_face AND
   e.photo_received AND e.liveness_verified AND e.id_face_match_verified))
  AND doc.status='approved' AND doc.reviewer_id IS NOT NULL
  AND doc.reviewed_at IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM public.mobility_stage_driver_documents newer
   WHERE newer.driver_id=e.driver_id AND newer.kind=doc.kind
    AND (newer.submitted_at,newer.id)>(doc.submitted_at,doc.id))
  AND ((o.band='EXPIRED' AND e.valid_until<=pg_catalog.clock_timestamp())
   OR (o.band='D01' AND e.valid_until>pg_catalog.clock_timestamp()
    AND e.valid_until<=pg_catalog.clock_timestamp()+interval '1 day')
   OR (o.band='D07' AND e.valid_until>pg_catalog.clock_timestamp()+interval '1 day'
    AND e.valid_until<=pg_catalog.clock_timestamp()+interval '7 days')
   OR (o.band='D15' AND e.valid_until>pg_catalog.clock_timestamp()+interval '7 days'
    AND e.valid_until<=pg_catalog.clock_timestamp()+interval '15 days')
   OR (o.band='D30' AND e.valid_until>pg_catalog.clock_timestamp()+interval '15 days'
    AND e.valid_until<=pg_catalog.clock_timestamp()+interval '30 days'))
 ORDER BY o.id LIMIT _limit;
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g251_pending_current_alerts_owner(integer)
 FROM PUBLIC,anon,authenticated,service_role;
