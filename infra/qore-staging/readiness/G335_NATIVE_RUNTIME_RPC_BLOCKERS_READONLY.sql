-- G335 · STAGING PG17 · READ ONLY · CURRENT RUNTIME RPC COVERAGE
-- Verified against 2026-11-13 Supabase STAGING. Inventory is NOT a certification.
-- This does not mutate persistent state, install historical CI_ONLY objects,
-- grant roles, change deployment flags, or issue synthetic journeys.
-- Source contracts: G331 g73/g101/g5/g6 repositories, G329, G262 and G333.
-- Catalog-name presence is insufficient to prove arguments, RLS, execute grants,
-- authentication, AAL2, PSP, human KYC, route coverage, or external journeys.
WITH expected(service,kind,object_name) AS (VALUES
 ('AUTO','table','mobility_stage_g73_auto_routes'),
 ('AUTO','table','mobility_stage_g262_auto_prequotes'),
 ('AUTO','rpc','mobility_stage_g73_route'),
 ('AUTO','rpc','mobility_stage_g73_quote'),
 ('AUTO','rpc','mobility_stage_g73_book'),
 ('AUTO_PIN','table','mobility_stage_g329_auto_pinned_routes'),
 ('AUTO_PIN','rpc','mobility_stage_g329_route_pinned_receipt'),
 ('MOTO','rpc','mobility_stage_g100_moto_quote_qa'),
 ('MOTO','rpc','mobility_stage_g100_moto_book_qa'),
 ('MOTO','rpc','mobility_stage_g100_moto_booking_receipt_qa'),
 ('MOTO','rpc','mobility_stage_g118_moto_status_qa'),
 ('MOTO','rpc','mobility_stage_g100_moto_cancel_qa'),
 ('DELIVERY','table','mobility_stage_deliveries'),
 ('DELIVERY','rpc','mobility_stage_delivery_request'),
 ('DELIVERY','rpc','mobility_stage_delivery_accept'),
 ('DELIVERY','rpc','mobility_stage_delivery_transition'),
 ('DELIVERY','rpc','mobility_stage_g122_accept_delivery_quote_qa'),
 ('COMMERCE','table','mobility_stage_merchant_orders'),
 ('COMMERCE','rpc','mobility_stage_merchant_order_request'),
 ('COMMERCE','rpc','mobility_stage_merchant_order_transition'),
 ('COMMERCE','rpc','mobility_stage_merchant_order_attach_delivery'),
 ('ADMIN','rpc','mobility_stage_g262_admin_native_trace_qa'),
 ('ADMIN','rpc','mobility_stage_g75_admin_f1_receipt')
), observed AS (
 SELECT service,kind,object_name,
 CASE WHEN kind='table' THEN EXISTS (
  SELECT 1 FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','qore_stage_internal')
   AND c.relname=object_name AND c.relkind IN ('r','p')
 ) ELSE EXISTS (
  SELECT 1 FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','qore_stage_internal')
   AND p.proname=object_name
 ) END AS present FROM expected
)
SELECT service,
 count(*) FILTER (WHERE present) AS objects_present,
 count(*) FILTER (WHERE NOT present) AS objects_missing,
 coalesce(jsonb_agg(object_name ORDER BY object_name)
   FILTER (WHERE NOT present),'[]'::jsonb) AS missing_names,
 false AS external_e2e_certified
FROM observed
GROUP BY service ORDER BY service;
