-- G333 follow-up: canonical current PG17 STAGING capability inventory.
-- READ ONLY. Does not apply migrations, create Admin/Owner, mint MFA/PSP,
-- or claim native-source traces are external 5-journey E2E.
-- Historical G261 expected G72 (disposable PG16); modern G73 pricing and
-- booking use G262 native prequotes, independently verified from PG17 function
-- definitions on 2026-11-13. This report distinguishes both generations.
WITH present AS (
 SELECT
  pg_catalog.to_regclass('public.mobility_stage_g73_auto_routes') IS NOT NULL AS routes,
  pg_catalog.to_regclass('public.mobility_stage_g262_auto_prequotes') IS NOT NULL AS g262_quotes,
  pg_catalog.to_regclass('public.mobility_stage_g72_auto_prequotes') IS NOT NULL AS legacy_g72,
  pg_catalog.to_regclass('public.mobility_stage_auto_demo_trips') IS NOT NULL AS trips,
  pg_catalog.to_regclass('public.mobility_stage_deliveries') IS NOT NULL AS deliveries,
  pg_catalog.to_regclass('public.mobility_stage_merchant_orders') IS NOT NULL AS commerce,
  pg_catalog.to_regclass('public.mobility_stage_fare_rules') IS NOT NULL AS fare_rules,
  pg_catalog.to_regprocedure('public.mobility_stage_g73_route(uuid,uuid,public.mobility_service_kind,text,text,text,integer,integer,integer)') IS NOT NULL AS route_fn,
  pg_catalog.to_regprocedure('public.mobility_stage_g73_quote(uuid,uuid,uuid)') IS NOT NULL AS quote_fn,
  pg_catalog.to_regprocedure('public.mobility_stage_g73_quote_receipt(uuid,uuid)') IS NOT NULL AS quote_read,
  pg_catalog.to_regprocedure('public.mobility_stage_g73_book(uuid,uuid,uuid)') IS NOT NULL AS book_fn,
  pg_catalog.to_regprocedure('public.mobility_stage_g73_booking_receipt(uuid,uuid)') IS NOT NULL AS book_read,
  pg_catalog.to_regprocedure('public.mobility_stage_g262_admin_native_trace_qa(uuid,text,uuid)') IS NOT NULL AS native_trace,
  pg_catalog.to_regprocedure('public.mobility_stage_g75_admin_f1_receipt(uuid,uuid)') IS NOT NULL AS original_priced_admin_receipt,
  pg_catalog.to_regclass('qore_stage_internal.mobility_stage_g329_auto_pinned_routes') IS NOT NULL AS pinned_route_sql,
  pg_catalog.to_regprocedure('public.mobility_stage_g27_backoffice_role_of(uuid)') IS NOT NULL AS owner_role_lookup
), scope AS (
 SELECT
  (SELECT count(*) FROM public.mobility_stage_backoffice_roles
   WHERE role='owner' AND status='active') AS owners_active,
  (SELECT count(*) FROM public.mobility_stage_backoffice_roles
   WHERE role='admin' AND status='active') AS admins_active,
  (SELECT count(*) FROM auth.mfa_factors WHERE status='verified') AS mfa_verified,
  (SELECT count(*) FROM auth.sessions) AS provider_sessions,
  (SELECT count(*) FROM auth.users) AS auth_users
)
SELECT pg_catalog.jsonb_build_object(
 'check','G333_CURRENT_PG17_NATIVE_FIVE_SERVICE_READINESS',
 'source','LIVE_STAGING_PG17_READ_ONLY',
 'currentAutoRouteSchemaPresent',
  p.routes AND p.g262_quotes AND p.fare_rules
   AND p.route_fn AND p.quote_fn AND p.quote_read AND p.book_fn AND p.book_read,
 'historicalLegacyG72SchemaPresent',p.legacy_g72,
 'g262NativeFiveServiceProvenancePresent',
  p.native_trace AND p.trips AND p.deliveries AND p.commerce,
 'g75OriginalPricedAdminReceiptInstalled',p.original_priced_admin_receipt,
 'g329PinnedRouteSqlInstalled',p.pinned_route_sql,
 'g27BackofficeRoleLookupInstalled',p.owner_role_lookup,
 'activeOwnerAccounts',s.owners_active,
 'activeAdminAccounts',s.admins_active,
 'verifiedMfaFactors',s.mfa_verified,
 'providerSessions',s.provider_sessions,
 'authAccounts',s.auth_users,
 'actualAal2SessionsCertified',false,
 'externalRouteProviderCertified',false,
 'externalPaymentSandboxCertified',false,
 'externalFiveJourneysCertified',0,
 'readyForCommercialOrExternalE2e',false,
 'warning','G262 native provenance and schema presence do not prove provider routing, signed booking, dispatch, payment or 5 external end-to-end paths'
) AS qore_g333_current_readiness
FROM present p CROSS JOIN scope s;
