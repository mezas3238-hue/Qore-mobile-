-- G283 STAGING PG17: machine-readable aggregate conditions for starting
-- the optional G113 AUTO retry scheduler.  NO legal approval or road evidence
-- may be manufactured here. This is NOT a full launch certificate.
-- A true response means only an authorized Owner fare and one currently
-- eligible Driver exist.  Each trip still needs its own verified road proof.
DO $gate$ BEGIN
 IF to_regclass('public.mobility_stage_g269_auto_dispatch_jobs') IS NULL
  OR to_regclass('public.mobility_stage_fare_rules') IS NULL
  OR to_regclass('public.mobility_stage_backoffice_roles') IS NULL
  OR to_regclass('public.mobility_vehicles') IS NULL
  OR to_regclass('public.mobility_stage_g263_pickup_preferences') IS NULL
  OR to_regprocedure('public.mobility_stage_g27_backoffice_role_of(uuid)') IS NULL
  OR to_regprocedure('public.mobility_vehicle_preflight(uuid,uuid,public.mobility_service_kind)') IS NULL
  OR to_regnamespace('qore_stage_internal') IS NULL
 THEN RAISE EXCEPTION 'G283 verified STAGING dependencies unavailable' USING ERRCODE='P2830';
 END IF;
END $gate$;

CREATE FUNCTION qore_stage_internal.mobility_stage_g283_auto_retry_readiness_qa()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
DECLARE owner_fare boolean; eligible_driver boolean;
BEGIN
 SELECT EXISTS(
  SELECT 1 FROM public.mobility_stage_fare_rules f
  WHERE f.mode='AUTO'::public.mobility_stage_fare_mode
   AND f.active IS TRUE
   AND f.valid_from<=pg_catalog.statement_timestamp()
   AND (f.valid_until IS NULL OR f.valid_until>pg_catalog.statement_timestamp())
   AND f.approved_by IS NOT NULL AND f.approved_at IS NOT NULL
   AND f.approved_at<=pg_catalog.statement_timestamp()
   AND public.mobility_stage_g27_backoffice_role_of(f.approved_by)='owner'
 ) INTO owner_fare;
 SELECT EXISTS(
  SELECT 1 FROM public.mobility_vehicles v
  JOIN public.mobility_stage_g263_pickup_preferences pref
   ON pref.driver_id=v.driver_id AND pref.service_kind='RIDE'
   AND pref.maximum_road_meters BETWEEN 1 AND 50000
  WHERE v.service_kind IN ('economico','confort','xl')
   AND public.mobility_vehicle_preflight(v.driver_id,v.id,v.service_kind) IS TRUE
 ) INTO eligible_driver;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,
  'ownerAutoFareVerified',owner_fare,
  'eligibleAutoDriverVerified',eligible_driver,
  'databaseReady',owner_fare AND eligible_driver
 );
END $f$;

CREATE FUNCTION public.mobility_stage_g283_auto_retry_readiness_qa()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.mobility_stage_g283_auto_retry_readiness_qa()
$f$;
REVOKE ALL ON FUNCTION public.mobility_stage_g283_auto_retry_readiness_qa()
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION qore_stage_internal.mobility_stage_g283_auto_retry_readiness_qa()
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g283_auto_retry_readiness_qa()
 TO service_role;
GRANT EXECUTE ON FUNCTION qore_stage_internal.mobility_stage_g283_auto_retry_readiness_qa()
 TO service_role;
