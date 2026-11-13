-- G336 CI ONLY · test never runs against a persistent Supabase database.
\set ON_ERROR_STOP on
DO $guard$ BEGIN
 IF current_database()<>'qore_g329_ci'
  OR pg_catalog.current_setting('server_version_num')::integer<170000
 THEN RAISE EXCEPTION 'G336 disposable-only wrong SQL target'; END IF;
END $guard$;

-- Reuse full G329 isolation/atomicity suite, not a fake recreation of pins.
\ir g329_pg17_disposable_only.sql
CREATE TABLE public.mobility_stage_g262_auto_prequotes(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 route_id uuid NOT NULL REFERENCES public.mobility_stage_g73_auto_routes(id)
  ON DELETE RESTRICT
);
\ir ../migrations/g336_g329_manual_pin_retention_pg17_DRAFT.sql

DO $permissions$ BEGIN
 IF has_function_privilege('anon',
  'qore_stage_internal.mobility_stage_g336_manual_expired_pin_retention(timestamptz,integer,boolean,text)','EXECUTE')
 OR has_function_privilege('authenticated',
  'qore_stage_internal.mobility_stage_g336_manual_expired_pin_retention(timestamptz,integer,boolean,text)','EXECUTE')
 OR has_function_privilege('service_role',
  'qore_stage_internal.mobility_stage_g336_manual_expired_pin_retention(timestamptz,integer,boolean,text)','EXECUTE')
 OR has_table_privilege('service_role',
  'qore_stage_internal.mobility_stage_g336_pin_retention_runs','SELECT')
 THEN RAISE EXCEPTION 'G336 private audit/retention ACL leaked'; END IF;
END $permissions$;

-- Bounded manual purge cannot be invoked by a backend service_role token.
SET ROLE service_role;
DO $role_denial$ BEGIN
 BEGIN
  PERFORM qore_stage_internal.mobility_stage_g336_manual_expired_pin_retention(
   pg_catalog.clock_timestamp()-interval '2 days',10,true,'G336-QA-DENY');
  RAISE EXCEPTION 'G336 exposed destructive SQL to service role';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $role_denial$;
RESET ROLE;

-- Base G329 fixture supplies a pin with a route_id; simulate ageing in QA only.
UPDATE public.mobility_stage_g73_auto_routes
 SET expires_at=pg_catalog.clock_timestamp()-interval '3 days'
 WHERE request_key='32900000-0000-4329-8329-000000000010';
UPDATE qore_stage_internal.mobility_stage_g329_auto_pinned_routes
 SET created_at=pg_catalog.clock_timestamp()-interval '4 days'
 WHERE request_key='32900000-0000-4329-8329-000000000010';
-- This old route is now quoted; it must NEVER lose its GPS proof.
INSERT INTO public.mobility_stage_g262_auto_prequotes(route_id)
 SELECT id FROM public.mobility_stage_g73_auto_routes
 WHERE request_key='32900000-0000-4329-8329-000000000010';

-- A second old pin has no quote and may be eligible under a human policy.
INSERT INTO public.mobility_stage_g73_auto_routes(
 id, request_key,passenger_id,service,origin_tag,destination_tag,
 zone_tag,distance_meters,duration_seconds,tolls_pyg,expires_at)
VALUES(
 '33600000-0000-4336-8336-000000000031',
 '33600000-0000-4336-8336-000000000032',
 '32900000-0000-4329-8329-000000000001',
 'economico','HERNANDARIAS','CIUDAD_DEL_ESTE','AUTO_ALTO_PARANA',
 6000,630,0,pg_catalog.clock_timestamp()-interval '3 days');
INSERT INTO qore_stage_internal.mobility_stage_g329_auto_pinned_routes(
 route_id,passenger_id,request_key,pin_evidence_id,
 pickup_latitude,pickup_longitude,dropoff_latitude,dropoff_longitude,
 verified_at,created_at)
VALUES(
 '33600000-0000-4336-8336-000000000031',
 '32900000-0000-4329-8329-000000000001',
 '33600000-0000-4336-8336-000000000032',
 '33600000-0000-4336-8336-000000000033',
 -25.4061,-54.6302,-25.5092,-54.6115,
 pg_catalog.clock_timestamp()-interval '4 days',
 pg_catalog.clock_timestamp()-interval '4 days');

DO $invalid$ BEGIN
 BEGIN
  PERFORM qore_stage_internal.mobility_stage_g336_manual_expired_pin_retention(
   pg_catalog.clock_timestamp(),100,false,NULL);
  RAISE EXCEPTION 'G336 accepted too recent cutoff';
 EXCEPTION WHEN SQLSTATE 'P3361' THEN NULL; END;
 BEGIN
  PERFORM qore_stage_internal.mobility_stage_g336_manual_expired_pin_retention(
   pg_catalog.clock_timestamp()-interval '2 days',101,false,NULL);
  RAISE EXCEPTION 'G336 accepted unbounded batch';
 EXCEPTION WHEN SQLSTATE 'P3361' THEN NULL; END;
 BEGIN
  PERFORM qore_stage_internal.mobility_stage_g336_manual_expired_pin_retention(
   pg_catalog.clock_timestamp()-interval '2 days',10,true,NULL);
  RAISE EXCEPTION 'G336 accepted delete without ticket';
 EXCEPTION WHEN SQLSTATE 'P3361' THEN NULL; END;
END $invalid$;

DO $preview$ DECLARE v jsonb; BEGIN
 v:=qore_stage_internal.mobility_stage_g336_manual_expired_pin_retention(
  pg_catalog.clock_timestamp()-interval '2 days',10,false,NULL);
 IF v->>'mode'<>'DRY_RUN' OR v->>'commercialEnabled'<>'false'
  OR v->>'scanned'<>'2' OR v->>'eligible'<>'1'
  OR v->>'blockedQuoted'<>'1' OR v->>'deleted'<>'0'
  OR v->>'auditRunId' IS NOT NULL
  OR (SELECT count(*) FROM qore_stage_internal.mobility_stage_g329_auto_pinned_routes)<>2
  OR (SELECT count(*) FROM qore_stage_internal.mobility_stage_g336_pin_retention_runs)<>0
 THEN RAISE EXCEPTION 'G336 dry-run changed data or misclassified pins: %',v; END IF;
END $preview$;

-- CI uses a synthetic ticket, NEVER an actual Owner approval or real deletion.
DO $execute$ DECLARE v jsonb; BEGIN
 v:=qore_stage_internal.mobility_stage_g336_manual_expired_pin_retention(
  pg_catalog.clock_timestamp()-interval '2 days',10,true,'G336-QA-DISPOSABLE');
 IF v->>'mode'<>'MANUAL_EXECUTED' OR v->>'scanned'<>'2'
  OR v->>'eligible'<>'1' OR v->>'blockedQuoted'<>'1'
  OR v->>'deleted'<>'1' OR v->>'auditRunId' IS NULL
 THEN RAISE EXCEPTION 'G336 human-only cleanup contract invalid: %',v; END IF;
 IF (SELECT count(*) FROM qore_stage_internal.mobility_stage_g329_auto_pinned_routes)<>1
  OR NOT EXISTS (
   SELECT 1 FROM qore_stage_internal.mobility_stage_g329_auto_pinned_routes
   WHERE request_key='32900000-0000-4329-8329-000000000010')
  OR EXISTS (
   SELECT 1 FROM qore_stage_internal.mobility_stage_g329_auto_pinned_routes
   WHERE request_key='33600000-0000-4336-8336-000000000032')
  OR (SELECT count(*) FROM qore_stage_internal.mobility_stage_g336_pin_retention_runs)<>1
  OR (SELECT count(*) FROM public.mobility_stage_g73_auto_routes)<>3
 THEN RAISE EXCEPTION 'G336 deleted quoted pin, G73 route or audit evidence'; END IF;
END $execute$;

-- A rollback after recorded deletions must be refused until Owner/legal review.
DO $rollback_guard$ BEGIN
 IF (SELECT count(*) FROM qore_stage_internal.mobility_stage_g336_pin_retention_runs)<>1
 THEN RAISE EXCEPTION 'G336 missing mandatory operation audit'; END IF;
END $rollback_guard$;
\echo G336 DISPOSABLE PASS: role denial, preview, protected quote, manual limit, audit
