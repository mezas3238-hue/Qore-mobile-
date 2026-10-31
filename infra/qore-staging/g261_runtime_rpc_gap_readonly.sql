-- G261: real G4 / G73 / G101 / G112 / G113 runtime RPC presence, STAGING ONLY.
-- READ ONLY. This is NOT permission to install PostgreSQL16 CI-only SQL.
-- A present RPC is not proof of correct behavior, JWT, legal KYC or E2E.
WITH expected(area, rpc) AS (
 VALUES
 ('G4_MAIN','mobility_stage_g155_submit_rating_qa'),
 ('G4_MAIN','mobility_stage_g156_merchant_inbox_qa'),
 ('G4_MAIN','mobility_stage_g205_accept_original_auto_qa'),
 ('G4_MAIN','mobility_stage_auto_demo_decline_offer'),
 ('G4_MAIN','mobility_stage_g177_driver_auto_step_qa'),
 ('G4_MAIN','mobility_stage_g125_record_cargo_road_qa'),
 ('G4_MAIN','mobility_stage_g169_driver_moto_status_qa'),
 ('G4_MAIN','mobility_stage_g189_driver_moto_current_qa'),
 ('G4_MAIN','mobility_stage_g213_moto_driver_step_qa'),
 ('G4_MAIN','mobility_stage_g27_backoffice_role_of'),
 ('G4_MAIN','mobility_stage_g27_backoffice_has_scope'),
 ('G4_MAIN','mobility_stage_g157_admin_review_queue_qa'),
 ('G4_MAIN','mobility_stage_g138_auto_trace_qa'),
 ('G4_MAIN','mobility_stage_g142_moto_trace_qa'),
 ('G4_MAIN','mobility_stage_g145_delivery_trace_qa'),
 ('G4_MAIN','mobility_stage_g219_active_delivery_trace_qa'),
 ('G4_MAIN','mobility_stage_g216_completed_delivery_trace_qa'),
 ('G4_MAIN','mobility_stage_g146_commerce_trace_qa'),
 ('AUTO_F1','mobility_stage_g73_route'),
 ('AUTO_F1','mobility_stage_g73_route_receipt'),
 ('AUTO_F1','mobility_stage_g73_quote'),
 ('AUTO_F1','mobility_stage_g73_quote_receipt'),
 ('AUTO_F1','mobility_stage_g73_book'),
 ('AUTO_F1','mobility_stage_g90_passenger_dispatch_status_qa'),
 ('AUTO_F1','mobility_stage_g93_preview_auto_qa'),
 ('AUTO_F1','mobility_stage_g95_cancel_booked_auto_qa'),
 ('AUTO_F1','mobility_stage_g95_cancel_receipt_qa'),
 ('AUTO_F1','mobility_stage_g94_auto_financial_state_qa'),
 ('AUTO_F1','mobility_stage_g93_settlement_receipt_qa'),
 ('AUTO_F1','mobility_stage_g73_booking_receipt'),
 ('AUTO_DISPATCH','mobility_stage_g112_run_booked_auto_dispatch_qa'),
 ('AUTO_RETRY','mobility_stage_g113_run_due_auto_batch_qa'),
 ('DELIVERY_QUOTES','mobility_stage_delivery_request'),
 ('DELIVERY_QUOTES','mobility_stage_g122_accept_delivery_quote_qa'),
 ('DELIVERY_QUOTES','mobility_stage_delivery_accept'),
 ('DELIVERY_QUOTES','mobility_stage_delivery_transition'),
 ('FINANCE_QUOTES','mobility_stage_g126_recover_cargo_quote_qa'),
 ('FINANCE_QUOTES','mobility_stage_fare_quote'),
 ('FINANCE_QUOTES','mobility_stage_payment_authorize'),
 ('FINANCE_QUOTES','mobility_stage_payment_transition')
), audit AS (
 SELECT e.area,e.rpc,
 EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname=e.rpc) AS installed,
 EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname=e.rpc AND
   has_function_privilege('service_role',p.oid,'EXECUTE')) AS server_can_execute
 FROM expected e
)
SELECT jsonb_build_object(
 'audit','G261_RUNTIME_RPC_GAP_PG17_READ_ONLY',
 'scope','STAGING_ONLY_NOT_E2E',
 'requiredCallSites',(SELECT count(*) FROM audit),
 'installedCallSites',(SELECT count(*) FROM audit WHERE installed),
 'missingCallSites',(SELECT count(*) FROM audit WHERE NOT installed),
 'serverExecutableCallSites',(SELECT count(*) FROM audit WHERE server_can_execute),
 'missing',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'area',area,'rpc',rpc) ORDER BY area,rpc),'[]'::jsonb)
  FROM audit WHERE NOT installed),
 'byArea',(SELECT jsonb_agg(to_jsonb(s) ORDER BY area) FROM (
  SELECT area,count(*) AS call_sites,
   count(*) FILTER(WHERE installed) AS installed,
   count(*) FILTER(WHERE NOT installed) AS missing
  FROM audit GROUP BY area
 ) s),
 'launchReady',false,
 'externalJourneysCertified',0,
 'commercialMode',false
) AS report;