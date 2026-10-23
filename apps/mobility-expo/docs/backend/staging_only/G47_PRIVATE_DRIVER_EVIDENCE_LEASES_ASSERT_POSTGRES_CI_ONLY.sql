-- G47 private document metadata, role+session lease TTL, audited revocation.
-- Only synthetic G17-created license objects. Zero uploads, zero signed URLs.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g47_issue_lease_qa(uuid,uuid,bigint,uuid,uuid,text)') IS NULL
 THEN RAISE EXCEPTION 'G47 assertions refuse non-disposable schema'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='60s';
-- G17 earlier tests created driver's two private synthetic license refs.
-- Driver 181 and admin 101 come from pre-existing schema integration.
INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,
 evidence_kind
) VALUES
 ('00000000-0000-4000-8000-000000000181',
  '47470000-0000-4747-8747-000000000101',
  pg_catalog.clock_timestamp()-interval '1 hour',
  pg_catalog.clock_timestamp()-interval '5 minutes',
  pg_catalog.clock_timestamp()+interval '1 hour',
  'QA_SYNTHETIC_PROVIDER_SESSION_ONLY'),
 ('00000000-0000-4000-8000-000000000101',
  '47470000-0000-4747-8747-000000000102',
  pg_catalog.clock_timestamp()-interval '1 hour',
  pg_catalog.clock_timestamp()-interval '5 minutes',
  pg_catalog.clock_timestamp()+interval '1 hour',
  'QA_SYNTHETIC_PROVIDER_SESSION_ONLY');
-- Establish this test's independent G17 synthetic evidence; earlier CI
-- exercises may intentionally roll back their own document test rows.
SELECT public.mobility_stage_register_driver_document(
 '00000000-0000-4000-8000-000000000181',
 '47470000-0000-4747-8747-000000000001',
 'licencia',
 '00000000-0000-4000-8000-000000000181/licencia-G47SyntheticHead0001.jpg',
 'image/jpeg',8500,repeat('a',64));
DO $tests$
DECLARE
 driver uuid:='00000000-0000-4000-8000-000000000181';
 admin uuid:='00000000-0000-4000-8000-000000000101';
 outsider uuid:='00000000-0000-4000-8000-000000000182';
 driver_session uuid:='47470000-0000-4747-8747-000000000101';
 admin_session uuid:='47470000-0000-4747-8747-000000000102';
 r1 uuid:='47470000-0000-4747-8747-000000000201';
 r2 uuid:='47470000-0000-4747-8747-000000000202';
 r3 uuid:='47470000-0000-4747-8747-000000000203';
 doc public.mobility_stage_driver_documents%ROWTYPE;
 issued jsonb; repeat_issue jsonb; admin_issue jsonb;
 lease uuid; lease_admin uuid;
 iat bigint:=floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint;
 denied boolean; detail text;
BEGIN
 SELECT * INTO doc FROM public.mobility_stage_driver_documents d
 WHERE d.driver_id=driver AND d.status='pending'
 ORDER BY d.submitted_at DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'G47 requires G17 synthetic pending document'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=admin
  AND role='admin'::public.app_role)<>1
 THEN RAISE EXCEPTION 'G47 requires existing G17 admin'; END IF;

 FOR detail IN SELECT unnest(ARRAY[
  'public.mobility_stage_register_driver_document(uuid,uuid,public.mobility_stage_driver_document_kind,text,text,integer,text)',
  'public.mobility_stage_review_driver_document(uuid,uuid,boolean,text,uuid)',
  'public.mobility_stage_read_driver_document_status(uuid)',
  'public.mobility_stage_g47_attest_object_qa(uuid,uuid,text,text,integer)',
  'public.mobility_stage_g47_issue_lease_qa(uuid,uuid,bigint,uuid,uuid,text)',
  'public.mobility_stage_g47_probe_lease_qa(uuid,uuid,bigint,uuid)',
  'public.mobility_stage_g47_revoke_lease_qa(uuid,text)'
 ]) LOOP
  IF pg_catalog.has_function_privilege('service_role',detail,'EXECUTE')
  OR pg_catalog.has_function_privilege('authenticated',detail,'EXECUTE')
  THEN RAISE EXCEPTION 'G47 leaked private RPC %',detail; END IF;
 END LOOP;
 FOR detail IN SELECT unnest(ARRAY[
  'mobility_stage_driver_documents',
  'mobility_stage_driver_document_reviews',
  'mobility_stage_g47_attested_objects',
  'mobility_stage_g47_access_leases',
  'mobility_stage_g47_access_audit'
 ]) LOOP
  IF pg_catalog.has_table_privilege('service_role','public.'||detail,'SELECT')
   OR pg_catalog.has_table_privilege('service_role','public.'||detail,'UPDATE')
   OR pg_catalog.has_table_privilege('service_role','public.'||detail,'INSERT')
   OR pg_catalog.has_table_privilege('authenticated','public.'||detail,'SELECT')
  THEN RAISE EXCEPTION 'G47 private evidence exposed %',detail; END IF;
 END LOOP;

 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g47_issue_lease_qa(
   driver,driver_session,iat,doc.id,r1,'DRIVER_SELF_VIEW');
 EXCEPTION WHEN SQLSTATE 'G4703' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G47 unverified Storage HEAD accepted'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g47_attest_object_qa(
   doc.id,driver,repeat('0',64),doc.mime_type,doc.byte_size);
 EXCEPTION WHEN SQLSTATE 'G4703' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G47 forged checksum accepted'; END IF;
 IF NOT public.mobility_stage_g47_attest_object_qa(
   doc.id,driver,doc.sha256_hex,doc.mime_type,doc.byte_size)
 THEN RAISE EXCEPTION 'G47 owner synthetic metadata attestation failed'; END IF;
 IF NOT public.mobility_stage_g47_attest_object_qa(
   doc.id,driver,doc.sha256_hex,doc.mime_type,doc.byte_size)
 THEN RAISE EXCEPTION 'G47 metadata attest replay failed'; END IF;

 issued:=public.mobility_stage_g47_issue_lease_qa(
  driver,driver_session,iat,doc.id,r1,'DRIVER_SELF_VIEW');
 repeat_issue:=public.mobility_stage_g47_issue_lease_qa(
  driver,driver_session,iat,doc.id,r1,'DRIVER_SELF_VIEW');
 IF issued<>repeat_issue
 OR issued->>'accessMode'<>'QA_PRIVATE_METADATA_ONLY'
 OR issued->>'signedUrlAvailable'<>'false'
 OR issued->>'documentBytesAvailable'<>'false'
 OR issued ? 'objectKey' OR issued ? 'sha256Hex'
 OR issued ? 'url' OR issued ? 'storageBucket'
 THEN RAISE EXCEPTION 'G47 leaked private path or replay duplicated lease'; END IF;
 lease:=(issued->>'leaseId')::uuid;
 IF (public.mobility_stage_g47_probe_lease_qa(
  driver,driver_session,iat,lease)->>'leaseActive')<>'true'
 THEN RAISE EXCEPTION 'G47 valid driver lease not active'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g47_issue_lease_qa(
   admin,admin_session,iat,doc.id,r1,'ADMIN_MANUAL_REVIEW');
 EXCEPTION WHEN SQLSTATE 'G4709' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G47 cross-actor requestKey hijack'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g47_issue_lease_qa(
   outsider,driver_session,iat,doc.id,r3,'DRIVER_SELF_VIEW');
 EXCEPTION WHEN SQLSTATE 'G4701' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G47 foreign actor used driver session'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g47_issue_lease_qa(
   driver,driver_session,iat,doc.id,r3,'ADMIN_MANUAL_REVIEW');
 EXCEPTION WHEN SQLSTATE 'G4703' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G47 driver self-reviewed evidence'; END IF;

 admin_issue:=public.mobility_stage_g47_issue_lease_qa(
  admin,admin_session,iat,doc.id,r2,'ADMIN_MANUAL_REVIEW');
 lease_admin:=(admin_issue->>'leaseId')::uuid;
 IF (public.mobility_stage_g47_probe_lease_qa(
  admin,admin_session,iat,lease_admin)->>'leaseActive')<>'true'
 THEN RAISE EXCEPTION 'G47 approved admin session cannot inspect pending metadata'; END IF;
 IF (public.mobility_stage_g47_probe_lease_qa(
  driver,driver_session,iat,lease_admin)->>'leaseActive')<>'false'
 THEN RAISE EXCEPTION 'G47 cross-role probe sees foreign lease'; END IF;

 IF (SELECT count(*) FROM public.mobility_stage_g47_access_audit
  WHERE lease_id IN(lease,lease_admin) AND action='ISSUED')<>2
 THEN RAISE EXCEPTION 'G47 missing immutable issuance audit'; END IF;
 denied:=false;
 BEGIN
  DELETE FROM public.mobility_stage_g47_access_audit WHERE lease_id=lease;
 EXCEPTION WHEN SQLSTATE 'G4707' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G47 access audit deletion succeeded'; END IF;
 denied:=false;
 BEGIN
  UPDATE public.mobility_stage_g47_access_audit
  SET action='REVOKED' WHERE lease_id=lease;
 EXCEPTION WHEN SQLSTATE 'G4707' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G47 access audit tampering succeeded'; END IF;

 -- Call volatile revocations sequentially: SQL boolean expressions are
 -- not safe to rely upon for procedural evaluation order or side effects.
 IF NOT public.mobility_stage_g47_revoke_lease_qa(lease,'SESSION_REVOKED')
 THEN RAISE EXCEPTION 'G47 initial revocation refused'; END IF;
 IF NOT public.mobility_stage_g47_revoke_lease_qa(lease,'SESSION_REVOKED')
 THEN RAISE EXCEPTION 'G47 same-key revocation retry refused'; END IF;
 IF (public.mobility_stage_g47_probe_lease_qa(
    driver,driver_session,iat,lease)->>'leaseActive')<>'false'
 OR (SELECT count(*) FROM public.mobility_stage_g47_access_audit
     WHERE lease_id=lease AND action='REVOKED')<>1
 THEN RAISE EXCEPTION 'G47 revocation did not invalidate lease once'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g47_issue_lease_qa(
   driver,driver_session,iat,doc.id,r1,'DRIVER_SELF_VIEW');
 EXCEPTION WHEN SQLSTATE 'G4704' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G47 replay resurrected revoked lease'; END IF;
 -- Remaining active lease is denied once real provider grant is revoked.
 UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=pg_catalog.clock_timestamp()
 WHERE user_id=admin AND session_id=admin_session;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g47_probe_lease_qa(
   admin,admin_session,iat,lease_admin);
 EXCEPTION WHEN SQLSTATE 'G4701' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G47 revoked G42 session retained document read'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_g47_access_audit
  WHERE lease_id=lease_admin AND action='ISSUED')<>1
 THEN RAISE EXCEPTION 'G47 provider revocation destroyed history'; END IF;
 RAISE NOTICE 'G47 PASS: private HEAD proof, lease idempotence/role/TTL/revocation and append-only audit';
END $tests$;

SET LOCAL ROLE service_role;
DO $service_attacks$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  SELECT 1 INTO denied FROM public.mobility_stage_driver_documents LIMIT 1;
  denied:=false;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G47 service_role read document metadata'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g47_issue_lease_qa(
   NULL::uuid,NULL::uuid,NULL::bigint,NULL::uuid,NULL::uuid,NULL::text);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G47 service_role called owner-only lease RPC'; END IF;
END $service_attacks$;
RESET ROLE;
ROLLBACK;
