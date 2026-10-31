-- G261 real Supabase STAGING source coverage, READ ONLY.
-- This distinguishes disposable PostgreSQL CI-only business schemas from the
-- persistent PG17 service. Never copy CI-only SECURITY DEFINER functions,
-- synthetic tables, credentials or actor fixtures to persistent STAGING.
-- A missing object is a BLOCKER, not an invitation to mark E2E green.
WITH required_functions(area,name) AS (VALUES
 ('ADMIN','mobility_stage_g75_admin_f1_receipt'),
 ('ADMIN','mobility_stage_g138_auto_trace_qa'),
 ('ADMIN','mobility_stage_g142_moto_trace_qa'),
 ('ADMIN','mobility_stage_g145_delivery_trace_qa'),
 ('ADMIN','mobility_stage_g146_commerce_trace_qa'),
 ('ADMIN','mobility_stage_g27_backoffice_role_of'),
 ('DRIVER','mobility_stage_g169_driver_moto_status_qa'),
 ('DRIVER','mobility_stage_g189_driver_moto_current_qa'),
 ('DRIVER','mobility_stage_g213_moto_driver_step_qa'),
 ('JOURNEY','mobility_stage_g197_read_pickup_qa'),
 ('JOURNEY','mobility_stage_g197_save_pickup_qa'),
 ('JOURNEY','mobility_stage_g198_open_case_qa'),
 ('JOURNEY','mobility_stage_g200_open_case_qa'),
 ('COMMERCE','mobility_stage_g156_merchant_inbox_qa'),
 ('SESSION','mobility_stage_g42_session_active')
), required_tables(area,name) AS (VALUES
 ('AUTO','mobility_stage_auto_demo_trips'),
 ('AUTO','mobility_stage_g72_auto_prequotes'),
 ('AUTO','mobility_stage_g73_auto_routes'),
 ('AUTO','mobility_stage_g93_auto_ledger'),
 ('MOTO','mobility_stage_g100_moto_trips'),
 ('MOTO','mobility_stage_g100_moto_quotes'),
 ('MOTO','mobility_stage_g100_moto_entries'),
 ('DELIVERY','mobility_stage_deliveries'),
 ('DELIVERY','mobility_stage_g122_delivery_price_consents'),
 ('COMMERCE','mobility_stage_merchant_orders'),
 ('COMMERCE','mobility_stage_g45_order_receipts'),
 ('FINANCE','mobility_stage_fare_quotes'),
 ('FINANCE','mobility_stage_fare_rules'),
 ('ADMIN','mobility_stage_backoffice_roles')
), check_functions AS (
 SELECT area,name,
  EXISTS(SELECT 1 FROM pg_catalog.pg_proc p
   JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname=f.name) installed
 FROM required_functions f
), check_tables AS (
 SELECT area,name,pg_catalog.to_regclass('public.'||name) IS NOT NULL installed
 FROM required_tables
)
SELECT jsonb_build_object(
 'test','G261_REAL_STAGING_FIVE_JOURNEY_SOURCE_READINESS',
 'project','mrjzxftsdxzepzbcuids',
 'scope','POSTGRESQL_17_READ_ONLY_NO_LIVE_NO_FIXTURES',
 'functionsPresent',(SELECT count(*) FROM check_functions WHERE installed),
 'functionsExpected',(SELECT count(*) FROM check_functions),
 'missingFunctions',(SELECT jsonb_agg(jsonb_build_object('area',area,'name',name)
  ORDER BY area,name) FROM check_functions WHERE NOT installed),
 'tablesPresent',(SELECT count(*) FROM check_tables WHERE installed),
 'tablesExpected',(SELECT count(*) FROM check_tables),
 'missingTables',(SELECT jsonb_agg(jsonb_build_object('area',area,'name',name)
  ORDER BY area,name) FROM check_tables WHERE NOT installed),
 'authQaUsers',(SELECT count(*) FROM auth.users),
 'providerSessions',(SELECT count(*) FROM auth.sessions),
 'externalFiveJourneysCertified',0,
 'readyForExternalFiveJourneyExecution',false,
 'productionReady',false
) AS qore_g261_staging_readiness;