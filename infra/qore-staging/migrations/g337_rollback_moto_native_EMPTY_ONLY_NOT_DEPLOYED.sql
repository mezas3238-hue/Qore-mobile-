-- G337 PG17 MOTO rollback DRAFT; NEVER auto-run, NEVER on nonempty data.
-- Requires the Owner's explicit operator-side opt-in (setting not provided
-- by this file), exact G337 marker, a backup, and service stopped.
BEGIN;
DO $gate$ BEGIN
 IF pg_catalog.current_setting('server_version_num')::integer < 170000
  OR pg_catalog.current_setting('qore.g337_owner_rollback_approved',true) IS DISTINCT FROM 'true'
  OR pg_catalog.to_regclass('qore_stage_internal.g337_moto_quotes') IS NULL
  OR pg_catalog.to_regclass('qore_stage_internal.g337_moto_trips') IS NULL
  OR pg_catalog.to_regclass('qore_stage_internal.g337_moto_ledger') IS NULL
  OR pg_catalog.to_regprocedure('public.mobility_stage_g100_moto_quote_qa(uuid,uuid,text,text,text,integer,integer)') IS NULL
  OR pg_catalog.obj_description('public.mobility_stage_g100_moto_quote_qa(uuid,uuid,text,text,text,integer,integer)'::pg_catalog.regprocedure)
     NOT LIKE 'G337 PG17 native DRAFT MOTO:%'
 THEN RAISE EXCEPTION 'G337 rollback not authorized or fingerprint mismatch'
  USING ERRCODE='P3378'; END IF;
END $gate$;

-- The ACCESS EXCLUSIVE lock eliminates a data-write race between inspection
-- and DROP; any authentic persisted quote/booking/ledger forbids rollback.
LOCK TABLE qore_stage_internal.g337_moto_ledger,
 qore_stage_internal.g337_moto_trips,
 qore_stage_internal.g337_moto_quotes IN ACCESS EXCLUSIVE MODE;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM qore_stage_internal.g337_moto_quotes)
  OR EXISTS(SELECT 1 FROM qore_stage_internal.g337_moto_trips)
  OR EXISTS(SELECT 1 FROM qore_stage_internal.g337_moto_ledger)
 THEN RAISE EXCEPTION 'G337 MOTO PG17 has data: no rollback; preserve original evidence'
  USING ERRCODE='P3377'; END IF;
END $guard$;

DROP FUNCTION public.mobility_stage_g100_moto_quote_qa(uuid,uuid,text,text,text,integer,integer),
 public.mobility_stage_g100_moto_book_qa(uuid,uuid,uuid),
 public.mobility_stage_g100_moto_booking_receipt_qa(uuid,uuid),
 public.mobility_stage_g118_moto_status_qa(uuid,uuid),
 public.mobility_stage_g100_moto_cancel_qa(uuid,uuid,uuid);
DROP FUNCTION qore_stage_internal.g337_moto_quote(uuid,uuid,text,text,text,integer,integer),
 qore_stage_internal.g337_moto_book(uuid,uuid,uuid),
 qore_stage_internal.g337_moto_cancel(uuid,uuid,uuid),
 qore_stage_internal.g337_moto_status(uuid,uuid),
 qore_stage_internal.g337_moto_trip_receipt(uuid,uuid),
 qore_stage_internal.g337_moto_quote_receipt(uuid,uuid);
DROP TABLE qore_stage_internal.g337_moto_ledger,
 qore_stage_internal.g337_moto_trips,
 qore_stage_internal.g337_moto_quotes RESTRICT;
COMMIT;
