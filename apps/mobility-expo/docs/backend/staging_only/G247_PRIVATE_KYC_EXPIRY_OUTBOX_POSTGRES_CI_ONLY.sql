-- G247: Durable, private, SYNTHETIC Driver KYC expiry outbox in disposable PG16.
-- NO remote Supabase migration, no push provider, no commercial access.
-- Requires independent G17/G42 eight-document attestation and verified renewal.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_kyc_verified_evidence_qa') IS NULL
 OR to_regclass('public.mobility_stage_driver_documents') IS NULL
 OR to_regclass('public.mobility_stage_g247_document_alerts_qa') IS NOT NULL
 THEN RAISE EXCEPTION 'G247 DISPOSABLE PostgreSQL QA ONLY'; END IF;
END $guard$;

CREATE TABLE public.mobility_stage_g247_document_alerts_qa(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_key text NOT NULL UNIQUE CHECK(length(event_key) BETWEEN 40 AND 180),
 driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 vehicle_id uuid NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 source_document_id uuid NOT NULL
  REFERENCES public.mobility_stage_driver_documents(id) ON DELETE RESTRICT,
 evidence_revision bigint NOT NULL CHECK(evidence_revision>0),
 kind text NOT NULL CHECK(kind IN (
  'licencia','identidad_frente','identidad_dorso','cedula_verde',
  'habilitacion','seguro','inspeccion','rostro_selfie')),
 valid_until timestamptz NOT NULL,
 band text NOT NULL CHECK(band IN ('D30','D15','D07','D01','EXPIRED')),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 delivery_state text NOT NULL DEFAULT 'PENDING'
  CHECK(delivery_state IN ('PENDING','SENT','SUPPRESSED')),
 UNIQUE(source_document_id,evidence_revision,valid_until,band)
);
CREATE INDEX mobility_stage_g247_alerts_driver_idx
 ON public.mobility_stage_g247_document_alerts_qa(driver_id,created_at DESC);
CREATE INDEX mobility_stage_g247_alerts_state_idx
 ON public.mobility_stage_g247_document_alerts_qa(delivery_state,id)
 WHERE delivery_state='PENDING';
ALTER TABLE public.mobility_stage_g247_document_alerts_qa ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g247_document_alerts_qa
 FROM PUBLIC,anon,authenticated,service_role;

-- Unlike a mere UI warning, an outbox survives the handset being offline.
-- Owner-only CI SQL: no JWT, browser, service_role or Admin direct grant.
-- Keyset pages cover arbitrarily many independently verified documents.
CREATE FUNCTION public.mobility_stage_g247_scan_expiry_owner_qa(
 _after_document uuid DEFAULT NULL,_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE
 item record;
 at_time timestamptz:=pg_catalog.clock_timestamp();
 processed integer:=0;
 inserted_count integer:=0;
 changed integer:=0;
 duplicate_count integer:=0;
 last_id uuid:=NULL;
 has_more boolean:=false;
 band_name text;
 item_key text;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _limit IS NULL OR _limit<1 OR _limit>50
 THEN RAISE EXCEPTION 'G247 private bounded CI scan only' USING ERRCODE='P7471'; END IF;
 FOR item IN
  SELECT e.driver_id,e.vehicle_id,e.source_document_id,e.kind,
   e.valid_until,e.evidence_revision
  FROM public.mobility_stage_kyc_verified_evidence_qa e
  JOIN public.mobility_stage_driver_documents source
   ON source.id=e.source_document_id
  WHERE (_after_document IS NULL OR e.source_document_id>_after_document)
   AND e.valid_until<=at_time+interval '30 days'
   AND e.verified_by='QA_INDEPENDENT_ATTESTOR_NO_MEDIA'
   AND e.authenticity_verified AND e.issuer_verified AND e.malware_scan_passed
   AND e.evidence_revision>0
   AND (e.kind<>'rostro_selfie' OR (e.consent_for_face
    AND e.photo_received AND e.liveness_verified
    AND e.id_face_match_verified))
   AND source.driver_id=e.driver_id AND source.kind::text=e.kind
   AND source.status<>'rejected'
   AND NOT EXISTS(
    SELECT 1 FROM public.mobility_stage_driver_documents newer
    WHERE newer.driver_id=e.driver_id AND newer.kind=source.kind
     AND (newer.submitted_at,newer.id)>(source.submitted_at,source.id))
  ORDER BY e.source_document_id
  LIMIT _limit+1
 LOOP
  IF processed=_limit THEN has_more:=true;EXIT;END IF;
  processed:=processed+1;
  last_id:=item.source_document_id;
  band_name:=CASE
   WHEN item.valid_until<=at_time THEN 'EXPIRED'
   WHEN item.valid_until<=at_time+interval '1 day' THEN 'D01'
   WHEN item.valid_until<=at_time+interval '7 days' THEN 'D07'
   WHEN item.valid_until<=at_time+interval '15 days' THEN 'D15'
   ELSE 'D30' END;
  item_key:='G247:'||item.source_document_id::text||':'||
   item.evidence_revision::text||':'||
   (extract(epoch FROM item.valid_until)*1000)::bigint::text||
   ':'||band_name;
  INSERT INTO public.mobility_stage_g247_document_alerts_qa(
   event_key,driver_id,vehicle_id,source_document_id,evidence_revision,
   kind,valid_until,band)
  VALUES(item_key,item.driver_id,item.vehicle_id,item.source_document_id,
   item.evidence_revision,item.kind,item.valid_until,band_name)
  ON CONFLICT (event_key) DO NOTHING;
  GET DIAGNOSTICS changed=ROW_COUNT;
  inserted_count:=inserted_count+changed;
  duplicate_count:=duplicate_count+1-changed;
 END LOOP;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','processed',processed,
  'inserted',inserted_count,'duplicate',duplicate_count,
  'nextCursor',CASE WHEN has_more THEN last_id::text ELSE NULL END,
  'qaOnly',true,'productionEnabled',false,'driverDispatchAuthorized',false);
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g247_scan_expiry_owner_qa(
 uuid,integer) FROM PUBLIC,anon,authenticated,service_role;

-- Reads only alerts still backed by the SAME current independent attestation.
-- Renewal, replacement or revoked proof suppresses stale notification delivery.
-- Not a push sender; notification transport will consume this after staging gates.
CREATE FUNCTION public.mobility_stage_g247_current_pending_owner_qa(
 _limit integer DEFAULT 50)
RETURNS TABLE(event_key text,driver_id uuid,kind text,band text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $fn$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _limit IS NULL OR _limit<1 OR _limit>50
 THEN RAISE EXCEPTION 'G247 private delivery gate only' USING ERRCODE='P7472';END IF;
 RETURN QUERY
  SELECT alert.event_key,alert.driver_id,alert.kind,alert.band
  FROM public.mobility_stage_g247_document_alerts_qa alert
  JOIN public.mobility_stage_kyc_verified_evidence_qa e
   ON e.driver_id=alert.driver_id
   AND e.vehicle_id=alert.vehicle_id AND e.kind=alert.kind
   AND e.source_document_id=alert.source_document_id
   AND e.evidence_revision=alert.evidence_revision
   AND e.valid_until=alert.valid_until
  JOIN public.mobility_stage_driver_documents source
   ON source.id=e.source_document_id
  WHERE alert.delivery_state='PENDING'
   AND e.verified_by='QA_INDEPENDENT_ATTESTOR_NO_MEDIA'
   AND e.authenticity_verified AND e.issuer_verified AND e.malware_scan_passed
   AND (e.kind<>'rostro_selfie' OR (e.consent_for_face AND
    e.photo_received AND e.liveness_verified AND e.id_face_match_verified))
   AND source.driver_id=e.driver_id AND source.kind::text=e.kind
   AND source.status<>'rejected'
   AND NOT EXISTS(SELECT 1 FROM public.mobility_stage_driver_documents newer
    WHERE newer.driver_id=e.driver_id AND newer.kind=source.kind
     AND (newer.submitted_at,newer.id)>(source.submitted_at,source.id))
   AND ((alert.band='EXPIRED' AND e.valid_until<=pg_catalog.clock_timestamp())
    OR (alert.band='D01' AND e.valid_until>pg_catalog.clock_timestamp()
      AND e.valid_until<=pg_catalog.clock_timestamp()+interval '1 day')
    OR (alert.band='D07'
      AND e.valid_until>pg_catalog.clock_timestamp()+interval '1 day'
      AND e.valid_until<=pg_catalog.clock_timestamp()+interval '7 days')
    OR (alert.band='D15'
      AND e.valid_until>pg_catalog.clock_timestamp()+interval '7 days'
      AND e.valid_until<=pg_catalog.clock_timestamp()+interval '15 days')
    OR (alert.band='D30'
      AND e.valid_until>pg_catalog.clock_timestamp()+interval '15 days'
      AND e.valid_until<=pg_catalog.clock_timestamp()+interval '30 days'))
  ORDER BY alert.id
  LIMIT _limit;
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_g247_current_pending_owner_qa(
 integer) FROM PUBLIC,anon,authenticated,service_role;
