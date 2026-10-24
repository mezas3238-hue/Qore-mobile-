-- Full eight-document onboarding QA assertions; no real images or credentials.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'KYC assertions must run in disposable CI'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class
 WHERE oid='public.mobility_stage_kyc_verified_evidence_qa'::regclass
 AND relrowsecurity)
 THEN RAISE EXCEPTION 'KYC evidence must be RLS guarded'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE
 oid='public.mobility_stage_kyc_atomic_approve_owner_qa(uuid,uuid,uuid,bigint,uuid)'::regprocedure
 AND prosecdef AND EXISTS(SELECT 1 FROM pg_catalog.unnest(proconfig)
 AS settings(config) WHERE config IN ('search_path=','search_path=""')))
 THEN RAISE EXCEPTION 'KYC approval must have fixed empty search_path'; END IF;
 IF has_function_privilege('anon',
 'public.mobility_stage_kyc_atomic_approve_owner_qa(uuid,uuid,uuid,bigint,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
 'public.mobility_stage_kyc_atomic_approve_owner_qa(uuid,uuid,uuid,bigint,uuid)','EXECUTE')
 OR has_function_privilege('service_role',
 'public.mobility_stage_kyc_atomic_approve_owner_qa(uuid,uuid,uuid,bigint,uuid)','EXECUTE')
 OR has_table_privilege('service_role',
 'public.mobility_stage_kyc_verified_evidence_qa','SELECT')
 OR has_function_privilege('service_role',
 'public.mobility_stage_kyc_current_onboarding_owner_qa(uuid,uuid)','EXECUTE')
 OR has_table_privilege('authenticated',
 'public.mobility_stage_kyc_verified_evidence_qa','INSERT')
 THEN RAISE EXCEPTION 'KYC private SQL privileges leaked'; END IF;
END $guard$;

DO $test$
DECLARE
 d uuid:='00000000-0000-4000-8000-000000000181';
 v uuid:='71710000-0000-4717-8717-000000000101';
 s uuid:='71710000-0000-4717-8717-000000000102';
 k uuid:='71710000-0000-4717-8717-000000000103';
 iat bigint;
 output jsonb;
 doc_kind text;
 evidence_doc uuid;
 selfie_doc uuid;
 kinds text[]:=ARRAY['licencia','identidad_frente','identidad_dorso',
  'cedula_verde','habilitacion','seguro','inspeccion'];
 bad boolean;
BEGIN
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=d)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
 WHERE user_id=d AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'KYC independent G16 driver fixture absent'; END IF;
 iat:=(extract(epoch FROM
 (pg_catalog.clock_timestamp()-interval '10 seconds'))*1000)::bigint;
 INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
 VALUES(d,s,pg_catalog.clock_timestamp()-interval '1 day',
 pg_catalog.clock_timestamp()-interval '1 minute',
 pg_catalog.clock_timestamp()+interval '1 hour',
 'QA_SYNTHETIC_PROVIDER_SESSION_ONLY');
 INSERT INTO public.mobility_vehicles(
 id,driver_id,vehicle_kind,service_kind,country_code,municipality_code,
 plate_normalized,brand,model,manufacture_year,passenger_capacity)
 VALUES(v,d,'AUTO','economico','PY','ASUNCION','KYC7101',
 'QORE QA','KYC TEST',2024,4);
 FOREACH doc_kind IN ARRAY kinds LOOP
  SELECT public.mobility_stage_register_driver_document(
   d,pg_catalog.gen_random_uuid(),doc_kind::public.mobility_stage_driver_document_kind,
   d::text||'/'||doc_kind||'-NEWREVIEWDOCFILE.jpg',
   'image/jpeg',9000,repeat('a',64)) INTO evidence_doc;
  INSERT INTO public.mobility_stage_kyc_verified_evidence_qa(
    driver_id,vehicle_id,source_document_id,kind,verified_by,authenticity_verified,
    issuer_verified,malware_scan_passed,valid_until,evidence_revision)
  VALUES(d,v,evidence_doc,doc_kind,'QA_INDEPENDENT_ATTESTOR_NO_MEDIA',true,true,
    true,pg_catalog.clock_timestamp()+interval '2 days',1);
 END LOOP;
 -- Seven valid records are not enough, even if vehicle is linked.
 bad:=false;
 BEGIN
  PERFORM public.mobility_stage_kyc_atomic_approve_owner_qa(d,v,s,iat,k);
 EXCEPTION WHEN SQLSTATE 'P7106' THEN bad:=true;
 END;
 IF NOT bad THEN RAISE EXCEPTION 'KYC missing selfie accepted'; END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_kyc_onboarding_decisions_qa
 WHERE driver_id=d AND vehicle_id=v)
 THEN RAISE EXCEPTION 'KYC missing selfie created approval'; END IF;
 -- Photo observed without liveness, consent and document match cannot pass.
 SELECT public.mobility_stage_register_driver_document(
  d,pg_catalog.gen_random_uuid(),'rostro_selfie',
  d::text||'/rostro_selfie-NEWREVIEWDOCFILE.jpg',
  'image/jpeg',9000,repeat('b',64)) INTO selfie_doc;
 INSERT INTO public.mobility_stage_kyc_verified_evidence_qa(
 driver_id,vehicle_id,source_document_id,kind,verified_by,authenticity_verified,
 issuer_verified,malware_scan_passed,valid_until,evidence_revision,
 photo_received,consent_for_face,liveness_verified,id_face_match_verified)
 VALUES(d,v,selfie_doc,'rostro_selfie','QA_INDEPENDENT_ATTESTOR_NO_MEDIA',
 true,true,true,pg_catalog.clock_timestamp()+interval '2 hours',1,
 true,false,false,false);
 bad:=false;
 BEGIN
  PERFORM public.mobility_stage_kyc_atomic_approve_owner_qa(d,v,s,iat,k);
 EXCEPTION WHEN SQLSTATE 'P7105' THEN bad:=true;
 END;
 IF NOT bad THEN RAISE EXCEPTION 'KYC selfie without liveness accepted'; END IF;
 UPDATE public.mobility_stage_kyc_verified_evidence_qa
 SET consent_for_face=true,liveness_verified=true,id_face_match_verified=true,
 evidence_revision=2,recorded_at=pg_catalog.clock_timestamp()
 WHERE driver_id=d AND vehicle_id=v AND kind='rostro_selfie';
 output:=public.mobility_stage_kyc_atomic_approve_owner_qa(d,v,s,iat,k);
 IF output->>'mode'<>'ISOLATED_QA_ONLY'
 OR output->>'onboardingApprovedInQa'<>'true'
 OR output->>'commercialDriverEligible'<>'false'
 OR output->>'productionEnabled'<>'false'
 THEN RAISE EXCEPTION 'KYC receipt could be misread as LIVE'; END IF;
 IF (public.mobility_stage_kyc_atomic_approve_owner_qa(d,v,s,iat,k)
 ->>'decisionId')<>output->>'decisionId'
 THEN RAISE EXCEPTION 'KYC approval idempotency failed'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_kyc_onboarding_decisions_qa
 WHERE driver_id=d AND vehicle_id=v)<>1
 THEN RAISE EXCEPTION 'KYC duplicate autoapproval inserted'; END IF;
 IF NOT public.mobility_stage_kyc_current_onboarding_owner_qa(d,v)
 THEN RAISE EXCEPTION 'KYC current valid dossier unexpectedly false'; END IF;
 -- After certification, expiry/revocation prevents future confirmation.
 UPDATE public.mobility_stage_kyc_verified_evidence_qa
 SET valid_until=pg_catalog.clock_timestamp()-interval '1 second',
 evidence_revision=evidence_revision+1
 WHERE driver_id=d AND vehicle_id=v AND kind='licencia';
 bad:=false;
 BEGIN
  PERFORM public.mobility_stage_kyc_atomic_approve_owner_qa(d,v,s,iat,k);
 EXCEPTION WHEN SQLSTATE 'P7105' THEN bad:=true;
 END;
 IF NOT bad THEN RAISE EXCEPTION 'KYC stale approval bypassed expired document'; END IF;
 IF public.mobility_stage_kyc_current_onboarding_owner_qa(d,v)
 THEN RAISE EXCEPTION 'KYC historical approval remained valid after expiry'; END IF;
 UPDATE public.mobility_stage_kyc_verified_evidence_qa
 SET valid_until=pg_catalog.clock_timestamp()+interval '1 day',
 evidence_revision=evidence_revision+1
 WHERE driver_id=d AND vehicle_id=v AND kind='licencia';
 UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=pg_catalog.clock_timestamp(),revision=revision+1
 WHERE user_id=d AND session_id=s;
 bad:=false;
 BEGIN
  PERFORM public.mobility_stage_kyc_atomic_approve_owner_qa(d,v,s,iat,k);
 EXCEPTION WHEN SQLSTATE 'P7103' THEN bad:=true;
 END;
 IF NOT bad THEN RAISE EXCEPTION 'KYC revoked session bypassed'; END IF;
 -- An independently uploaded replacement (even pending) invalidates the
 -- attestation of a former document; no stale proof may approve the Driver.
 PERFORM public.mobility_stage_register_driver_document(
  d,pg_catalog.gen_random_uuid(),'identidad_frente',
  d::text||'/identidad_frente-SECONDPRIVATEFILE.jpg',
  'image/jpeg',9001,repeat('c',64));
 IF public.mobility_stage_kyc_current_onboarding_owner_qa(d,v)
 THEN RAISE EXCEPTION 'KYC stale document survives newer private upload'; END IF;
 RAISE NOTICE 'KYC PASS: eight documents, selfie liveness, idempotency, expiry, G42 revocation, no LIVE';
END $test$;

-- Only the database owner may perform approval or read raw metadata.
SET ROLE service_role;
DO $priv$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_kyc_atomic_approve_owner_qa(
    '00000000-0000-4000-8000-000000000181',
    '71710000-0000-4717-8717-000000000101',
    '71710000-0000-4717-8717-000000000102',
    1000000000000,
    '71710000-0000-4717-8717-000000000103');
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'KYC service_role accessed owner-only approval'; END IF;
END $priv$;
RESET ROLE;
