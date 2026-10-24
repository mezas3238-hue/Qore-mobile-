-- G67 secure footprint and tenant segregation, executed AFTER migration.
DO $guard$
DECLARE role_name text;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G67 assertions refuse non-disposable DB'; END IF;
 IF to_regclass('public.mobility_stage_g67_delivery_proofs') IS NULL
 OR to_regprocedure('public.mobility_stage_g67_enforce_delivery_proof()') IS NULL
 THEN RAISE EXCEPTION 'G67 SQL missing'; END IF;
 IF (SELECT relrowsecurity FROM pg_catalog.pg_class
 WHERE oid='public.mobility_stage_g67_delivery_proofs'::regclass) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'G67 private registry missing RLS'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger
 WHERE tgrelid='public.mobility_stage_deliveries'::regclass
 AND tgname='mobility_stage_g67_proof_at_commit' AND tgenabled='O')
 THEN RAISE EXCEPTION 'G67 delivery trigger disabled'; END IF;
 FOR role_name IN SELECT unnest(ARRAY['PUBLIC','anon','authenticated','service_role',
 'mobility_g48_gateway_ci','mobility_g56_driver_gateway_ci',
 'mobility_g60c_execute_ci']) LOOP
  IF role_name<>'PUBLIC' AND NOT EXISTS(
   SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name)
  THEN RAISE EXCEPTION 'G67 missing gateway role %',role_name; END IF;
  IF pg_catalog.has_table_privilege(role_name,'public.mobility_stage_g67_delivery_proofs',
   'SELECT') OR pg_catalog.has_table_privilege(role_name,'public.mobility_stage_g67_delivery_proofs',
   'INSERT') OR pg_catalog.has_table_privilege(role_name,'public.mobility_stage_g67_delivery_proofs',
   'UPDATE') OR pg_catalog.has_table_privilege(role_name,'public.mobility_stage_g67_delivery_proofs',
   'DELETE')
  THEN RAISE EXCEPTION 'G67 registry table privilege leaked to %',role_name; END IF;
  IF pg_catalog.has_function_privilege(role_name,
   'public.mobility_stage_g67_register_proof_owner_qa(uuid,uuid,uuid,bigint,uuid,text,text,bigint,timestamptz)','EXECUTE')
  OR pg_catalog.has_function_privilege(role_name,
   'public.mobility_stage_g67_revoke_proof_owner_qa(uuid,uuid)','EXECUTE')
  OR pg_catalog.has_function_privilege(role_name,
   'public.mobility_stage_g67_proof_verified_owner_qa(uuid,uuid,uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'G67 owner-only RPC leaked to %',role_name; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p
 WHERE p.oid IN (
  'public.mobility_stage_g67_register_proof_owner_qa(uuid,uuid,uuid,bigint,uuid,text,text,bigint,timestamptz)'::regprocedure,
  'public.mobility_stage_g67_revoke_proof_owner_qa(uuid,uuid)'::regprocedure,
  'public.mobility_stage_g67_enforce_delivery_proof()'::regprocedure
 ) AND (NOT p.prosecdef OR p.proconfig IS NULL OR
  NOT (p.proconfig @> ARRAY['search_path=']::text[])))
 THEN RAISE EXCEPTION 'G67 owner functions must have SECURITY DEFINER with search_path empty'; END IF;
 RAISE NOTICE 'G67 PASS: RLS, trigger, owner-only registry and forbidden roles';
END $guard$;
