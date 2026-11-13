-- G336 · DRAFT PostgreSQL 17 · MANUAL G329 GPS coordinate retention.
-- NOT DEPLOYED. NEVER scheduled. Requires a separately approved Owner privacy
-- retention policy, a DBA change ticket, a verified backup and human approval.
-- Explicitly retains any route ever referenced by a G262 quote/booking.
-- This does NOT prove legal compliance and does NOT authorize LIVE.
DO $guard$ BEGIN
 IF pg_catalog.current_setting('server_version_num')::integer < 170000
  OR pg_catalog.to_regclass('qore_stage_internal.mobility_stage_g329_auto_pinned_routes') IS NULL
  OR pg_catalog.to_regclass('public.mobility_stage_g73_auto_routes') IS NULL
  OR pg_catalog.to_regclass('public.mobility_stage_g262_auto_prequotes') IS NULL
  OR NOT EXISTS (
   SELECT 1 FROM pg_catalog.pg_constraint
   WHERE conrelid=pg_catalog.to_regclass('public.mobility_stage_g262_auto_prequotes')
    AND confrelid=pg_catalog.to_regclass('public.mobility_stage_g73_auto_routes')
    AND contype='f')
 THEN RAISE EXCEPTION 'G336 requires native G329/G73/G262 PostgreSQL17 schema and FK'
   USING ERRCODE='P3360'; END IF;
END $guard$;

-- Only a privileged database operator can record executions.
-- No GPS coordinates, route IDs, passenger IDs, or documents in the audit log.
CREATE TABLE qore_stage_internal.mobility_stage_g336_pin_retention_runs (
 run_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 executed_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 operated_by text NOT NULL,
 approval_ref text NOT NULL,
 cutoff_before timestamptz NOT NULL,
 max_rows integer NOT NULL,
 scanned_count integer NOT NULL,
 blocked_quoted_count integer NOT NULL,
 deleted_count integer NOT NULL,
 CONSTRAINT g336_sane_counts CHECK (
  max_rows BETWEEN 1 AND 100 AND scanned_count >= 0
  AND blocked_quoted_count >= 0 AND deleted_count >= 0
  AND scanned_count <= max_rows AND deleted_count <= scanned_count)
);
ALTER TABLE qore_stage_internal.mobility_stage_g336_pin_retention_runs
 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE qore_stage_internal.mobility_stage_g336_pin_retention_runs
 FROM PUBLIC, anon, authenticated, service_role;

-- SECURITY INVOKER: restricted to the database operator only, never app/RPC.
-- _execute=false gives a dry run and writes NOTHING. _execute=true requires
-- a human approval reference; no automatic timer or worker invokes this.
CREATE FUNCTION qore_stage_internal.mobility_stage_g336_manual_expired_pin_retention(
 _older_than timestamptz, _max_rows integer, _execute boolean,
 _approval_ref text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER
 SET search_path='' AS $g336$
DECLARE
 v_route_id uuid;
 v_scanned integer := 0;
 v_eligible integer := 0;
 v_blocked integer := 0;
 v_deleted integer := 0;
 v_rows integer := 0;
 v_run_id uuid;
BEGIN
 IF current_user <> 'postgres'
  OR pg_catalog.current_setting('transaction_isolation') <> 'read committed'
 THEN RAISE EXCEPTION 'G336 requires human DBA in read committed transaction'
   USING ERRCODE='P3361'; END IF;
 IF _older_than IS NULL OR _older_than > pg_catalog.clock_timestamp()-interval '24 hours'
  OR _max_rows IS NULL OR _max_rows NOT BETWEEN 1 AND 100 OR _execute IS NULL
 THEN RAISE EXCEPTION 'G336 invalid cutoff, limit or execution mode'
   USING ERRCODE='P3361'; END IF;
 IF _execute AND (_approval_ref IS NULL OR
     _approval_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{5,100}$')
 THEN RAISE EXCEPTION 'G336 requires reviewed Owner/DBA ticket reference'
   USING ERRCODE='P3361'; END IF;

 -- Lock G73 parent rows in stable order. G262's FK INSERT requires a key-share
 -- lock on G73, so quote creation cannot race a pin removal. SKIP LOCKED
 -- skips active reservations rather than delaying transactions.
 FOR v_route_id IN
  SELECT r.id
  FROM public.mobility_stage_g73_auto_routes AS r
  JOIN qore_stage_internal.mobility_stage_g329_auto_pinned_routes AS p
   ON p.route_id=r.id
  WHERE r.expires_at < _older_than AND p.created_at < _older_than
  ORDER BY r.expires_at,r.id
  LIMIT _max_rows
  FOR UPDATE OF r SKIP LOCKED
 LOOP
  v_scanned := v_scanned + 1;
  -- Separate statement after acquiring the row lock: fresh READ COMMITTED
  -- snapshot. NEVER purge any pin associated with a quote, even if expired.
  IF EXISTS (SELECT 1 FROM public.mobility_stage_g262_auto_prequotes AS q
             WHERE q.route_id=v_route_id)
  THEN
   v_blocked:=v_blocked+1;
   CONTINUE;
  END IF;
  v_eligible:=v_eligible+1;
  IF _execute THEN
   DELETE FROM qore_stage_internal.mobility_stage_g329_auto_pinned_routes AS p
   WHERE p.route_id=v_route_id AND NOT EXISTS (
    SELECT 1 FROM public.mobility_stage_g262_auto_prequotes AS q
    WHERE q.route_id=v_route_id);
   GET DIAGNOSTICS v_rows=ROW_COUNT;
   v_deleted:=v_deleted+v_rows;
  END IF;
 END LOOP;
 IF _execute THEN
  INSERT INTO qore_stage_internal.mobility_stage_g336_pin_retention_runs(
   operated_by,approval_ref,cutoff_before,max_rows,scanned_count,
   blocked_quoted_count,deleted_count)
  VALUES(current_user,_approval_ref,_older_than,_max_rows,v_scanned,v_blocked,v_deleted)
  RETURNING run_id INTO v_run_id;
 END IF;
 RETURN pg_catalog.jsonb_build_object(
  'mode',CASE WHEN _execute THEN 'MANUAL_EXECUTED' ELSE 'DRY_RUN' END,
  'commercialEnabled',false,
  'scanned',v_scanned,'blockedQuoted',v_blocked,
  'eligible',v_eligible,'deleted',v_deleted,'auditRunId',v_run_id);
END $g336$;

REVOKE ALL ON FUNCTION
 qore_stage_internal.mobility_stage_g336_manual_expired_pin_retention(
 timestamptz,integer,boolean,text)
 FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION
 qore_stage_internal.mobility_stage_g336_manual_expired_pin_retention(
 timestamptz,integer,boolean,text)
 IS 'G336 human-DBA-only optional pin minimization with dry-run, quote lock, no automatic jobs, approval reference on execute. Requires legal Owner policy and backup before use; NOT authorization to purge STAGING.';
