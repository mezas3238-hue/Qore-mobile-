-- G17 exercised on the REAL synthetic G1–G16 disposable PostgreSQL chain.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G17 assertions require disposable CI only'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles
   WHERE user_id='00000000-0000-4000-8000-000000000181'
     AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'G16 exclusive Driver fixture missing'; END IF;
 IF has_table_privilege('authenticated',
  'public.mobility_stage_driver_documents','SELECT')
 OR has_table_privilege('anon',
  'public.mobility_stage_driver_documents','SELECT')
 OR has_table_privilege('authenticated',
  'public.mobility_stage_driver_document_reviews','SELECT')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_register_driver_document(uuid,uuid,public.mobility_stage_driver_document_kind,text,text,integer,text)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_read_driver_document_status(uuid)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_review_driver_document(uuid,uuid,boolean,text,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G17 private document policy exposed to client roles'; END IF;
 IF has_table_privilege('service_role',
    'public.mobility_stage_driver_document_reviews','UPDATE')
 OR has_table_privilege('service_role',
    'public.mobility_stage_driver_document_reviews','DELETE')
 THEN RAISE EXCEPTION 'G17 review audit is writable after initial append'; END IF;
 IF has_column_privilege('service_role',
  'public.mobility_stage_driver_documents','object_key','UPDATE')
 OR has_column_privilege('service_role',
  'public.mobility_stage_driver_documents','driver_id','UPDATE')
 OR has_column_privilege('service_role',
  'public.mobility_stage_driver_documents','sha256_hex','UPDATE')
 OR NOT has_column_privilege('service_role',
  'public.mobility_stage_driver_documents','status','UPDATE')
 THEN RAISE EXCEPTION 'G17 document evidence immutable column privileges broken'; END IF;
 IF NOT has_function_privilege('service_role',
  'public.mobility_stage_register_driver_document(uuid,uuid,public.mobility_stage_driver_document_kind,text,text,integer,text)','EXECUTE')
 THEN RAISE EXCEPTION 'G17 service role cannot record private evidence'; END IF;
END $guard$;

SET ROLE service_role;
DO $test$
DECLARE
 v_driver uuid:='00000000-0000-4000-8000-000000000181';
 v_admin uuid:='00000000-0000-4000-8000-000000000101';
 v_passenger uuid:='00000000-0000-4000-8000-000000000182';
 v_key uuid:='00000000-0000-4000-8000-000000000191';
 v_review_key uuid:='00000000-0000-4000-8000-000000000192';
 v_key2 uuid:='00000000-0000-4000-8000-000000000193';
 v_document uuid;v_second uuid;v_review uuid;n integer;
BEGIN
 -- A trusted server has observed a synthetic private bucket object.
 SELECT public.mobility_stage_register_driver_document(
  v_driver,v_key,'licencia',
  v_driver::text||'/licencia-abcdefghijklmnop.jpg',
  'image/jpeg',8500,repeat('a',64)
 ) INTO v_document;
 IF v_document IS NULL THEN RAISE EXCEPTION 'G17 registration did not persist'; END IF;
 IF (SELECT public.mobility_stage_register_driver_document(
  v_driver,v_key,'licencia',v_driver::text||'/licencia-abcdefghijklmnop.jpg',
  'image/jpeg',8500,repeat('a',64)))<>v_document
 THEN RAISE EXCEPTION 'G17 same observation was not idempotent'; END IF;
 IF (SELECT status FROM public.mobility_stage_driver_documents
     WHERE id=v_document)<>'pending'
 THEN RAISE EXCEPTION 'G17 upload metadata bypassed manual KYC review'; END IF;

 SELECT count(*) INTO n FROM public.mobility_stage_read_driver_document_status(v_driver)
 WHERE kind='licencia' AND status='pending';
 IF n<>1 THEN RAISE EXCEPTION 'G17 Driver cannot read own sanitized state'; END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_driver_document_reviews)
 THEN RAISE EXCEPTION 'G17 unreviewed upload created fake admin audit'; END IF;

 -- Each record stays pending until independent issuer / liveness checks.
 PERFORM public.mobility_stage_register_driver_document(
   v_driver,'00000000-0000-4000-8000-000000000197','identidad_frente',
   v_driver::text||'/identidad_frente-abcdefghijklmnop.jpg',
   'image/jpeg',8500,repeat('b',64));
 PERFORM public.mobility_stage_register_driver_document(
   v_driver,'00000000-0000-4000-8000-000000000198','rostro_selfie',
   v_driver::text||'/rostro_selfie-abcdefghijklmnop.jpg',
   'image/jpeg',8500,repeat('c',64));
 IF (SELECT count(*) FROM public.mobility_stage_read_driver_document_status(v_driver)
   WHERE kind='rostro_selfie' AND status='pending')<>1
 THEN RAISE EXCEPTION 'G17 private selfie record not readable as pending'; END IF;
 -- Driver mismatch and key tampering must always fail; test independent
 -- savepoint subtransactions so the rest of CI can continue.
 BEGIN
  PERFORM public.mobility_stage_register_driver_document(
   v_passenger,'00000000-0000-4000-8000-000000000194','licencia',
   v_passenger::text||'/licencia-abcdefghijklmnop.jpg',
   'image/jpeg',8500,repeat('a',64));
  RAISE EXCEPTION 'BUG: passenger recorded private Driver evidence';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='BUG: passenger recorded private Driver evidence'
   THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.mobility_stage_register_driver_document(
   v_driver,'00000000-0000-4000-8000-000000000195','licencia',
   v_passenger::text||'/licencia-abcdefghijklmnop.jpg',
   'image/jpeg',8500,repeat('a',64));
  RAISE EXCEPTION 'BUG: cross-owner private key accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='BUG: cross-owner private key accepted' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.mobility_stage_register_driver_document(
   v_driver,v_key,'licencia',
   v_driver::text||'/licencia-abcdefghijklmnop.png',
   'image/png',8500,repeat('b',64));
  RAISE EXCEPTION 'BUG: mismatched idempotency payload accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='BUG: mismatched idempotency payload accepted' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.mobility_stage_read_driver_document_status(v_passenger);
  RAISE EXCEPTION 'BUG: passenger read private Driver status';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='BUG: passenger read private Driver status' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.mobility_stage_review_driver_document(
   v_document,v_driver,true,'DOCUMENT_VALID',v_review_key);
  RAISE EXCEPTION 'BUG: Driver self-approved document';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='BUG: Driver self-approved document' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.mobility_stage_review_driver_document(
   v_document,v_passenger,true,'DOCUMENT_VALID',v_review_key);
  RAISE EXCEPTION 'BUG: passenger approved Driver document';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='BUG: passenger approved Driver document' THEN RAISE; END IF;
 END;

 SELECT public.mobility_stage_review_driver_document(
   v_document,v_admin,true,'DOCUMENT_VALID',v_review_key
 ) INTO v_review;
 IF v_review IS NULL OR
  (SELECT status FROM public.mobility_stage_driver_documents WHERE id=v_document)<>'approved'
 THEN RAISE EXCEPTION 'G17 verified admin approval not persisted'; END IF;
 IF (SELECT public.mobility_stage_review_driver_document(
  v_document,v_admin,true,'DOCUMENT_VALID',v_review_key))<>v_review
 THEN RAISE EXCEPTION 'G17 review idempotency failed'; END IF;
 BEGIN
  PERFORM public.mobility_stage_review_driver_document(
   v_document,v_admin,false,'DOCUMENT_REJECTED',
   '00000000-0000-4000-8000-000000000196');
  RAISE EXCEPTION 'BUG: re-review after approved state succeeded';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='BUG: re-review after approved state succeeded' THEN RAISE; END IF;
 END;
 -- A newer independent evidence item may replace the latest visible status.
 SELECT public.mobility_stage_register_driver_document(
  v_driver,v_key2,'licencia',
  v_driver::text||'/licencia-qrstuvwxyzABCDEF.png',
  'image/png',9500,repeat('c',64)) INTO v_second;
 IF v_second=v_document THEN RAISE EXCEPTION 'G17 different object deduped'; END IF;
 SELECT count(*) INTO n FROM public.mobility_stage_read_driver_document_status(v_driver)
 WHERE kind='licencia' AND status='pending';
 IF n<>1 THEN RAISE EXCEPTION 'G17 latest evidence status not shown'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_driver_document_reviews)<>1
 THEN RAISE EXCEPTION 'G17 review audit unexpectedly changed'; END IF;
END $test$;
RESET ROLE;
