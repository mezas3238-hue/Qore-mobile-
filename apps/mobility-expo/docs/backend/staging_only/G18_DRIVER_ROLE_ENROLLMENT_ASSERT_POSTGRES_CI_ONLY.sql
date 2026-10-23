-- G18 integration on disposable real G1-G17 schema; no real users.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G18 tests refuse non-disposable PostgreSQL'; END IF;
 IF has_table_privilege('authenticated',
  'public.mobility_stage_driver_enrollments','SELECT')
 OR has_table_privilege('anon',
  'public.mobility_stage_driver_enrollments','SELECT')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_enroll_exclusive_driver(uuid,uuid,boolean)','EXECUTE')
 OR has_function_privilege('anon',
  'public.mobility_stage_enroll_exclusive_driver(uuid,uuid,boolean)','EXECUTE')
 THEN RAISE EXCEPTION 'G18 Driver enrollment exposed to client SQL'; END IF;
 IF has_table_privilege('service_role',
  'public.mobility_stage_driver_enrollments','UPDATE')
 OR has_table_privilege('service_role',
  'public.mobility_stage_driver_enrollments','DELETE')
 THEN RAISE EXCEPTION 'G18 enrollment audit is mutable'; END IF;
END $guard$;

INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-000000000203');
INSERT INTO public.user_roles(user_id,role)
 VALUES('00000000-0000-4000-8000-000000000203','driver');

SET ROLE service_role;
DO $assert$
DECLARE new_driver uuid:='00000000-0000-4000-8000-000000000183';
 key uuid:='00000000-0000-4000-8000-000000000204';
 used_passenger uuid:='00000000-0000-4000-8000-000000000182';
 dual_user uuid:='00000000-0000-4000-8000-000000000203';
 administrator uuid:='00000000-0000-4000-8000-000000000101';
 audit_id uuid;n integer;
BEGIN
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=new_driver)<>1
  OR NOT EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id=new_driver AND role='passenger')
 THEN RAISE EXCEPTION 'G18 synthetic clean passenger account missing'; END IF;
 BEGIN
  PERFORM public.mobility_stage_enroll_exclusive_driver(new_driver,key,false);
  RAISE EXCEPTION 'BUG: conversion without consent permitted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='BUG: conversion without consent permitted' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.mobility_stage_enroll_exclusive_driver(used_passenger,
   '00000000-0000-4000-8000-000000000205',true);
  RAISE EXCEPTION 'BUG: old passenger trip converted to Driver';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='BUG: old passenger trip converted to Driver' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.mobility_stage_enroll_exclusive_driver(administrator,
   '00000000-0000-4000-8000-000000000206',true);
  RAISE EXCEPTION 'BUG: admin converted to Driver';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='BUG: admin converted to Driver' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.mobility_stage_enroll_exclusive_driver(dual_user,
   '00000000-0000-4000-8000-000000000207',true);
  RAISE EXCEPTION 'BUG: mixed-role account converted to Driver';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='BUG: mixed-role account converted to Driver' THEN RAISE; END IF;
 END;
 SELECT public.mobility_stage_enroll_exclusive_driver(new_driver,key,true)
 INTO audit_id;
 IF audit_id IS NULL THEN RAISE EXCEPTION 'G18 missing enrollment receipt'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=new_driver)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
   WHERE user_id=new_driver AND role='driver')
 THEN RAISE EXCEPTION 'G18 did not atomically replace passenger role'; END IF;
 IF (SELECT public.mobility_stage_enroll_exclusive_driver(
   new_driver,key,true))<>audit_id
 THEN RAISE EXCEPTION 'G18 role conversion idempotency lost'; END IF;
 BEGIN
  PERFORM public.mobility_stage_enroll_exclusive_driver(new_driver,
   '00000000-0000-4000-8000-000000000208',true);
  RAISE EXCEPTION 'BUG: Driver enrolled twice under another key';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='BUG: Driver enrolled twice under another key' THEN RAISE; END IF;
 END;
 IF (SELECT status FROM public.mobility_stage_driver_enrollments
   WHERE id=audit_id)<>'pending_compliance'
 THEN RAISE EXCEPTION 'G18 silently marked Driver as approved'; END IF;
 SELECT count(*) INTO n FROM public.mobility_stage_read_driver_document_status(new_driver);
 IF n<>0 THEN RAISE EXCEPTION 'G18 fabricated verified Driver KYC documents'; END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_driver_compliance
   WHERE driver_id=new_driver)
 THEN RAISE EXCEPTION 'G18 silently created compliant driving license'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_driver_enrollments
   WHERE driver_id=new_driver)<>1
 THEN RAISE EXCEPTION 'G18 duplicate conversion audit'; END IF;
END $assert$;
RESET ROLE;
