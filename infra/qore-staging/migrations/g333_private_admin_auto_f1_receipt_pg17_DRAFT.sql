-- G333 · PostgreSQL 17 DRAFT STAGING migration. NOT DEPLOYED.
-- Native G262/G73 priced AUTO receipt for the pre-existing G75 Admin gateway.
-- Independent provider AAL2, JWT session revocation and rate limiting MUST
-- be attested by the existing g75-f1-admin-audit-gateway.mjs BEFORE this RPC.
-- This SQL does NOT mint an Admin/Owner, authorize KYC, accept rides or payments.
DO $g333_guard$ BEGIN
 IF pg_catalog.current_setting('server_version_num')::integer < 170000
  OR pg_catalog.to_regclass('public.mobility_stage_g262_auto_prequotes') IS NULL
  OR pg_catalog.to_regclass('public.mobility_stage_g73_auto_routes') IS NULL
  OR pg_catalog.to_regclass('public.mobility_stage_auto_demo_trips') IS NULL
  OR pg_catalog.to_regclass('public.mobility_stage_fare_rules') IS NULL
  OR pg_catalog.to_regclass('public.mobility_stage_backoffice_roles') IS NULL
  OR pg_catalog.to_regprocedure('public.mobility_stage_g27_backoffice_role_of(uuid)') IS NULL
  OR pg_catalog.to_regprocedure('public.mobility_stage_g27_backoffice_has_scope(uuid,text)') IS NULL
  OR pg_catalog.to_regnamespace('qore_stage_internal') IS NULL
  OR pg_catalog.to_regprocedure('public.mobility_stage_g75_admin_f1_receipt(uuid,uuid)') IS NOT NULL
  OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role')
 THEN
  RAISE EXCEPTION 'G333 STAGING native G262/G73/Admin dependencies missing or G75 already installed'
    USING ERRCODE='P3330';
 END IF;
END $g333_guard$;

-- Exact, private source-backed receipt. No CI_ONLY G72/G93 table or fake Driver.
-- Definer function is deliberately non-callable by a browser role.
CREATE FUNCTION qore_stage_internal.mobility_stage_g333_native_admin_auto_receipt(
 _admin_id uuid,_trip_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $g333$
 WITH stamp AS MATERIALIZED (
  SELECT pg_catalog.floor(extract(epoch from pg_catalog.clock_timestamp())*1000)::bigint ms
 )
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,
  'viewerId',_admin_id,'tripId',t.id,
  'routeId',r.id,'quoteId',q.id,'passengerId',t.passenger_id,
  'bookingRequestKey',q.booking_key,
  'service',t.service,'currency','PYG',
  'amountGs',q.total_pyg,'fareVersion',f.rule_key,
  'revision',t.revision,
  'status',CASE WHEN t.status::text='accepted' THEN 'assigned'
   ELSE t.status::text END,
  'assignmentPersisted',(t.driver_id IS NOT NULL),
  'driverId',CASE WHEN t.status::text IN ('accepted','arriving','in_progress')
   THEN t.driver_id ELSE NULL::uuid END,
  'observedAt',stamp.ms,'expiresAt',stamp.ms+30000,
  'serverPersisted',true)
 FROM public.mobility_stage_auto_demo_trips t
 JOIN public.mobility_stage_g262_auto_prequotes q
   ON q.trip_id=t.id AND q.passenger_id=t.passenger_id
    AND q.booking_key=t.request_key
 JOIN public.mobility_stage_g73_auto_routes r
   ON r.id=q.route_id AND r.passenger_id=t.passenger_id
    AND r.service=t.service
    AND r.origin_tag=t.origin_tag AND r.destination_tag=t.destination_tag
 JOIN public.mobility_stage_fare_rules f ON f.id=q.rule_id
 CROSS JOIN stamp
 WHERE _admin_id IS NOT NULL AND _trip_id IS NOT NULL AND t.id=_trip_id
  AND public.mobility_stage_g27_backoffice_role_of(_admin_id)='admin'
  AND public.mobility_stage_g27_backoffice_has_scope(_admin_id,'admin.audit.read') IS TRUE
  AND t.service IN ('economico'::public.mobility_service_kind,
    'confort'::public.mobility_service_kind,'xl'::public.mobility_service_kind)
  AND t.revision>=1
  AND t.status::text IN ('searching','accepted','arriving','in_progress',
   'completed','cancelled')
  AND (t.status::text<>'searching' OR t.driver_id IS NULL)
  AND (t.status::text NOT IN ('accepted','arriving','in_progress')
   OR t.driver_id IS NOT NULL)
  AND q.total_pyg BETWEEN 1 AND 100000000
  AND q.commission_pyg BETWEEN 0 AND q.total_pyg
  AND f.rule_key ~ '^[A-Za-z0-9._-]{1,48}$'
 LIMIT 1
$g333$;

-- Public RPC is an INVOKER wrapper and cannot bypass private function grants.
CREATE FUNCTION public.mobility_stage_g75_admin_f1_receipt(
 _admin_id uuid,_trip_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $g333$
 SELECT qore_stage_internal.mobility_stage_g333_native_admin_auto_receipt($1,$2)
$g333$;

REVOKE ALL ON FUNCTION
 qore_stage_internal.mobility_stage_g333_native_admin_auto_receipt(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g75_admin_f1_receipt(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA qore_stage_internal TO service_role;
GRANT EXECUTE ON FUNCTION
 qore_stage_internal.mobility_stage_g333_native_admin_auto_receipt(uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g75_admin_f1_receipt(uuid,uuid)
 TO service_role;
COMMENT ON FUNCTION public.mobility_stage_g75_admin_f1_receipt(uuid,uuid)
 IS 'G333 STAGING-only original G262/G73 priced AUTO source, verified Admin via G27; independent provider AAL2 and G42 session required at HTTP; no external-E2E or financial certification.';
