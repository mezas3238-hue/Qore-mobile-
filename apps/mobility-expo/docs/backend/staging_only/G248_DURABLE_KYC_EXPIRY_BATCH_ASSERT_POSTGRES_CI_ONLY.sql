-- G248 validates durable cursor, whole-cycle resumption and private grants.
DO $preflight$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class
   WHERE oid='public.mobility_stage_g248_expiry_scan_state_qa'::regclass
     AND relrowsecurity)
 OR has_table_privilege('anon',
   'public.mobility_stage_g248_expiry_scan_state_qa','SELECT')
 OR has_table_privilege('authenticated',
   'public.mobility_stage_g248_expiry_scan_state_qa','SELECT')
 OR has_table_privilege('service_role',
   'public.mobility_stage_g248_expiry_scan_state_qa','SELECT')
 OR has_function_privilege('anon',
   'public.mobility_stage_g248_run_due_kyc_batch_owner_qa(integer)','EXECUTE')
 OR has_function_privilege('authenticated',
   'public.mobility_stage_g248_run_due_kyc_batch_owner_qa(integer)','EXECUTE')
 OR has_function_privilege('service_role',
   'public.mobility_stage_g248_run_due_kyc_batch_owner_qa(integer)','EXECUTE')
 THEN RAISE EXCEPTION 'G248 private checkpoint/grants leaked'; END IF;
END $preflight$;
BEGIN;
DO $test$
DECLARE
 d uuid:='00000000-0000-4000-8000-000000000181';
 v uuid:='71710000-0000-4717-8717-000000000101';
 a jsonb;
 b jsonb;
 c jsonb;
 cursor_before uuid;
 revision_before bigint;
 BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_kyc_verified_evidence_qa
      WHERE driver_id=d AND vehicle_id=v)<>8
 THEN RAISE EXCEPTION 'G248 missing eight evidence fixtures'; END IF;
 UPDATE public.mobility_stage_kyc_verified_evidence_qa
 SET valid_until=pg_catalog.clock_timestamp()+interval '90 days',
  evidence_revision=evidence_revision+1
 WHERE driver_id=d AND vehicle_id=v;
 UPDATE public.mobility_stage_kyc_verified_evidence_qa
 SET valid_until=pg_catalog.clock_timestamp()+interval '29 days'
 WHERE driver_id=d AND vehicle_id=v AND kind='licencia';
 UPDATE public.mobility_stage_kyc_verified_evidence_qa
 SET valid_until=pg_catalog.clock_timestamp()+interval '6 days'
 WHERE driver_id=d AND vehicle_id=v AND kind='habilitacion';
 UPDATE public.mobility_stage_kyc_verified_evidence_qa
 SET valid_until=pg_catalog.clock_timestamp()-interval '1 hour'
 WHERE driver_id=d AND vehicle_id=v AND kind='inspeccion';

 a:=public.mobility_stage_g248_run_due_kyc_batch_owner_qa(2);
 IF a->>'status'<>'PROCESSED' OR a->>'processed'<>'2'
  OR a->>'inserted'<>'2' OR a->>'cycleCompleted'<>'false'
  OR a->>'checkpointRevision'<>'1'
  OR a->>'productionEnabled'<>'false'
  OR a->>'driverDispatchAuthorized'<>'false'
 THEN RAISE EXCEPTION 'G248 incomplete checkpoint or unsafe receipt %',a; END IF;
 SELECT resume_document_id,revision INTO cursor_before,revision_before
 FROM public.mobility_stage_g248_expiry_scan_state_qa WHERE singleton=true;
 IF cursor_before IS NULL OR revision_before<>1 OR
 cursor_before::text<>a->>'resumeCursor'
 THEN RAISE EXCEPTION 'G248 checkpoint not saved in PostgreSQL';END IF;
 b:=public.mobility_stage_g248_run_due_kyc_batch_owner_qa(2);
 IF b->>'status'<>'PROCESSED' OR b->>'processed'<>'1'
  OR b->>'inserted'<>'1' OR b->>'cycleCompleted'<>'true'
  OR b->>'resumeCursor' IS NOT NULL OR b->>'checkpointRevision'<>'2'
 THEN RAISE EXCEPTION 'G248 persisted resume did not complete scan %',b;END IF;
 IF (SELECT count(*) FROM public.mobility_stage_g247_document_alerts_qa)<>3
 OR (SELECT resume_document_id FROM public.mobility_stage_g248_expiry_scan_state_qa
 WHERE singleton=true) IS NOT NULL
 THEN RAISE EXCEPTION 'G248 did not finish all eligible documents';END IF;
 c:=public.mobility_stage_g248_run_due_kyc_batch_owner_qa(2);
 IF c->>'processed'<>'2' OR c->>'inserted'<>'0'
 OR c->>'duplicate'<>'2' OR c->>'checkpointRevision'<>'3'
 THEN RAISE EXCEPTION 'G248 re-run inserted duplicate notifications %',c; END IF;
 RAISE NOTICE 'G248 PASS: 2+1 persisted scan; restart continuation; duplicate suppression';
END $test$;
ROLLBACK;
SET ROLE service_role;
DO $deny$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
 PERFORM public.mobility_stage_g248_run_due_kyc_batch_owner_qa(5);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G248 service_role can start scanner'; END IF;
 denied:=false;
 BEGIN PERFORM 1 FROM public.mobility_stage_g248_expiry_scan_state_qa;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G248 service_role can read cursor'; END IF;
END $deny$;
RESET ROLE;
