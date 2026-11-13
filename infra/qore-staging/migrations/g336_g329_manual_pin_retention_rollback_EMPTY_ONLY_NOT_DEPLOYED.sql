-- G336 manual, OPERATOR-APPROVED rollback DRAFT. NOT deployed.
-- Keep historical purge audit immutable. If any operation was recorded,
-- refuse rollback: do NOT remove the only non-PII audit trail.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$ BEGIN
 IF pg_catalog.current_setting('server_version_num')::integer<170000
  OR pg_catalog.to_regclass('qore_stage_internal.mobility_stage_g336_pin_retention_runs') IS NULL
  OR pg_catalog.to_regprocedure('qore_stage_internal.mobility_stage_g336_manual_expired_pin_retention(timestamptz,integer,boolean,text)') IS NULL
 THEN RAISE EXCEPTION 'G336 rollback requires full retention schema'
  USING ERRCODE='P3362'; END IF;
 IF EXISTS (SELECT 1 FROM qore_stage_internal.mobility_stage_g336_pin_retention_runs)
 THEN RAISE EXCEPTION 'G336 rollback refused: operator audit history exists'
  USING ERRCODE='P3362'; END IF;
END $guard$;
DROP FUNCTION qore_stage_internal.mobility_stage_g336_manual_expired_pin_retention(
 timestamptz,integer,boolean,text) RESTRICT;
DROP TABLE qore_stage_internal.mobility_stage_g336_pin_retention_runs RESTRICT;
COMMIT;
-- G329 GPS evidence and G73 routes are NEVER dropped by this rollback.
