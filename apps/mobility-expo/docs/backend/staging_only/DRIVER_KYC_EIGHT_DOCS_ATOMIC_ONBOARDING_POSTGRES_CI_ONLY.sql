-- Driver KYC: eight independent provider-attested evidences incl facial selfie.
-- PostgreSQL16 disposable only; never real documents, photos or biometric data.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR to_regclass('public.mobility_stage_driver_documents') IS NULL
 OR to_regclass('public.mobility_vehicles') IS NULL
 THEN RAISE EXCEPTION 'KYC requires disposable G17 and G42 chain'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_kyc_verified_evidence_qa (
 driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 vehicle_id uuid NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK (kind IN (
  'licencia','identidad_frente','identidad_dorso','cedula_verde',
  'habilitacion','seguro','inspeccion','rostro_selfie')),
 verified_by text NOT NULL CHECK (verified_by='QA_INDEPENDENT_ATTESTOR_NO_MEDIA'),
 authenticity_verified boolean NOT NULL,
 issuer_verified boolean NOT NULL,
 malware_scan_passed boolean NOT NULL,
 valid_until timestamptz NOT NULL,
 evidence_revision bigint NOT NULL CHECK(evidence_revision>0),
 consent_for_face boolean NOT NULL DEFAULT false,
 liveness_verified boolean NOT NULL DEFAULT false,
 id_face_match_verified boolean NOT NULL DEFAULT false,
 photo_received boolean NOT NULL DEFAULT false,
 recorded_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 PRIMARY KEY(driver_id,vehicle_id,kind),
 CHECK(kind='rostro_selfie' OR
  (consent_for_face=false AND liveness_verified=false
   AND id_face_match_verified=false AND photo_received=false))
);
CREATE INDEX mobility_stage_kyc_evidence_validity_qa
 ON public.mobility_stage_kyc_verified_evidence_qa(driver_id,vehicle_id,valid_until);
ALTER TABLE public.mobility_stage_kyc_verified_evidence_qa ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_kyc_verified_evidence_qa
 FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE public.mobility_stage_kyc_onboarding_decisions_qa (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 vehicle_id uuid NOT NULL REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
 decision text NOT NULL CHECK(decision='QA_ONBOARDING_APPROVED_NOT_COMMERCIAL'),
 approved_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 UNIQUE(driver_id,vehicle_id)
);
ALTER TABLE public.mobility_stage_kyc_onboarding_decisions_qa ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_kyc_onboarding_decisions_qa
 FROM PUBLIC,anon,authenticated,service_role;

-- This RPC is owner-only, with no SDK or service_role EXECUTE, and only
-- synthetic attributions previously inserted by the PostgreSQL CI owner.
-- The Driver handset cannot attest documents or call this function.
CREATE FUNCTION public.mobility_stage_kyc_atomic_approve_owner_qa(
 _driver uuid,_vehicle uuid,_session uuid,_iat_ms bigint,_request_key uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path=''
AS $body$
DECLARE
 v public.mobility_vehicles%ROWTYPE;
 evidence public.mobility_stage_kyc_verified_evidence_qa%ROWTYPE;
 observed integer:=0;
 seen text[]:=ARRAY[]::text[];
 stored_id uuid;
 prior public.mobility_stage_kyc_onboarding_decisions_qa%ROWTYPE;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _driver IS NULL OR _vehicle IS NULL OR _session IS NULL
 OR _request_key IS NULL OR _iat_ms IS NULL
 THEN RAISE EXCEPTION 'KYC CI-only owner request invalid' USING ERRCODE='P7101'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_driver)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
 WHERE user_id=_driver AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'KYC exclusive Driver required' USING ERRCODE='P7102'; END IF;
 IF NOT public.mobility_stage_g42_lock_session(_driver,_session,_iat_ms)
 THEN RAISE EXCEPTION 'KYC session revoked' USING ERRCODE='P7103'; END IF;
 SELECT * INTO v FROM public.mobility_vehicles
 WHERE id=_vehicle AND driver_id=_driver FOR SHARE;
 IF NOT FOUND OR v.country_code<>'PY'
 OR v.vehicle_kind NOT IN ('AUTO'::public.mobility_vehicle_kind,
 'MOTO'::public.mobility_vehicle_kind)
 OR v.review_status IN ('rejected'::public.mobility_review_status,
 'suspended'::public.mobility_review_status)
 THEN RAISE EXCEPTION 'KYC assigned vehicle not eligible for review'
 USING ERRCODE='P7104'; END IF;
 -- Lock every current record, not just a preflight boolean. Revocation,
 -- evidence replacement and expiration must be excluded until COMMIT.
 FOR evidence IN
  SELECT * FROM public.mobility_stage_kyc_verified_evidence_qa
  WHERE driver_id=_driver AND vehicle_id=_vehicle
  ORDER BY kind FOR SHARE
 LOOP
  IF evidence.verified_by<>'QA_INDEPENDENT_ATTESTOR_NO_MEDIA'
  OR evidence.authenticity_verified IS DISTINCT FROM true
  OR evidence.issuer_verified IS DISTINCT FROM true
  OR evidence.malware_scan_passed IS DISTINCT FROM true
  OR evidence.valid_until<=pg_catalog.clock_timestamp()
  OR evidence.evidence_revision<1
  OR (evidence.kind='rostro_selfie' AND (
    evidence.consent_for_face IS DISTINCT FROM true
    OR evidence.photo_received IS DISTINCT FROM true
    OR evidence.liveness_verified IS DISTINCT FROM true
    OR evidence.id_face_match_verified IS DISTINCT FROM true))
  THEN RAISE EXCEPTION 'KYC incomplete, expired or disputed evidence'
   USING ERRCODE='P7105'; END IF;
  observed:=observed+1;
  seen:=pg_catalog.array_append(seen,evidence.kind);
 END LOOP;
 IF observed<>8 OR NOT (ARRAY[
 'licencia','identidad_frente','identidad_dorso','cedula_verde',
 'habilitacion','seguro','inspeccion','rostro_selfie']::text[] <@ seen)
 THEN RAISE EXCEPTION 'KYC complete eight-document dossier required'
 USING ERRCODE='P7106'; END IF;
 SELECT * INTO prior FROM public.mobility_stage_kyc_onboarding_decisions_qa
 WHERE request_key=_request_key FOR UPDATE;
 IF FOUND THEN
  IF prior.driver_id<>_driver OR prior.vehicle_id<>_vehicle
   THEN RAISE EXCEPTION 'KYC idempotency scope conflict'
    USING ERRCODE='P7107'; END IF;
  stored_id:=prior.id;
 ELSE
  INSERT INTO public.mobility_stage_kyc_onboarding_decisions_qa(
   request_key,driver_id,vehicle_id,decision)
  VALUES(_request_key,_driver,_vehicle,'QA_ONBOARDING_APPROVED_NOT_COMMERCIAL')
  RETURNING id INTO stored_id;
 END IF;
 RETURN pg_catalog.jsonb_build_object(
  'mode','ISOLATED_QA_ONLY','decisionId',stored_id,
  'onboardingApprovedInQa',true,
  'commercialDriverEligible',false,'productionEnabled',false);
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_kyc_atomic_approve_owner_qa(
 uuid,uuid,uuid,bigint,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
-- Current onboarding validity is always derived from LIVE QA evidence metadata;
-- a historical decision row is NOT a permanent authorization. No vehicle or
-- assignment is commercially eligible as a result of this predicate.
CREATE FUNCTION public.mobility_stage_kyc_current_onboarding_owner_qa(
 _driver uuid,_vehicle uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $body$
 SELECT COALESCE(
  EXISTS(SELECT 1 FROM public.mobility_stage_kyc_onboarding_decisions_qa a
  WHERE a.driver_id=_driver AND a.vehicle_id=_vehicle)
  AND EXISTS(SELECT 1 FROM public.mobility_vehicles v
   WHERE v.id=_vehicle AND v.driver_id=_driver
    AND v.country_code='PY'
    AND v.review_status NOT IN ('rejected'::public.mobility_review_status,
     'suspended'::public.mobility_review_status))
  AND EXISTS(SELECT 1 FROM public.user_roles r
   WHERE r.user_id=_driver AND r.role='driver'::public.app_role)
  AND (SELECT count(*) FROM public.user_roles r WHERE r.user_id=_driver)=1
  AND (SELECT count(*) FROM public.mobility_stage_kyc_verified_evidence_qa e
   WHERE e.driver_id=_driver AND e.vehicle_id=_vehicle
   AND e.verified_by='QA_INDEPENDENT_ATTESTOR_NO_MEDIA'
   AND e.authenticity_verified AND e.issuer_verified
   AND e.malware_scan_passed AND e.valid_until>pg_catalog.now()
   AND (e.kind<>'rostro_selfie' OR
    (e.photo_received AND e.consent_for_face AND
     e.liveness_verified AND e.id_face_match_verified))
   )=8,
 false)
$body$;
REVOKE ALL ON FUNCTION public.mobility_stage_kyc_current_onboarding_owner_qa(
 uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
