-- G246 read-only Supabase-native STAGING audit, not a deployment approval.
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
),
state AS (
 SELECT r.name,c.oid,c.relrowsecurity AS rls,
  c.oid IS NOT NULL AS present,
  COALESCE(has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE'),false) AS anon_access,
  COALESCE(has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE'),false) AS user_write
 FROM required r LEFT JOIN pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=r.name AND c.relkind='r'
),
commerce(name) AS (
 VALUES ('mobility_stage_merchants'),('mobility_stage_merchant_staff'),
 ('mobility_stage_merchant_branches'),('mobility_stage_catalog_items'),
 ('mobility_stage_merchant_orders'),('mobility_stage_merchant_order_lines'),
 ('mobility_stage_merchant_order_events'),('mobility_stage_merchant_management_events')
)
SELECT jsonb_build_object(
 'inspection','QORE_G246_EXTERNAL_QA_GATE',
 'requiredTables',(SELECT count(*) FROM state),
 'presentTables',(SELECT count(*) FROM state WHERE present),
 'rlsEnabled',(SELECT count(*) FROM state WHERE rls),
 'anonAccess',(SELECT count(*) FROM state WHERE anon_access),
 'directClientWrites',(SELECT count(*) FROM state WHERE user_write),
 'merchantBackendUnsafeWriteGrants',(SELECT count(*) FROM commerce
  WHERE has_table_privilege('service_role',format('public.%I',name),'INSERT,UPDATE,DELETE')),
 'merchantOwnMembershipReadOnly',has_table_privilege('authenticated','public.mobility_stage_merchant_staff','SELECT')
   AND NOT has_table_privilege('authenticated','public.mobility_stage_merchant_staff','INSERT,UPDATE,DELETE')
   AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='mobility_stage_merchant_staff' AND policyname='staging_staff_own_active_membership'),
 'backofficeRegistryPresent',to_regclass('public.mobility_stage_backoffice_roles') IS NOT NULL,
 'backofficeDirectClientWrites',has_table_privilege('authenticated','public.mobility_stage_backoffice_roles','INSERT,UPDATE,DELETE'),
 'authAccounts',(SELECT count(*) FROM auth.users),
 'registeredBackendTransactionalRpcs',(SELECT count(*) FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN
   ('mobility_stage_auto_demo_accept_offer','mobility_stage_delivery_accept_offer',
    'mobility_stage_merchant_order_transition','mobility_stage_payment_transition')),
 'driverEvidencePrivateLocked',EXISTS (SELECT 1 FROM storage.buckets
  WHERE id='mobility-staging-driver-evidence' AND public=false)
  AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage'
   AND tablename='objects' AND policyname LIKE 'mobility_stage_evidence_%'),
 'structureVerified',(
  (SELECT count(*) FROM state WHERE present AND rls)=32
  AND (SELECT count(*) FROM state WHERE anon_access OR user_write)=0
  AND (SELECT count(*) FROM commerce WHERE has_table_privilege('service_role',format('public.%I',name),'INSERT,UPDATE,DELETE'))=0),
 'externalOperationsEnabled',false,
 'commercialLaunchAllowed',false
) AS qore_staging_external_gate;
