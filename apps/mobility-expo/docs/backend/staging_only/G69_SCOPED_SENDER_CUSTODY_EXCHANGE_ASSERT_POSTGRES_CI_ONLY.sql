-- G69 least-privilege static grants; tested after installation PG16 CI.
DO $g$
DECLARE role_name text;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G69 refuses shared DB'; END IF;
 IF to_regprocedure('public.mobility_stage_g69_sender_exchange_qa(uuid)') IS NULL
 OR to_regclass('public.mobility_stage_g69_sender_read_proofs') IS NULL
 THEN RAISE EXCEPTION 'G69 exchange not installed'; END IF;
 IF (SELECT relrowsecurity FROM pg_catalog.pg_class
  WHERE oid='public.mobility_stage_g69_sender_read_proofs'::regclass)
 IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'G69 proof registry lacks RLS'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM pg_catalog.pg_proc
  WHERE oid='public.mobility_stage_g69_sender_exchange_qa(uuid)'::regprocedure
  AND prosecdef AND EXISTS(
    SELECT 1 FROM pg_catalog.unnest(proconfig) AS setting(value)
    WHERE setting.value IN ('search_path=','search_path=""'))
 ) THEN RAISE EXCEPTION 'G69 definer search_path is not empty'; END IF;
 IF (SELECT rolcanlogin FROM pg_catalog.pg_roles
  WHERE rolname='mobility_g69_execute_ci') IS DISTINCT FROM false
 OR (SELECT rolcanlogin FROM pg_catalog.pg_roles
  WHERE rolname='mobility_g69_definer_ci') IS DISTINCT FROM false
 OR (SELECT rolcreaterole FROM pg_catalog.pg_roles
  WHERE rolname='mobility_g69_execute_ci') IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'G69 roles must be NOLOGIN without escalation'; END IF;
 IF NOT pg_catalog.has_function_privilege('mobility_g69_execute_ci',
  'public.mobility_stage_g69_sender_exchange_qa(uuid)','EXECUTE')
 OR pg_catalog.has_function_privilege('mobility_g69_execute_ci',
  'public.mobility_stage_g68_sender_custody_owner_qa(uuid,uuid,bigint,uuid)','EXECUTE')
 OR pg_catalog.has_table_privilege('mobility_g69_execute_ci',
  'public.mobility_stage_g69_sender_read_proofs','SELECT')
 THEN RAISE EXCEPTION 'G69 delegated privileges not minimal'; END IF;
 FOR role_name IN SELECT unnest(ARRAY['anon','authenticated','service_role',
  'mobility_g48_gateway_ci','mobility_g49_chat_gateway_ci',
  'mobility_g56_driver_gateway_ci','mobility_g60c_execute_ci',
  'mobility_g60c_definer_ci']) LOOP
  IF pg_catalog.has_function_privilege(role_name,
   'public.mobility_stage_g69_sender_exchange_qa(uuid)','EXECUTE')
  OR pg_catalog.has_table_privilege(role_name,
   'public.mobility_stage_g69_sender_read_proofs','SELECT')
  OR pg_catalog.has_table_privilege(role_name,
   'public.mobility_stage_g69_sender_read_proofs','INSERT')
  OR pg_catalog.has_table_privilege(role_name,
   'public.mobility_stage_g69_sender_read_proofs','UPDATE')
  THEN RAISE EXCEPTION 'G69 leaked permission to %',role_name; END IF;
 END LOOP;
 RAISE NOTICE 'G69 PASS: NOLOGIN delegated execute only, RLS and no mint or owner read access';
END $g$;
