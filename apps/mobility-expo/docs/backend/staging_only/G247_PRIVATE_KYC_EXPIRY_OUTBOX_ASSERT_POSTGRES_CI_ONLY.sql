-- G247 assertions: real SQL, synthetic fixture, every change rolled back.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G247 tests require isolated PG16 CI';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class
  WHERE oid='public.mobility_stage_g247_document_alerts_qa'::regclass
  AND relrowsecurity)
 OR has_table_privilege('anon','public.mobility_stage_g247_document_alerts_qa','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_g247_document_alerts_qa','SELECT')
 OR has_table_privilege('service_role','public.mobility_stage_g247_document_alerts_qa','SELECT')
 OR has_function_privilege('anon',
  'public.mobility_stage_g247_scan_expiry_owner_qa(uuid,integer)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g247_scan_expiry_owner_qa(uuid,integer)','EXECUTE')
 OR has_function_privilege('service_role',
  'public.mobility_stage_g247_scan_expiry_owner_qa(uuid,integer)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g247_current_pending_owner_qa(integer)','EXECUTE')
 THEN RAISE EXCEPTION 'G247 leaked private document metadata or worker grants';END IF;
END $guard$;
BEGIN;
DO $assert$
DECLARE
 d uuid:='00000000-0000-4000-8000-000000000181';
 v uuid:='71710000-0000-4717-8717-000000000101';
 result jsonb;
 alert_count integer;
 active_count integer;
 key_before text;
BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_kyc_verified_evidence_qa
 WHERE driver_id=d AND vehicle_id=v)<>8
 THEN RAISE EXCEPTION 'G247 missing preexisting independently attested fixture';END IF;
 IF (SELECT count(*) FROM public.mobility_stage_g247_document_alerts_qa)<>0
 THEN RAISE EXCEPTION 'G247 fixture must start with empty outbox';END IF;
 -- Nonexpired baseline, then five unique expiry bands. Dates are set by
 -- disposable SQL owner, never by handset or public service_role.
 UPDATE public.mobility_stage_kyc_verified_evidence_qa
 SET valid_until=pg_catalog.clock_timestamp()+interval '90 days',
 evidence_revision=evidence_revision+1
 WHERE driver_id=d AND vehicle_id=v;
 UPDATE public.mobility_stage_kyc_verified_evidence_qa SET
  valid_until=pg_catalog.clock_timestamp()+interval '29 days'
 WHERE driver_id=d AND vehicle_id=v AND kind='licencia';
 UPDATE public.mobility_stage_kyc_verified_evidence_qa SET
  valid_until=pg_catalog.clock_timestamp()+interval '14 days'
 WHERE driver_id=d AND vehicle_id=v AND kind='identidad_frente';
 UPDATE public.mobility_stage_kyc_verified_evidence_qa SET
  valid_until=pg_catalog.clock_timestamp()+interval '6 days'
 WHERE driver_id=d AND vehicle_id=v AND kind='habilitacion';
 UPDATE public.mobility_stage_kyc_verified_evidence_qa SET
  valid_until=pg_catalog.clock_timestamp()+interval '12 hours'
 WHERE driver_id=d AND vehicle_id=v AND kind='seguro';
 UPDATE public.mobility_stage_kyc_verified_evidence_qa SET
  valid_until=pg_catalog.clock_timestamp()-interval '1 hour'
 WHERE driver_id=d AND vehicle_id=v AND kind='inspeccion';

 result:=public.mobility_stage_g247_scan_expiry_owner_qa(null,2);
 IF result->>'processed'<>'2'
 OR result->>'inserted'<>'2' OR result->>'duplicate'<>'0'
 OR result->>'nextCursor' IS NULL
 OR result->>'driverDispatchAuthorized'<>'false'
 OR result->>'productionEnabled'<>'false'
 THEN RAISE EXCEPTION 'G247 private scan first page invalid: %',result;END IF;
 result:=public.mobility_stage_g247_scan_expiry_owner_qa(
  (result->>'nextCursor')::uuid,2);
 IF result->>'processed'<>'2'
 OR result->>'inserted'<>'2'
 OR result->>'nextCursor' IS NULL
 THEN RAISE EXCEPTION 'G247 private scan second page invalid: %',result;END IF;
 result:=public.mobility_stage_g247_scan_expiry_owner_qa(
  (result->>'nextCursor')::uuid,2);
 IF result->>'processed'<>'1' OR result->>'inserted'<>'1'
 OR result->>'nextCursor' IS NOT NULL
 THEN RAISE EXCEPTION 'G247 private scan final page invalid: %',result;END IF;
 IF (SELECT count(*) FROM public.mobility_stage_g247_document_alerts_qa
  WHERE driver_id=d)<>5 OR
 (SELECT count(DISTINCT band) FROM public.mobility_stage_g247_document_alerts_qa
  WHERE driver_id=d)<>5
 THEN RAISE EXCEPTION 'G247 missed expiry windows'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.mobility_stage_g247_document_alerts_qa
  WHERE driver_id=d AND kind='licencia' AND band='D30')
 OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_g247_document_alerts_qa
  WHERE driver_id=d AND kind='identidad_frente' AND band='D15')
 OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_g247_document_alerts_qa
  WHERE driver_id=d AND kind='habilitacion' AND band='D07')
 OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_g247_document_alerts_qa
  WHERE driver_id=d AND kind='seguro' AND band='D01')
 OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_g247_document_alerts_qa
  WHERE driver_id=d AND kind='inspeccion' AND band='EXPIRED')
 THEN RAISE EXCEPTION 'G247 exact band mapping failed';END IF;
 result:=public.mobility_stage_g247_scan_expiry_owner_qa();
 IF result->>'inserted'<>'0' OR result->>'duplicate'<>'5'
 THEN RAISE EXCEPTION 'G247 idempotent replay not deduplicated: %',result;END IF;
 SELECT count(*) INTO active_count
 FROM public.mobility_stage_g247_current_pending_owner_qa(50);
 IF active_count<>5 THEN
  RAISE EXCEPTION 'G247 private pending report invalid: %',active_count;END IF;

 SELECT event_key INTO key_before
 FROM public.mobility_stage_g247_document_alerts_qa
 WHERE driver_id=d AND kind='licencia';
 -- Renewal with a new evidence revision must suppress stale outbound notice.
 UPDATE public.mobility_stage_kyc_verified_evidence_qa
 SET valid_until=pg_catalog.clock_timestamp()+interval '90 days',
 evidence_revision=evidence_revision+1
 WHERE driver_id=d AND vehicle_id=v AND kind='licencia';
 SELECT count(*) INTO active_count
 FROM public.mobility_stage_g247_current_pending_owner_qa(50);
 IF active_count<>4 OR NOT EXISTS(
  SELECT 1 FROM public.mobility_stage_g247_document_alerts_qa
  WHERE event_key=key_before)
 THEN RAISE EXCEPTION 'G247 renewal failed stale-notification suppression';END IF;
 -- Loss of independent attestation prevents sending even before expiry.
 UPDATE public.mobility_stage_kyc_verified_evidence_qa
 SET authenticity_verified=false
 WHERE driver_id=d AND vehicle_id=v AND kind='seguro';
 SELECT count(*) INTO active_count
 FROM public.mobility_stage_g247_current_pending_owner_qa(50);
 IF active_count<>3
 THEN RAISE EXCEPTION 'G247 unverified proof still notified';END IF;
 -- Repeated scan cannot revive no-longer-valid proof in new outbox events.
 PERFORM public.mobility_stage_g247_scan_expiry_owner_qa();
 SELECT count(*) INTO alert_count
 FROM public.mobility_stage_g247_document_alerts_qa;
 IF alert_count<>5 THEN RAISE EXCEPTION 'G247 invalid reinsert';END IF;
 RAISE NOTICE 'G247 PASS: PG16 verified-source bands, 2+2+1 pagination, durable idempotency, stale renewal suppression';
END $assert$;
ROLLBACK;
SET ROLE service_role;
DO $priv$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g247_scan_expiry_owner_qa(null,50);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'G247 service_role invoked private worker';END IF;
 denied:=false;
 BEGIN
  PERFORM 1 FROM public.mobility_stage_g247_document_alerts_qa LIMIT 1;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'G247 service_role read protected outbox';END IF;
END $priv$;
RESET ROLE;
