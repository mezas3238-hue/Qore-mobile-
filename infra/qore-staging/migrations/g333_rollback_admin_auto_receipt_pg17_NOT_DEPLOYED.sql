-- G333 rollback DRAFT ONLY; requires separate Owner/operator approval.
-- Only removes this QA Admin read-only receipt. Does NOT delete any trips,
-- fares, passengers, routes, role data, KYC, GPS, or finance records.
-- Refuses partial schema and refuses dependencies (RESTRICT, never CASCADE).
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
 IF pg_catalog.current_setting('server_version_num')::integer < 170000
  OR pg_catalog.to_regprocedure('public.mobility_stage_g75_admin_f1_receipt(uuid,uuid)') IS NULL
  OR pg_catalog.to_regprocedure('qore_stage_internal.mobility_stage_g333_native_admin_auto_receipt(uuid,uuid)') IS NULL
  OR pg_catalog.to_regclass('public.mobility_stage_g262_auto_prequotes') IS NULL
  OR pg_catalog.to_regclass('public.mobility_stage_g73_auto_routes') IS NULL
 THEN RAISE EXCEPTION 'G333 rollback refuses incomplete/non-PG17 Admin route sources'
  USING ERRCODE='P3331'; END IF;
END $guard$;
DROP FUNCTION public.mobility_stage_g75_admin_f1_receipt(uuid,uuid) RESTRICT;
DROP FUNCTION qore_stage_internal.mobility_stage_g333_native_admin_auto_receipt(uuid,uuid) RESTRICT;
COMMIT;
-- Existing G262/G73/pricing/Driver/Owner objects are untouched.
