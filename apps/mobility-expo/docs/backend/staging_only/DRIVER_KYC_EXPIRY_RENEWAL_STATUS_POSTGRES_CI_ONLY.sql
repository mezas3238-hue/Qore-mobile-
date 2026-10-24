-- QORE Driver KYC expiry/renewal authority, PostgreSQL16 disposable only.
-- Dates are verified server metadata; devices may NOT set expiry or approval.
DO $g$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_kyc_current_onboarding_owner_qa(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'KYC expiry requires disposable 8-document onboarding chain'; END IF;
END $g$;
BEGIN;
CREATE FUNCTION public.mobility_stage_kyc_expiry_snapshot_owner_qa(
 _driver uuid,_vehicle uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 k text;
 e public.mobility_stage_kyc_verified_evidence_qa%ROWTYPE;
 source public.mobility_stage_driver_documents%ROWTYPE;
 latest uuid;
 expires text[]:=ARRAY[]::text[];
 renew text[]:=ARRAY[]::text[];
 soon text[]:=ARRAY[]::text[];
 nearest timestamptz;
 active boolean;
 held boolean;
 clock_at timestamptz:=pg_catalog.clock_timestamp();
 status text;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _driver IS NULL OR _vehicle IS NULL
 THEN RAISE EXCEPTION 'KYC expiry CI-only scope invalid' USING ERRCODE='P7201'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_driver)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
 WHERE user_id=_driver AND role='driver'::public.app_role)
 OR NOT EXISTS(SELECT 1 FROM public.mobility_vehicles
 WHERE id=_vehicle AND driver_id=_driver)
 THEN RAISE EXCEPTION 'KYC expiry foreign actor/vehicle scope denied'
 USING ERRCODE='P7202'; END IF;
 SELECT review_status IN ('rejected'::public.mobility_review_status,
  'suspended'::public.mobility_review_status) INTO held
 FROM public.mobility_vehicles
 WHERE id=_vehicle AND driver_id=_driver;
 FOR k IN SELECT unnest(ARRAY[
  'licencia','identidad_frente','identidad_dorso','cedula_verde',
  'habilitacion','seguro','inspeccion','rostro_selfie']::text[])
 LOOP
  SELECT * INTO e FROM public.mobility_stage_kyc_verified_evidence_qa
   WHERE driver_id=_driver AND vehicle_id=_vehicle AND kind=k;
  SELECT id INTO latest FROM public.mobility_stage_driver_documents
   WHERE driver_id=_driver AND kind::text=k
   ORDER BY submitted_at DESC,id DESC LIMIT 1;
  IF FOUND AND e.source_document_id IS NOT NULL
   AND latest=e.source_document_id
  THEN
   SELECT * INTO source FROM public.mobility_stage_driver_documents
    WHERE id=latest;
  ELSE
   source.id:=NULL;
  END IF;
  IF e.kind IS NOT NULL AND e.valid_until<=clock_at THEN
   expires:=pg_catalog.array_append(expires,k);
  END IF;
  IF e.kind IS NULL OR source.id IS NULL OR source.status='rejected'
   OR e.valid_until<=clock_at OR NOT (
    e.verified_by='QA_INDEPENDENT_ATTESTOR_NO_MEDIA' AND
    e.authenticity_verified AND e.issuer_verified AND e.malware_scan_passed
    AND (k<>'rostro_selfie' OR (e.consent_for_face
     AND e.photo_received AND e.liveness_verified
     AND e.id_face_match_verified)))
  THEN
   renew:=pg_catalog.array_append(renew,k);
  ELSE
   IF nearest IS NULL OR e.valid_until<nearest THEN nearest:=e.valid_until; END IF;
   IF e.valid_until<=clock_at+interval '30 days' THEN
    soon:=pg_catalog.array_append(soon,k);
   END IF;
  END IF;
 END LOOP;
 -- The archival approval receipt is not a permission. Every read computes
 -- current verified latest 8 documents, due dates and vehicle hold.
 active:=public.mobility_stage_kyc_current_onboarding_owner_qa(_driver,_vehicle)
  AND pg_catalog.cardinality(renew)=0 AND NOT held;
 status:=CASE
  WHEN held THEN 'SUSPENDED'
  WHEN pg_catalog.cardinality(expires)>0 THEN 'BLOCKED_EXPIRED'
  WHEN pg_catalog.cardinality(renew)>0 THEN 'BLOCKED_REVIEW'
  WHEN active THEN 'READY_QA'
  ELSE 'BLOCKED_REVIEW'
 END;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','state',status,
  'expiredKinds',pg_catalog.to_jsonb(expires),
  'renewalRequiredKinds',pg_catalog.to_jsonb(renew),
  'expiringSoonKinds',pg_catalog.to_jsonb(soon),
  'nearestExpiryAtMs',CASE WHEN nearest IS NULL THEN null ELSE
   (extract(epoch FROM nearest)*1000)::bigint END,
  'accountBlocked',NOT active,'qaOnboardingActive',active,
  'commercialDispatchAuthorized',false,
  'qaOnly',true,'productionEnabled',false);
END $fn$;
REVOKE ALL ON FUNCTION public.mobility_stage_kyc_expiry_snapshot_owner_qa(
 uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
