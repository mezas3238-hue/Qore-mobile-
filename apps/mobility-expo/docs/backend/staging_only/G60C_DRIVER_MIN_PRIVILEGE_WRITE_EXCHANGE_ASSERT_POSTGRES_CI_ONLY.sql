-- G60C: enforce two distinct NOLOGIN roles, single exposed function and fixed definer.
DO $audit$
DECLARE fn text:='public.mobility_stage_g60c_driver_exchange_qa(uuid)';
 rol text; r record;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure(fn) IS NULL
 THEN RAISE EXCEPTION 'G60C assert only disposable install'; END IF;
 FOR rol IN SELECT unnest(ARRAY['mobility_g60c_definer_ci','mobility_g60c_execute_ci'])
 LOOP
  SELECT rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole
   INTO r FROM pg_catalog.pg_roles WHERE rolname=rol;
  IF NOT FOUND OR r.rolcanlogin OR r.rolinherit OR r.rolsuper OR
    r.rolcreatedb OR r.rolcreaterole
  THEN RAISE EXCEPTION 'G60C role has unsafe privileges: %',rol; END IF;
 END LOOP;
 SELECT p.prosecdef,p.proconfig,p.proowner::regrole::text AS owner INTO r
 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(fn);
 IF NOT r.prosecdef OR
 NOT ('search_path='=ANY(r.proconfig) OR 'search_path=""'=ANY(r.proconfig))
 OR r.owner<>'mobility_g60c_definer_ci'
 THEN RAISE EXCEPTION 'G60C exchange unsafe SECURITY DEFINER'; END IF;
 IF NOT has_function_privilege('mobility_g60c_execute_ci',fn,'EXECUTE')
 THEN RAISE EXCEPTION 'G60C minimal exchange caller missing'; END IF;
 FOR rol IN SELECT unnest(ARRAY[
 'anon','authenticated','service_role','mobility_g48_gateway_ci',
 'mobility_g49_chat_gateway_ci','mobility_g56_driver_gateway_ci',
 'mobility_g58f_exchange_ci','mobility_g58f_definer_ci',
 'mobility_g60c_definer_ci'])
 LOOP
  IF has_function_privilege(rol,fn,'EXECUTE')
  THEN RAISE EXCEPTION 'G60C unauthorized exchange caller %',rol; END IF;
 END LOOP;
 FOR rol IN SELECT unnest(ARRAY[
 'mobility_g60c_execute_ci','mobility_g58f_exchange_ci',
 'mobility_g56_driver_gateway_ci','service_role','authenticated'])
 LOOP
  IF has_table_privilege(rol,'public.mobility_stage_g60c_driver_proofs','SELECT')
  OR has_table_privilege(rol,'public.mobility_stage_g60c_driver_proofs','INSERT')
  THEN RAISE EXCEPTION 'G60C attested scope leak to %',rol; END IF;
 END LOOP;
 IF has_schema_privilege('mobility_g60c_execute_ci','public','CREATE')
 OR has_schema_privilege('mobility_g60c_definer_ci','public','CREATE')
 THEN RAISE EXCEPTION 'G60C SQL role can create untrusted functions'; END IF;
END $audit$;
SELECT 'G60C_LEAST_PRIVILEGE_PASS';
