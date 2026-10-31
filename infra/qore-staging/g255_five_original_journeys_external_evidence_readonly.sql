-- G255: real PG17 Supabase STAGING five-service source evidence. READ ONLY.
-- No CI fixtures, Auth creation, secrets, identity claims, or writes.
-- Counts are persisted source records, NOT proof of app->HTTPS->Admin E2E.
WITH source AS (
  SELECT 'AUTO_PASSENGER' AS service,
   count(*) AS original_rows,
   count(*) FILTER(WHERE status='completed') AS terminal_rows,
   count(*) FILTER(WHERE driver_id IS NOT NULL) AS assigned_rows
  FROM public.mobility_stage_auto_demo_trips
  WHERE service<>'moto_pasajero'::public.mobility_service_kind
  UNION ALL
  SELECT 'MOTO_PASSENGER',count(*),
   count(*) FILTER(WHERE status='completed'),
   count(*) FILTER(WHERE driver_id IS NOT NULL)
  FROM public.mobility_stage_auto_demo_trips
  WHERE service='moto_pasajero'::public.mobility_service_kind
  UNION ALL
  SELECT 'AUTO_DELIVERY',count(*),
   count(*) FILTER(WHERE status='delivered'),
   count(*) FILTER(WHERE courier_id IS NOT NULL)
  FROM public.mobility_stage_deliveries
  WHERE requested_vehicle_kind='AUTO'::public.mobility_vehicle_kind
  UNION ALL
  SELECT 'MOTO_DELIVERY',count(*),
   count(*) FILTER(WHERE status='delivered'),
   count(*) FILTER(WHERE courier_id IS NOT NULL)
  FROM public.mobility_stage_deliveries
  WHERE requested_vehicle_kind='MOTO'::public.mobility_vehicle_kind
  UNION ALL
  SELECT 'COMMERCE',count(*),
   count(*) FILTER(WHERE status='delivered'),
   count(*) FILTER(WHERE delivery_id IS NOT NULL)
  FROM public.mobility_stage_merchant_orders
), api AS (
 SELECT jsonb_build_object(
  'autoTripRequest',to_regproc('public.mobility_stage_auto_demo_request') IS NOT NULL,
  'autoOfferAccept',to_regproc('public.mobility_stage_auto_demo_accept_offer') IS NOT NULL,
  'autoTripTransition',to_regproc('public.mobility_stage_auto_demo_transition') IS NOT NULL,
  'deliveryRequest',to_regproc('public.mobility_stage_delivery_request') IS NOT NULL,
  'deliveryOfferAccept',to_regproc('public.mobility_stage_delivery_accept_offer') IS NOT NULL,
  'deliveryTransition',to_regproc('public.mobility_stage_delivery_transition') IS NOT NULL,
  'merchantOrderRequest',to_regproc('public.mobility_stage_merchant_order_request') IS NOT NULL,
  'merchantOrderTransition',to_regproc('public.mobility_stage_merchant_order_transition') IS NOT NULL,
  'merchantOrderDeliveryLink',to_regproc('public.mobility_stage_merchant_order_attach_delivery') IS NOT NULL,
  'merchantStaffInbox',to_regproc('public.mobility_stage_g156_merchant_inbox_qa') IS NOT NULL,
  'providerSessionActive',to_regproc('public.mobility_stage_g42_session_active') IS NOT NULL,
  'providerSessionLock',to_regproc('public.mobility_stage_g42_lock_session') IS NOT NULL
 ) AS presence
)
SELECT jsonb_build_object(
 'inspection','G255_ACTUAL_SUPABASE_EXTERNAL_SOURCE_EVIDENCE',
 'scope','STAGING_READ_ONLY_NOT_CI_NOT_LIVE',
 'origin','real Supabase PostgreSQL 17 source tables',
 'auth',jsonb_build_object(
   'registeredUsers',(SELECT count(*) FROM auth.users),
   'providerSessions',(SELECT count(*) FROM auth.sessions),
   'exclusiveRoleRows',(SELECT count(*) FROM public.user_roles),
   'activeBackoffice',(SELECT count(*) FROM public.mobility_stage_backoffice_roles WHERE status='active')
 ),
 'journeys',(SELECT jsonb_agg(jsonb_build_object(
   'service',service,'persistedOriginals',original_rows,
   'terminalRows',terminal_rows,'assignedOrLinkedRows',assigned_rows
 ) ORDER BY service) FROM source),
 'supportingSources',jsonb_build_object(
   'autoLifecycleEvents',(SELECT count(*) FROM public.mobility_stage_auto_demo_events),
   'deliveryLifecycleEvents',(SELECT count(*) FROM public.mobility_stage_delivery_events),
   'merchantLifecycleEvents',(SELECT count(*) FROM public.mobility_stage_merchant_order_events),
   'simulationLedgerEntries',(SELECT count(*) FROM public.mobility_stage_ledger_entries),
   'registeredMerchantStaff',(SELECT count(*) FROM public.mobility_stage_merchant_staff)
 ),
 'registeredSqlRpcPresence',(SELECT presence FROM api),
 'externalHttpAndJwtProofCollected',false,
 'commercialLaunchApproved',false,
 'noSyntheticCiAcceptancePromoted',true
) AS qore_g255_external_source_evidence;
