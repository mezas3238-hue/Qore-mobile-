-- G332 / G329 PG17 ROLLBACK -- MANUAL STAGING APPROVAL REQUIRED
-- Never deployed by this PR. NO CASCADE, NO data loss, NO LIVE.
-- Run only after the Owner-approved staging rollback decision and a backup.
-- Will refuse if any G329 pin-bound trip evidence is persisted.
-- G73 legacy routes remain untouched. Any existing schema USAGE grant is preserved.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
 IF pg_catalog.current_setting('server_version_num')::integer < 170000
  OR pg_catalog.to_regclass('qore_stage_internal.mobility_stage_g329_auto_pinned_routes') IS NULL
  OR pg_catalog.to_regclass('public.mobility_stage_g73_auto_routes') IS NULL
  OR pg_catalog.to_regprocedure('public.mobility_stage_g329_route_pinned_receipt(uuid,uuid)') IS NULL
  OR pg_catalog.to_regprocedure('qore_stage_internal.mobility_stage_g329_route_pinned_receipt(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G332 refuses rollback without full G329 staging schema'
   USING ERRCODE='P3292'; END IF;
 IF EXISTS(SELECT 1 FROM qore_stage_internal.mobility_stage_g329_auto_pinned_routes)
 THEN RAISE EXCEPTION 'G332 refuses rollback: persisted GPS data exists; archive and legal review required'
   USING ERRCODE='P3292'; END IF;
END $guard$;
-- RESTRICT deliberately rejects any additional SQL dependency; no CASCADE.
DROP FUNCTION public.mobility_stage_g329_route_pinned(
 uuid,uuid,public.mobility_service_kind,text,text,text,
 integer,integer,integer,uuid,
 double precision,double precision,double precision,double precision,bigint
) RESTRICT;
DROP FUNCTION public.mobility_stage_g329_route_pinned_receipt(uuid,uuid) RESTRICT;
DROP FUNCTION qore_stage_internal.mobility_stage_g329_route_pinned(
 uuid,uuid,public.mobility_service_kind,text,text,text,
 integer,integer,integer,uuid,
 double precision,double precision,double precision,double precision,bigint
) RESTRICT;
DROP FUNCTION qore_stage_internal.mobility_stage_g329_route_pinned_receipt(uuid,uuid) RESTRICT;
DROP TABLE qore_stage_internal.mobility_stage_g329_auto_pinned_routes RESTRICT;
COMMIT;
-- After rollback, manually verify G73 remains unchanged and return gate to OFF.
