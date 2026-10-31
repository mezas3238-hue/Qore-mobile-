
-- G253: private backend-only Admin compliance alerts. Requires STAGING G251.
-- No Data API grants, no admin write/approval, and never overrides automatic dispatch.
-- IdP + AAL2 + revocation MUST be verified by the trusted G252 HTTP gateway.
DO $gate$
BEGIN
 IF to_regclass('public.mobility_stage_driver_document_attestations') IS NULL
 OR to_regclass('public.mobility_stage_backoffice_roles') IS NULL
 OR to_regclass('public.mobility_stage_document_expiry_alert_outbox') IS NULL
 OR to_regprocedure('public.mobility_stage_g251_pending_current_alerts_owner(integer)') IS NULL
 OR to_regprocedure('public.mobility_stage_g253_admin_document_alert_page_owner(uuid)') IS NOT NULL
 THEN RAISE EXCEPTION 'G253 requires private staging attestation and backoffice';END IF;
END $gate$;

CREATE FUNCTION public.mobility_stage_g253_admin_document_alert_page_owner(
 _admin uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE
 item record;
 collected jsonb:='[]'::jsonb;
 observed_at timestamptz:=pg_catalog.clock_timestamp();
 n integer:=0;
 more boolean:=false;
BEGIN
 IF _admin IS NULL OR
  (SELECT count(*) FROM public.user_roles r WHERE r.user_id=_admin)<>1
  OR NOT EXISTS(SELECT 1 FROM public.user_roles r
   WHERE r.user_id=_admin AND r.role='admin'::public.app_role)
  OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_backoffice_roles b
   WHERE b.user_id=_admin AND b.role='admin' AND b.status='active'
    AND b.approved_by<>_admin AND b.approved_at IS NOT NULL)
 THEN RAISE EXCEPTION 'G253 active exclusive Admin authority required'
 USING ERRCODE='P7531';END IF;

 FOR item IN
  SELECT o.driver_id,o.kind,o.band,o.valid_until
  FROM public.mobility_stage_document_expiry_alert_outbox o
  JOIN public.mobility_stage_driver_document_attestations e
   ON e.driver_id=o.driver_id AND e.vehicle_id=o.vehicle_id
   AND e.source_document_id=o.source_document_id
   AND e.kind=o.kind AND e.evidence_revision=o.document_revision
   AND e.valid_until=o.valid_until
  JOIN public.mobility_stage_driver_documents d
   ON d.id=e.source_document_id AND d.driver_id=e.driver_id
   AND d.kind::text=e.kind
  WHERE o.delivery_state='PENDING' AND e.attestation_state='verified'
   AND e.verified_at<=observed_at
   AND e.authenticity_verified AND e.issuer_verified
   AND e.malware_scan_passed
   AND (e.kind<>'rostro_selfie' OR (e.consent_for_face
    AND e.photo_received AND e.liveness_verified
    AND e.id_face_match_verified))
   AND d.status='approved' AND d.reviewer_id IS NOT NULL
   AND d.reviewed_at IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.mobility_stage_driver_documents newer
    WHERE newer.driver_id=e.driver_id AND newer.kind=d.kind
     AND (newer.submitted_at,newer.id)>(d.submitted_at,d.id))
   AND ((o.band='EXPIRED' AND e.valid_until<=observed_at)
    OR (o.band='D01' AND e.valid_until>observed_at
      AND e.valid_until<=observed_at+interval '1 day')
    OR (o.band='D07' AND e.valid_until>observed_at+interval '1 day'
      AND e.valid_until<=observed_at+interval '7 days')
    OR (o.band='D15' AND e.valid_until>observed_at+interval '7 days'
      AND e.valid_until<=observed_at+interval '15 days')
    OR (o.band='D30' AND e.valid_until>observed_at+interval '15 days'
      AND e.valid_until<=observed_at+interval '30 days'))
  ORDER BY o.id LIMIT 51
 LOOP
  IF n=50 THEN more:=true;EXIT;END IF;
  n:=n+1;
  collected:=collected||pg_catalog.jsonb_build_array(
   pg_catalog.jsonb_build_object(
    'driverId',item.driver_id,'kind',item.kind,'band',item.band,
    'validUntilMs',(extract(epoch FROM item.valid_until)*1000)::bigint));
 END LOOP;

 RETURN pg_catalog.jsonb_build_object(
  'items',collected,'hasMore',more,
  'persistedAtMs',(extract(epoch FROM observed_at)*1000)::bigint);
END $body$;

REVOKE ALL ON FUNCTION public.mobility_stage_g253_admin_document_alert_page_owner(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION public.mobility_stage_g253_admin_document_alert_page_owner(uuid) IS
 'Private SQL owner only; identity/AAL2/revocation verified by G252 backend; no direct client/admin grants';
