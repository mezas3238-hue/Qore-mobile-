-- G257: Supabase STAGING PostgreSQL 17 transactional RPC privilege audit.
-- READ ONLY. Presence is not equivalent to E2E, valid KYC or runtime readiness.
-- This file intentionally contains no service key, synthetic data or mutations.
WITH expected(rpc) AS (
 VALUES
 ('mobility_stage_auto_demo_request'),
 ('mobility_stage_auto_demo_accept_offer'),
 ('mobility_stage_auto_demo_transition'),
 ('mobility_stage_delivery_request'),
 ('mobility_stage_delivery_accept_offer'),
 ('mobility_stage_delivery_transition'),
 ('mobility_stage_merchant_order_request'),
 ('mobility_stage_merchant_order_transition'),
 ('mobility_stage_merchant_order_attach_delivery'),
 ('mobility_stage_g156_merchant_inbox_qa'),
 ('mobility_stage_g42_session_active'),
 ('mobility_stage_g42_lock_session')
), actual AS (
 SELECT e.rpc,p.oid AS function_oid,p.prosecdef AS security_definer
 FROM expected e
 LEFT JOIN pg_catalog.pg_proc p ON p.proname=e.rpc
  AND p.pronamespace='public'::regnamespace
), tests AS (
 SELECT rpc,
  COUNT(function_oid) AS overload_count,
  COALESCE(bool_and(NOT security_definer),false) AS invoker_only,
  COALESCE(bool_and(has_function_privilege('service_role',function_oid,'EXECUTE')),false) AS service_role_can_run,
  COALESCE(bool_or(has_function_privilege('anon',function_oid,'EXECUTE')),false) AS anon_can_run,
  COALESCE(bool_or(has_function_privilege('authenticated',function_oid,'EXECUTE')),false) AS client_can_run
 FROM actual GROUP BY rpc
)
SELECT jsonb_build_object(
 'test','G257_EXTERNAL_PG17_RPC_PRIVILEGE_AUDIT',
 'mode','STAGING_READ_ONLY_NOT_E2E',
 'rpcExpected',12,
 'rpcPresent',(SELECT count(*) FROM tests WHERE overload_count=1),
 'allInvokerOnly',COALESCE((SELECT bool_and(invoker_only) FROM tests),false),
 'allServiceRoleExecutable',COALESCE((SELECT bool_and(service_role_can_run) FROM tests),false),
 'allDirectClientExecutionsDenied',
  COALESCE((SELECT bool_and(NOT anon_can_run AND NOT client_can_run) FROM tests),false),
 'registeredAuthUsers',(SELECT count(*) FROM auth.users),
 'providerSessions',(SELECT count(*) FROM auth.sessions),
 'details',(SELECT jsonb_agg(to_jsonb(t) ORDER BY rpc) FROM tests t),
 'certifiesExternalJourney',false,
 'productionEnabled',false
) AS result;
