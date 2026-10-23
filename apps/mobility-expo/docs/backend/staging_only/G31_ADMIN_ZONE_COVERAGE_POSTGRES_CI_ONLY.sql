-- G31 A05.5 — zonal coverage catalog ≠ observed Driver availability.
-- PostgreSQL 16 DISPOSABLE QA ONLY. NO PROD, NO geography fabrication.
-- The catalog includes municipality/service rows; private, immutable
-- observations provide explicit server-sampled counts (NOT driver estimates).
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
  current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G31 zones refuses non-disposable PostgreSQL'; END IF;
 IF to_regclass('public.mobility_stage_backoffice_roles') IS NULL
 THEN RAISE EXCEPTION 'G31 requires G27 authoritative backoffice role'; END IF;
END $guard$;
BEGIN;

CREATE TABLE public.mobility_stage_g31_zone_coverage (
 zone_id uuid NOT NULL,
 country_code text NOT NULL DEFAULT 'PY' CHECK(country_code='PY'),
 municipality text NOT NULL CHECK(
  char_length(municipality) BETWEEN 2 AND 80 AND
  municipality=trim(municipality)),
 service_kind text NOT NULL CHECK(service_kind IN
  ('AUTO_RIDE','AUTO_DELIVERY','MOTO_DELIVERY')),
 coverage_status text NOT NULL CHECK(coverage_status IN
  ('ACTIVE','PLANNED','PAUSED','CLOSED')),
 -- Until legal/geofencing/insurance gates are certified, coverage never
 -- implies dispatch eligibility, even for "ACTIVE" synthetic geography.
 eligible_by_policy boolean NOT NULL DEFAULT false
  CHECK(eligible_by_policy=false),
 source_kind text NOT NULL DEFAULT 'SYNTHETIC_STAGING_REVIEWED'
  CHECK(source_kind='SYNTHETIC_STAGING_REVIEWED'),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 PRIMARY KEY(zone_id,service_kind)
);
CREATE INDEX mobility_stage_g31_coverage_keyset
 ON public.mobility_stage_g31_zone_coverage(zone_id DESC,service_kind DESC);

-- This is a QA read-only telemetry observation, NOT GPS geofencing.
-- No browser, driver or service_role can create, spoof or edit observations.
-- A real future trusted telemetry ingest needs separately audited authority.
CREATE TABLE public.mobility_stage_g31_zone_observations (
 observation_id uuid PRIMARY KEY,
 zone_id uuid NOT NULL,
 service_kind text NOT NULL,
 on_duty_vehicles integer NOT NULL CHECK(on_duty_vehicles BETWEEN 0 AND 100000),
 observed_at timestamptz NOT NULL,
 source_kind text NOT NULL DEFAULT 'SYNTHETIC_SERVER_OBSERVATION'
  CHECK(source_kind='SYNTHETIC_SERVER_OBSERVATION'),
 FOREIGN KEY(zone_id,service_kind)
  REFERENCES public.mobility_stage_g31_zone_coverage(zone_id,service_kind)
  ON DELETE RESTRICT,
 UNIQUE(zone_id,service_kind,observed_at)
);
CREATE INDEX mobility_stage_g31_observed_latest
 ON public.mobility_stage_g31_zone_observations(
 zone_id,service_kind,observed_at DESC,observation_id DESC);

ALTER TABLE public.mobility_stage_g31_zone_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g31_zone_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g31_zone_coverage
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.mobility_stage_g31_zone_observations
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.mobility_stage_g31_zone_coverage TO service_role;
GRANT SELECT ON public.mobility_stage_g31_zone_observations TO service_role;

CREATE FUNCTION public.mobility_stage_g31_admin_zone_page(
 _actor uuid,_anchor_ms bigint,_after text,_limit integer
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $body$
DECLARE result jsonb;
BEGIN
 IF _actor IS NULL OR _anchor_ms IS NULL
  OR _anchor_ms NOT BETWEEN 0 AND 9999999999999
  OR _anchor_ms>floor(extract(epoch FROM clock_timestamp())*1000)::bigint
  OR _limit IS DISTINCT FROM 50
  OR (_after IS NOT NULL AND _after !~ '^[0-9a-f]{32}[0-2]$')
 THEN RAISE EXCEPTION 'Invalid G31 zone read' USING ERRCODE='G3101'; END IF;
 IF NOT public.mobility_stage_g27_backoffice_has_scope(_actor,'admin.zones.read')
 THEN RAISE EXCEPTION 'Exclusive active Admin zone scope required'
   USING ERRCODE='G3101'; END IF;

 WITH keyed AS (
  SELECT c.zone_id,c.municipality,c.service_kind,c.coverage_status,
   c.eligible_by_policy,c.revision,
   pg_catalog.replace(c.zone_id::text,'-','')||
    CASE c.service_kind WHEN 'AUTO_RIDE' THEN '0'
      WHEN 'AUTO_DELIVERY' THEN '1' ELSE '2' END AS keyset
  FROM public.mobility_stage_g31_zone_coverage c
  WHERE c.created_at<=pg_catalog.to_timestamp(_anchor_ms/1000.0)
 ), candidate AS (
  SELECT * FROM keyed
  WHERE _after IS NULL OR keyset < _after
  ORDER BY keyset DESC LIMIT 51
 ), visible AS (
  SELECT * FROM candidate ORDER BY keyset DESC LIMIT 50
 ), observed AS (
  SELECT v.*,
   CASE WHEN o.observed_at>=
       pg_catalog.to_timestamp((_anchor_ms-120000)/1000.0)
       AND o.observed_at<=pg_catalog.to_timestamp(_anchor_ms/1000.0)
     THEN o.on_duty_vehicles ELSE 0 END AS safe_count,
   CASE WHEN o.observed_at>=
       pg_catalog.to_timestamp((_anchor_ms-120000)/1000.0)
       AND o.observed_at<=pg_catalog.to_timestamp(_anchor_ms/1000.0)
     THEN floor(extract(epoch FROM o.observed_at)*1000)::bigint
     ELSE 0 END AS safe_observed_at
  FROM visible v
  LEFT JOIN LATERAL (
   SELECT obs.observed_at,obs.on_duty_vehicles
   FROM public.mobility_stage_g31_zone_observations obs
   WHERE obs.zone_id=v.zone_id AND obs.service_kind=v.service_kind
    AND obs.observed_at<=pg_catalog.to_timestamp(_anchor_ms/1000.0)
   ORDER BY obs.observed_at DESC,obs.observation_id DESC LIMIT 1
  ) o ON true
 )
 SELECT pg_catalog.jsonb_build_object(
  'revision',COALESCE((SELECT max(revision) FROM visible),0),
  'hasMore',(SELECT count(*)>50 FROM candidate),
  'items',COALESCE((
   SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'zoneId',zone_id,'municipality',municipality,
    'serviceKind',service_kind,'coverageStatus',coverage_status,
    'eligibleByPolicy',eligible_by_policy,
    'onDutyVehicles',safe_count,
    'availabilityObservedAt',safe_observed_at
   ) ORDER BY keyset DESC) FROM observed
  ),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $body$;

REVOKE ALL ON FUNCTION public.mobility_stage_g31_admin_zone_page(uuid,bigint,text,integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g31_admin_zone_page(uuid,bigint,text,integer)
 TO service_role;
COMMIT;
