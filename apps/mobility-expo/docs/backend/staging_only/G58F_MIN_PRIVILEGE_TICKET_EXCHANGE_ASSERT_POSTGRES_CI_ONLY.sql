-- G58F/A46 disposable PostgreSQL least-privilege assertions.
DO $assert$
DECLARE role_name text; fn text; p record; f text:=
 'public.mobility_stage_g58f_exchange_attestation_qa(uuid)';
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G58F asserts refuse non-QA database'; END IF;
 IF to_regclass('public.mobility_stage_g58f_owner_attestations') IS NULL
 OR to_regprocedure(f) IS NULL
 THEN RAISE EXCEPTION 'G58F installation missing'; END IF;
 FOR role_name IN SELECT unnest(ARRAY[
   'mobility_g58f_definer_ci','mobility_g58f_exchange_ci'])
 LOOP
  IF (SELECT rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole
     OR rolreplication OR rolinherit FROM pg_catalog.pg_roles
     WHERE rolname=role_name) IS DISTINCT FROM false
  THEN RAISE EXCEPTION 'G58F elevated role %',role_name; END IF;
  IF pg_catalog.has_schema_privilege(role_name,'public','CREATE')
  THEN RAISE EXCEPTION 'G58F role retained schema CREATE %',role_name; END IF;
 END LOOP;
 SELECT proc.prosecdef, proc.proowner::pg_catalog.regrole::text AS owner,
   proc.proconfig AS config INTO p
 FROM pg_catalog.pg_proc proc WHERE proc.oid=to_regprocedure(f);
 IF NOT p.prosecdef OR p.owner<>'mobility_g58f_definer_ci'
 OR NOT (('search_path='=ANY(p.config)) OR ('search_path=""'=ANY(p.config)))
 THEN RAISE EXCEPTION 'G58F exchange has unsafe owner/search_path/definer: sec=%, owner=%, config=%',p.prosecdef,p.owner,p.config; END IF;
 IF (SELECT relrowsecurity FROM pg_catalog.pg_class
   WHERE oid='public.mobility_stage_g58f_owner_attestations'::regclass)
 IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'G58F RLS disabled'; END IF;
 IF (SELECT relowner::regrole::text FROM pg_catalog.pg_class
   WHERE oid='public.mobility_stage_g58f_owner_attestations'::regclass)
 <>'mobility_g58f_definer_ci'
 THEN RAISE EXCEPTION 'G58F table owner is too broad'; END IF;
 FOR role_name IN SELECT unnest(ARRAY[
  'anon','authenticated','service_role',
  'mobility_g48_gateway_ci','mobility_g49_chat_gateway_ci',
  'mobility_g56_driver_gateway_ci'])
 LOOP
  IF has_function_privilege(role_name,f,'EXECUTE') OR
   has_table_privilege(role_name,
    'public.mobility_stage_g58f_owner_attestations','SELECT') OR
   has_table_privilege(role_name,
    'public.mobility_stage_g58f_owner_attestations','INSERT') OR
   has_table_privilege(role_name,
    'public.mobility_stage_g58f_owner_attestations','UPDATE')
  THEN RAISE EXCEPTION 'G58F public/legacy-role privilege leaked: %',role_name; END IF;
 END LOOP;
 IF NOT has_function_privilege('mobility_g58f_exchange_ci',f,'EXECUTE')
 THEN RAISE EXCEPTION 'G58F exchange role missing single intended grant'; END IF;
 IF has_table_privilege('mobility_g58f_exchange_ci',
  'public.mobility_stage_g58f_owner_attestations','SELECT')
 OR has_table_privilege('mobility_g58f_exchange_ci',
  'public.mobility_stage_g58f_owner_attestations','UPDATE')
 THEN RAISE EXCEPTION 'G58F exchange can inspect raw attestation'; END IF;
 FOREACH fn IN ARRAY ARRAY[
  'public.mobility_stage_g42_lock_session(uuid,uuid,bigint)',
  'public.mobility_stage_g49_mint_owner_qa(uuid,uuid,bigint,text,text,uuid,uuid)',
  'public.mobility_stage_g54_mint_owner_qa(uuid,uuid,bigint,text,uuid)',
  'public.mobility_stage_g56_mint_owner_qa(uuid,uuid,bigint,text,text,uuid,uuid)',
  'public.mobility_stage_g56_inbox_mint_owner_qa(uuid,uuid,bigint)',
  'public.mobility_stage_g57b_mint_read_owner_qa(uuid,uuid,bigint,uuid)'
 ] LOOP
  IF has_function_privilege('mobility_g58f_exchange_ci',fn,'EXECUTE')
  THEN RAISE EXCEPTION 'G58F caller can bypass attested exchange: %',fn; END IF;
  IF NOT has_function_privilege('mobility_g58f_definer_ci',fn,'EXECUTE')
  THEN RAISE EXCEPTION 'G58F restricted definer lacks narrow internal grant: %',fn; END IF;
 END LOOP;
 IF has_table_privilege('mobility_g58f_definer_ci',
    'public.mobility_stage_g50_chat_messages','SELECT')
 OR has_table_privilege('mobility_g58f_definer_ci',
    'public.mobility_stage_g42_provider_session_grants','UPDATE')
 THEN RAISE EXCEPTION 'G58F definer has excessive private table rights'; END IF;
END $assert$;
SELECT 'G58F_PRIVILEGES_PASS_QA_ONLY' AS result;
