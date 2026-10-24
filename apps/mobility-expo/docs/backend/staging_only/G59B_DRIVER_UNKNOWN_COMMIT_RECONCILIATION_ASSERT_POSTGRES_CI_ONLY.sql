DO $check$
DECLARE f text:='public.mobility_stage_g59b_reconcile_driver_owner_qa(text,uuid,uuid,uuid,uuid,bigint,uuid,text)';
 p record; role_name text;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure(f) IS NULL
 THEN RAISE EXCEPTION 'G59B not disposable or not installed'; END IF;
 SELECT pro.prosecdef,pro.proconfig,pro.proowner::regrole::text AS owner INTO p
 FROM pg_catalog.pg_proc pro WHERE pro.oid=to_regprocedure(f);
 IF NOT p.prosecdef OR NOT ('search_path='=ANY(p.proconfig) OR
 'search_path=""'=ANY(p.proconfig)) OR p.owner<>'qore_ci'
 THEN RAISE EXCEPTION 'G59B unsafe security-definer or owner'; END IF;
 FOR role_name IN SELECT unnest(ARRAY[
 'anon','authenticated','service_role','mobility_g48_gateway_ci',
 'mobility_g49_chat_gateway_ci','mobility_g56_driver_gateway_ci',
 'mobility_g58f_exchange_ci','mobility_g58f_definer_ci'])
 LOOP
  IF has_function_privilege(role_name,f,'EXECUTE')
  THEN RAISE EXCEPTION 'G59B direct access to Driver proof leaked: %',role_name; END IF;
 END LOOP;
END $check$;
SELECT 'G59B_DRIVER_QA_OWNER_ONLY_PASS';
