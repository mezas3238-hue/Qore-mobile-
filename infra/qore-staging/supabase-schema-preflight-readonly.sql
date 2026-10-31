-- G229 Supabase STAGING: READ-ONLY schema/RLS inventory for a NEW project.
-- This is not a migration and MUST NEVER import CI_ONLY synthetic fixtures.
-- Execute as an authorized staging database operator, never from a mobile app.
WITH required(name) AS (
 VALUES
 ('profiles'),('user_roles'),('driver_locations'),
 ('mobility_stage_auto_demo_trips'),
 ('mobility_stage_auto_demo_offers'),
 ('mobility_stage_auto_demo_events'),
 ('mobility_stage_auto_demo_push_outbox'),
 ('mobility_stage_delivery_vehicle_clearance'),
 ('mobility_stage_deliveries'),
 ('mobility_stage_delivery_events'),
 ('mobility_stage_merchants'),
 ('mobility_stage_merchant_staff'),
 ('mobility_stage_merchant_branches'),
 ('mobility_stage_catalog_items'),
 ('mobility_stage_merchant_orders'),
 ('mobility_stage_merchant_order_lines'),
 ('mobility_stage_merchant_order_events'),
 ('mobility_stage_fare_rules'),
 ('mobility_stage_fare_quotes'),
 ('mobility_stage_payment_intents'),
 ('mobility_stage_payment_operations'),
 ('mobility_stage_ledger_entries'),
 ('mobility_stage_safety_incidents'),
 ('mobility_stage_safety_incident_events'),
 ('mobility_stage_operational_suspensions'),
 ('mobility_stage_suspension_events'),
 ('mobility_stage_merchant_management_events'),
 ('mobility_stage_delivery_offers'),
 ('mobility_stage_delivery_offer_outbox'),
 ('mobility_stage_driver_documents'),
 ('mobility_stage_driver_document_reviews'),
 ('mobility_stage_driver_enrollments')
), state AS (
 SELECT r.name, c.oid, c.relrowsecurity,
   c.oid IS NOT NULL AS exists_on_stage,
   CASE WHEN c.oid IS NULL THEN false ELSE
    has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE') END AS anon_write,
   CASE WHEN c.oid IS NULL THEN false ELSE
    has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') END AS authenticated_write
 FROM required r
 LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid
   AND c.relname=r.name AND c.relkind IN ('r','p')
)
SELECT jsonb_build_object(
 'inspection','QORE_G229_STAGING_READ_ONLY',
 'database',current_database(),
 'requiredTables',(SELECT count(*) FROM state),
 'missingTables',(SELECT coalesce(jsonb_agg(name ORDER BY name),'[]'::jsonb)
                   FROM state WHERE NOT exists_on_stage),
 'rlsNotEnabled',(SELECT coalesce(jsonb_agg(name ORDER BY name),'[]'::jsonb)
                  FROM state WHERE exists_on_stage AND NOT relrowsecurity),
 'unexpectedDirectWrites',(SELECT coalesce(jsonb_agg(name ORDER BY name),'[]'::jsonb)
                  FROM state WHERE anon_write OR authenticated_write),
 'supabaseAuthPresent',to_regclass('auth.users') IS NOT NULL
                         AND to_regclass('auth.sessions') IS NOT NULL,
 'source','schema only; no real accounts or KYC/PSP/GPS certifications',
 'commercialLaunchAllowed',false
) AS staging_readiness_report;
