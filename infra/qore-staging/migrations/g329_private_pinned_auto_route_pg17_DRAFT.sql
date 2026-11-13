-- G329 · DRAFT ONLY · QORE Mobile STAGING PostgreSQL 17.
-- Adds an atomic, separate AUTO route writer linked to independently verified GPS pins.
-- NOT applied to Supabase; NOT a LIVE enablement or payment processor.
-- Prerequisite: existing G73 routes, auth.users, user_roles, service_role and qore_stage_internal.
-- Approval required before any STAGING migration, with a backed-up rollback plan.
DO $gate$ BEGIN
 IF pg_catalog.current_setting('server_version_num')::int < 170000
  OR pg_catalog.to_regclass('public.mobility_stage_g73_auto_routes') IS NULL
  OR pg_catalog.to_regclass('public.user_roles') IS NULL
  OR pg_catalog.to_regclass('auth.users') IS NULL
  OR pg_catalog.to_regnamespace('qore_stage_internal') IS NULL
  OR pg_catalog.to_regtype('public.mobility_service_kind') IS NULL
  OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role')
 THEN RAISE EXCEPTION 'G329 PG17 STAGING route dependencies missing' USING ERRCODE='P3290';
 END IF;
END $gate$;

-- Private table: no API-facing table, no addresses, no price, no driver details.
-- Pin retention and deletion must be reviewed before a commercial launch.
CREATE TABLE qore_stage_internal.mobility_stage_g329_auto_pinned_routes (
 route_id uuid PRIMARY KEY REFERENCES public.mobility_stage_g73_auto_routes(id) ON DELETE RESTRICT,
 passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 request_key uuid NOT NULL UNIQUE,
 pin_evidence_id uuid NOT NULL UNIQUE,
 pickup_latitude double precision NOT NULL,
 pickup_longitude double precision NOT NULL,
 dropoff_latitude double precision NOT NULL,
 dropoff_longitude double precision NOT NULL,
 verified_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 CONSTRAINT g329_pickup_lat CHECK (pickup_latitude BETWEEN -27.8 AND -19.2),
 CONSTRAINT g329_pickup_lon CHECK (pickup_longitude BETWEEN -62.9 AND -54.1),
 CONSTRAINT g329_dropoff_lat CHECK (dropoff_latitude BETWEEN -27.8 AND -19.2),
 CONSTRAINT g329_dropoff_lon CHECK (dropoff_longitude BETWEEN -62.9 AND -54.1),
 CONSTRAINT g329_distinct_pins CHECK (
  ROW(pickup_latitude,pickup_longitude) IS DISTINCT FROM
  ROW(dropoff_latitude,dropoff_longitude))
);
ALTER TABLE qore_stage_internal.mobility_stage_g329_auto_pinned_routes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE qore_stage_internal.mobility_stage_g329_auto_pinned_routes
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION qore_stage_internal.mobility_stage_g329_route_pinned(
 _passenger_id uuid,_request_key uuid,_service public.mobility_service_kind,
 _origin_tag text,_destination_tag text,_zone_tag text,
 _distance_meters integer,_duration_seconds integer,_tolls_pyg integer,
 _pin_evidence_id uuid,
 _pickup_latitude double precision,_pickup_longitude double precision,
 _dropoff_latitude double precision,_dropoff_longitude double precision,
 _verified_at_ms bigint
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE
 route_id uuid;
 previous public.mobility_stage_g73_auto_routes%ROWTYPE;
 bound qore_stage_internal.mobility_stage_g329_auto_pinned_routes%ROWTYPE;
 verified_at timestamptz;
 stamp timestamptz := pg_catalog.clock_timestamp();
BEGIN
 -- Exact identity, service/coverage syntax, road metrics and fresh independent
 -- evidence are verified at the Node gateway, and rechecked here. No user role
 -- may claim ownership or direct raw coordinates through a public SQL interface.
 IF _passenger_id IS NULL OR _request_key IS NULL OR _pin_evidence_id IS NULL
  OR _service IS NULL OR _service NOT IN ('economico','confort','xl')
  OR _origin_tag IS NULL OR _origin_tag !~ '^[A-Z_]{3,40}$'
  OR _destination_tag IS NULL OR _destination_tag !~ '^[A-Z_]{3,40}$'
  OR _origin_tag=_destination_tag
  OR _zone_tag IS NULL OR _zone_tag !~ '^[A-Z_]{3,40}$'
  OR _distance_meters IS NULL OR _distance_meters NOT BETWEEN 1 AND 500000
  OR _duration_seconds IS NULL OR _duration_seconds NOT BETWEEN 1 AND 86400
  OR _tolls_pyg IS NULL OR _tolls_pyg NOT BETWEEN 0 AND 1000000
  OR _pickup_latitude IS NULL OR _pickup_latitude NOT BETWEEN -27.8 AND -19.2
  OR _pickup_longitude IS NULL OR _pickup_longitude NOT BETWEEN -62.9 AND -54.1
  OR _dropoff_latitude IS NULL OR _dropoff_latitude NOT BETWEEN -27.8 AND -19.2
  OR _dropoff_longitude IS NULL OR _dropoff_longitude NOT BETWEEN -62.9 AND -54.1
  OR ROW(_pickup_latitude,_pickup_longitude) IS NOT DISTINCT FROM
     ROW(_dropoff_latitude,_dropoff_longitude)
  OR _verified_at_ms IS NULL OR _verified_at_ms <= 0
  OR _verified_at_ms > 9000000000000
  OR (SELECT pg_catalog.count(*) FROM public.user_roles WHERE user_id=_passenger_id) <> 1
  OR NOT EXISTS (SELECT 1 FROM public.user_roles
     WHERE user_id=_passenger_id AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G329 invalid verified AUTO route' USING ERRCODE='P3291'; END IF;
 verified_at:=pg_catalog.to_timestamp(_verified_at_ms::double precision/1000.0);
 IF verified_at>stamp OR verified_at<stamp-interval '60 seconds'
 THEN RAISE EXCEPTION 'G329 expired or future independent pin evidence' USING ERRCODE='P3291'; END IF;

 -- Single G73 uniqueness boundary: either the route and pin proof BOTH commit,
 -- or neither does. Legacy route keys without proof must never be retrofitted.
 INSERT INTO public.mobility_stage_g73_auto_routes(
  request_key,passenger_id,service,origin_tag,destination_tag,zone_tag,
  distance_meters,duration_seconds,tolls_pyg,expires_at)
 VALUES(
  _request_key,_passenger_id,_service,_origin_tag,_destination_tag,_zone_tag,
  _distance_meters,_duration_seconds,_tolls_pyg,stamp+interval '10 minutes')
 ON CONFLICT(request_key) DO NOTHING RETURNING id INTO route_id;
 IF route_id IS NOT NULL THEN
  INSERT INTO qore_stage_internal.mobility_stage_g329_auto_pinned_routes(
   route_id,passenger_id,request_key,pin_evidence_id,
   pickup_latitude,pickup_longitude,dropoff_latitude,dropoff_longitude,verified_at)
  VALUES(route_id,_passenger_id,_request_key,_pin_evidence_id,
   _pickup_latitude,_pickup_longitude,_dropoff_latitude,_dropoff_longitude,verified_at);
  RETURN route_id;
 END IF;

 SELECT * INTO previous FROM public.mobility_stage_g73_auto_routes
  WHERE request_key=_request_key FOR UPDATE;
 SELECT * INTO bound FROM qore_stage_internal.mobility_stage_g329_auto_pinned_routes pin
  WHERE pin.route_id=previous.id;
 IF NOT FOUND OR previous.id IS NULL OR previous.expires_at<=stamp
  OR ROW(previous.passenger_id,previous.service,previous.origin_tag,
   previous.destination_tag,previous.zone_tag,previous.distance_meters,
   previous.duration_seconds,previous.tolls_pyg) IS DISTINCT FROM
    ROW(_passenger_id,_service,_origin_tag,_destination_tag,_zone_tag,
     _distance_meters,_duration_seconds,_tolls_pyg)
  OR ROW(bound.route_id,bound.passenger_id,bound.request_key,bound.pin_evidence_id,
   bound.pickup_latitude,bound.pickup_longitude,bound.dropoff_latitude,
   bound.dropoff_longitude,bound.verified_at) IS DISTINCT FROM
    ROW(previous.id,_passenger_id,_request_key,_pin_evidence_id,
     _pickup_latitude,_pickup_longitude,_dropoff_latitude,
     _dropoff_longitude,verified_at)
 THEN RAISE EXCEPTION 'G329 conflicting or unbound route idempotency key'
  USING ERRCODE='P3291'; END IF;
 RETURN previous.id;
END $f$;

CREATE FUNCTION qore_stage_internal.mobility_stage_g329_route_pinned_receipt(
 _passenger_id uuid,_route_id uuid
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,
  'ownerId',r.passenger_id,'routeId',r.id,
  'requestKey',r.request_key,'service',r.service,
  'routingVerified',true,
  'expiresAt',pg_catalog.floor(extract(epoch FROM r.expires_at)*1000)::bigint,
  'pinEvidenceId',p.pin_evidence_id,'pinBound',true)
 FROM public.mobility_stage_g73_auto_routes r
 JOIN qore_stage_internal.mobility_stage_g329_auto_pinned_routes p
  ON p.route_id=r.id AND p.passenger_id=r.passenger_id AND p.request_key=r.request_key
 WHERE r.id=_route_id AND r.passenger_id=_passenger_id
  AND r.expires_at>pg_catalog.statement_timestamp()
$f$;

-- No SECURITY DEFINER surface is exposed to anon/authenticated.
CREATE FUNCTION public.mobility_stage_g329_route_pinned(
 _passenger_id uuid,_request_key uuid,_service public.mobility_service_kind,
 _origin_tag text,_destination_tag text,_zone_tag text,
 _distance_meters integer,_duration_seconds integer,_tolls_pyg integer,
 _pin_evidence_id uuid,
 _pickup_latitude double precision,_pickup_longitude double precision,
 _dropoff_latitude double precision,_dropoff_longitude double precision,
 _verified_at_ms bigint
) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.mobility_stage_g329_route_pinned(
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
$f$;

CREATE FUNCTION public.mobility_stage_g329_route_pinned_receipt(
 _passenger_id uuid,_route_id uuid
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.mobility_stage_g329_route_pinned_receipt($1,$2)
$f$;

REVOKE ALL ON FUNCTION public.mobility_stage_g329_route_pinned(
 uuid,uuid,public.mobility_service_kind,text,text,text,integer,integer,integer,
 uuid,double precision,double precision,double precision,double precision,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g329_route_pinned_receipt(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION qore_stage_internal.mobility_stage_g329_route_pinned(
 uuid,uuid,public.mobility_service_kind,text,text,text,integer,integer,integer,
 uuid,double precision,double precision,double precision,double precision,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION qore_stage_internal.mobility_stage_g329_route_pinned_receipt(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;

GRANT USAGE ON SCHEMA qore_stage_internal TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g329_route_pinned(
 uuid,uuid,public.mobility_service_kind,text,text,text,integer,integer,integer,
 uuid,double precision,double precision,double precision,double precision,bigint)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g329_route_pinned_receipt(uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION qore_stage_internal.mobility_stage_g329_route_pinned(
 uuid,uuid,public.mobility_service_kind,text,text,text,integer,integer,integer,
 uuid,double precision,double precision,double precision,double precision,bigint)
 TO service_role;
GRANT EXECUTE ON FUNCTION qore_stage_internal.mobility_stage_g329_route_pinned_receipt(uuid,uuid)
 TO service_role;
