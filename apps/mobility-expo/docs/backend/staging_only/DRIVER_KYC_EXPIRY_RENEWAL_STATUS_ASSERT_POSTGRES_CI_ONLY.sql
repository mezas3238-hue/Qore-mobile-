-- Runs AFTER DRIVER_KYC_EIGHT_DOCS_ATOMIC_ONBOARDING_ASSERT PostgreSQL.
-- The previous test left a new identity-front pending and a revoked session.
DO $t$
DECLARE
 d uuid:='00000000-0000-4000-8000-000000000181';
 v uuid:='71710000-0000-4717-8717-000000000101';
 snapshot jsonb;
 fresh uuid;
BEGIN
 snapshot:=public.mobility_stage_kyc_expiry_snapshot_owner_qa(d,v);
 IF snapshot->>'state'<>'BLOCKED_REVIEW'
 OR snapshot->'renewalRequiredKinds' NOT ? 'identidad_frente'
 OR snapshot->>'qaOnboardingActive'<>'false'
 THEN RAISE EXCEPTION 'KYC replacement pending must block until verified: %',snapshot; END IF;
 -- Simulate an independently attested latest ID photo, server-only fixture.
 SELECT id INTO fresh FROM public.mobility_stage_driver_documents
 WHERE driver_id=d AND kind='identidad_frente'
 ORDER BY submitted_at DESC,id DESC LIMIT 1;
 UPDATE public.mobility_stage_kyc_verified_evidence_qa SET
 source_document_id=fresh,authenticity_verified=true,
 issuer_verified=true,malware_scan_passed=true,evidence_revision=evidence_revision+1
 WHERE driver_id=d AND vehicle_id=v AND kind='identidad_frente';
 snapshot:=public.mobility_stage_kyc_expiry_snapshot_owner_qa(d,v);
 IF snapshot->>'state'<>'READY_QA' OR snapshot->>'qaOnboardingActive'<>'true'
 OR snapshot->>'commercialDispatchAuthorized'<>'false'
 THEN RAISE EXCEPTION 'KYC verified renewal did not restore QA readiness: %',snapshot; END IF;
 -- Server time boundary, no scheduled worker and no stale cached boolean.
 UPDATE public.mobility_stage_kyc_verified_evidence_qa SET
 valid_until=pg_catalog.clock_timestamp()-interval '1 second',
 evidence_revision=evidence_revision+1
 WHERE driver_id=d AND vehicle_id=v AND kind='licencia';
 snapshot:=public.mobility_stage_kyc_expiry_snapshot_owner_qa(d,v);
 IF snapshot->>'state'<>'BLOCKED_EXPIRED'
 OR snapshot->'expiredKinds' NOT ? 'licencia'
 OR snapshot->'renewalRequiredKinds' NOT ? 'licencia'
 OR snapshot->>'accountBlocked'<>'true'
 THEN RAISE EXCEPTION 'KYC expiry failed to immediately block: %',snapshot; END IF;
 -- Renewal upload alone makes old attestation stale, still blocked.
 PERFORM public.mobility_stage_register_driver_document(
  d,pg_catalog.gen_random_uuid(),'licencia',
  d::text||'/licencia-RENEWEDPENDINGIMAGE.jpg',
  'image/jpeg',9000,repeat('d',64));
 snapshot:=public.mobility_stage_kyc_expiry_snapshot_owner_qa(d,v);
 IF snapshot->>'state'<>'BLOCKED_EXPIRED' OR
 snapshot->>'qaOnboardingActive'<>'false'
 THEN RAISE EXCEPTION 'KYC uploaded-but-unverified file unlocked account: %',snapshot; END IF;
 -- Independent issuer/expiration verification linked to newest file.
 SELECT id INTO fresh FROM public.mobility_stage_driver_documents
 WHERE driver_id=d AND kind='licencia'
 ORDER BY submitted_at DESC,id DESC LIMIT 1;
 UPDATE public.mobility_stage_kyc_verified_evidence_qa SET
 source_document_id=fresh,valid_until=pg_catalog.clock_timestamp()+interval '40 days',
 authenticity_verified=true,issuer_verified=true,malware_scan_passed=true,
 evidence_revision=evidence_revision+1
 WHERE driver_id=d AND vehicle_id=v AND kind='licencia';
 snapshot:=public.mobility_stage_kyc_expiry_snapshot_owner_qa(d,v);
 IF snapshot->>'state'<>'READY_QA' OR snapshot->>'qaOnboardingActive'<>'true'
 OR snapshot->>'commercialDispatchAuthorized'<>'false'
 THEN RAISE EXCEPTION 'KYC independently verified renewal did not automatically reactivate QA: %',snapshot; END IF;
 -- Near-expiry notice before any expiry; by 30d, still QA ready.
 UPDATE public.mobility_stage_kyc_verified_evidence_qa SET
 valid_until=pg_catalog.clock_timestamp()+interval '7 days',
 evidence_revision=evidence_revision+1
 WHERE driver_id=d AND vehicle_id=v AND kind='habilitacion';
 snapshot:=public.mobility_stage_kyc_expiry_snapshot_owner_qa(d,v);
 IF snapshot->>'state'<>'READY_QA'
 OR snapshot->'expiringSoonKinds' NOT ? 'habilitacion'
 OR snapshot->>'accountBlocked'<>'false'
 THEN RAISE EXCEPTION 'KYC advance renewal warning incorrect: %',snapshot; END IF;
 -- Suspension independent from document validity NEVER auto-clears.
 UPDATE public.mobility_vehicles SET review_status='suspended'
 WHERE id=v AND driver_id=d;
 snapshot:=public.mobility_stage_kyc_expiry_snapshot_owner_qa(d,v);
 IF snapshot->>'state'<>'SUSPENDED' OR snapshot->>'accountBlocked'<>'true'
 THEN RAISE EXCEPTION 'KYC renewal bypassed administrative suspension: %',snapshot; END IF;
 RAISE NOTICE 'KYC expiry PASS: pending upload blocked; expired blocked; verified renewal auto-ready; early warnings; suspension persists';
END $t$;
SET ROLE service_role;
DO $p$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_kyc_expiry_snapshot_owner_qa(
   '00000000-0000-4000-8000-000000000181',
   '71710000-0000-4717-8717-000000000101');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'KYC expired data leaked to service_role'; END IF;
END $p$;
RESET ROLE;
