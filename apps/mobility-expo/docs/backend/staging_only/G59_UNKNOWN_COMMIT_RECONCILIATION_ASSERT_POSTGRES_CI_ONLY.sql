-- G59/A47 deny direct access, require fixed SECURITY DEFINER and QA only.
DO $verify$
DECLARE spec text:=
 'public.mobility_stage_g59_reconcile_passenger_owner_qa(text,uuid,uuid,uuid,uuid,bigint,uuid,text)';
 p record; name text;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure(spec) IS NULL
 THEN RAISE EXCEPTION 'G59 assert requires disposable G59'; END IF;
 SELECT pro.prosecdef,pro.proconfig,pro.proowner::regrole::text AS owner
 INTO p FROM pg_catalog.pg_proc pro WHERE pro.oid=to_regprocedure(spec);
 IF NOT p.prosecdef OR NOT ('search_path='=ANY(p.proconfig)
  OR 'search_path=""'=ANY(p.proconfig))
 OR p.owner<>'qore_ci'
 THEN RAISE EXCEPTION 'G59 unsafe definer or search_path: %',p; END IF;
 FOR name IN SELECT unnest(ARRAY[
 'anon','authenticated','service_role','mobility_g48_gateway_ci',
 'mobility_g49_chat_gateway_ci','mobility_g56_driver_gateway_ci',
 'mobility_g58f_exchange_ci','mobility_g58f_definer_ci'])
 LOOP
  IF has_function_privilege(name,spec,'EXECUTE')
  THEN RAISE EXCEPTION 'G59 SQL reconciliation exposed to %',name; END IF;
 END LOOP;
 IF NOT has_function_privilege('qore_ci',spec,'EXECUTE')
 THEN RAISE EXCEPTION 'G59 owner-only fixture missing'; END IF;
END $verify$;
SELECT 'G59_OWNER_ONLY_QA_PASS' AS result;
