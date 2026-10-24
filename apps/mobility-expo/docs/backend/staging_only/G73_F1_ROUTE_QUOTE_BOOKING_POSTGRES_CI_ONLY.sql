-- G73: Route -> price -> consent -> booking, PG16 DISPOSABLE QA ONLY.
-- Requires full G72 QA chain. No map provider, LIVE fare, remote DDL or PSP.
DO $g$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g72_book(uuid,uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G73 isolated G72 prerequisites missing'; END IF;
END $g$;
BEGIN;
CREATE TABLE public.mobility_stage_g73_auto_routes (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 service public.mobility_service_kind NOT NULL CHECK(service IN ('economico','confort','xl')),
 origin_tag text NOT NULL CHECK(origin_tag ~ '^[A-Z_]{3,40}$'),
 destination_tag text NOT NULL CHECK(destination_tag ~ '^[A-Z_]{3,40}$'),
 zone_tag text NOT NULL CHECK(zone_tag ~ '^[A-Z_]{3,40}$'),
 distance_meters integer NOT NULL CHECK(distance_meters BETWEEN 0 AND 500000),
 duration_seconds integer NOT NULL CHECK(duration_seconds BETWEEN 0 AND 86400),
 tolls_pyg integer NOT NULL CHECK(tolls_pyg BETWEEN 0 AND 1000000),
 verified_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 CHECK(origin_tag<>destination_tag),
 CHECK(expires_at>verified_at)
);
ALTER TABLE public.mobility_stage_g73_auto_routes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g73_auto_routes FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.mobility_stage_g72_auto_prequotes
 ADD COLUMN route_id uuid REFERENCES public.mobility_stage_g73_auto_routes(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX mobility_stage_g73_one_quote_per_route
 ON public.mobility_stage_g72_auto_prequotes(route_id) WHERE route_id IS NOT NULL;

-- No second booking path through G72 once route-bound G73 is installed.
REVOKE ALL ON FUNCTION public.mobility_stage_g72_prequote(
 uuid,uuid,public.mobility_service_kind,text,text,text,integer,integer,integer)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g72_book(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mobility_stage_g73_route(
 _passenger_id uuid,_request_key uuid,_service public.mobility_service_kind,
 _origin_tag text,_destination_tag text,_zone_tag text,
 _distance_meters integer,_duration_seconds integer,_tolls_pyg integer
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE r public.mobility_stage_g73_auto_routes%ROWTYPE; out_id uuid;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _passenger_id IS NULL OR _request_key IS NULL
 OR _service NOT IN ('economico','confort','xl')
 OR _origin_tag !~ '^[A-Z_]{3,40}$'
 OR _destination_tag !~ '^[A-Z_]{3,40}$' OR _origin_tag=_destination_tag
 OR _zone_tag !~ '^[A-Z_]{3,40}$'
 OR _distance_meters NOT BETWEEN 0 AND 500000
 OR _duration_seconds NOT BETWEEN 0 AND 86400
 OR _tolls_pyg NOT BETWEEN 0 AND 1000000
 OR (SELECT count(*) FROM public.user_roles WHERE user_id=_passenger_id)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
 WHERE user_id=_passenger_id AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G73 route attestation or role invalid' USING ERRCODE='P7301'; END IF;
 INSERT INTO public.mobility_stage_g73_auto_routes(
  request_key,passenger_id,service,origin_tag,destination_tag,zone_tag,
  distance_meters,duration_seconds,tolls_pyg,expires_at)
 VALUES(_request_key,_passenger_id,_service,_origin_tag,_destination_tag,
  _zone_tag,_distance_meters,_duration_seconds,_tolls_pyg,
  pg_catalog.clock_timestamp()+interval '10 minutes')
 ON CONFLICT(request_key) DO NOTHING RETURNING id INTO out_id;
 IF out_id IS NOT NULL THEN RETURN out_id; END IF;
 SELECT * INTO r FROM public.mobility_stage_g73_auto_routes WHERE request_key=_request_key;
 IF NOT FOUND OR ROW(r.passenger_id,r.service,r.origin_tag,r.destination_tag,
  r.zone_tag,r.distance_meters,r.duration_seconds,r.tolls_pyg)
  IS DISTINCT FROM ROW(_passenger_id,_service,_origin_tag,_destination_tag,
  _zone_tag,_distance_meters,_duration_seconds,_tolls_pyg)
 THEN RAISE EXCEPTION 'G73 conflicting route request' USING ERRCODE='P7301'; END IF;
 RETURN r.id;
END $f$;

CREATE FUNCTION public.mobility_stage_g73_route_receipt(_passenger_id uuid,_route_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,'ownerId',r.passenger_id,
  'routeId',r.id,'requestKey',r.request_key,'service',r.service,
  'routingVerified',true,'expiresAt',
  floor(pg_catalog.extract(epoch from r.expires_at)*1000)::bigint)
 FROM public.mobility_stage_g73_auto_routes r
 WHERE r.passenger_id=$1 AND r.id=$2
$f$;

CREATE FUNCTION public.mobility_stage_g73_quote(
 _passenger_id uuid,_route_id uuid,_quote_request_key uuid)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE r public.mobility_stage_g73_auto_routes%ROWTYPE;
 q public.mobility_stage_g72_auto_prequotes%ROWTYPE;
 out_id uuid;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _passenger_id IS NULL OR _route_id IS NULL OR _quote_request_key IS NULL
 THEN RAISE EXCEPTION 'G73 invalid quote request' USING ERRCODE='P7301'; END IF;
 SELECT * INTO r FROM public.mobility_stage_g73_auto_routes
 WHERE id=_route_id FOR UPDATE;
 IF NOT FOUND OR r.passenger_id<>_passenger_id OR r.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G73 route expired or unavailable' USING ERRCODE='P7301'; END IF;
 SELECT * INTO q FROM public.mobility_stage_g72_auto_prequotes
 WHERE request_key=_quote_request_key;
 IF FOUND AND (q.passenger_id<>_passenger_id OR q.route_id IS DISTINCT FROM _route_id)
 THEN RAISE EXCEPTION 'G73 conflicting quote replay or legacy unbound quote'
 USING ERRCODE='P7301'; END IF;
 out_id:=public.mobility_stage_g72_prequote(
  _passenger_id,_quote_request_key,r.service,r.origin_tag,r.destination_tag,
  r.zone_tag,r.distance_meters,r.duration_seconds,r.tolls_pyg);
 UPDATE public.mobility_stage_g72_auto_prequotes SET route_id=_route_id
 WHERE id=out_id AND route_id IS NULL;
 SELECT * INTO q FROM public.mobility_stage_g72_auto_prequotes WHERE id=out_id;
 IF NOT FOUND OR q.route_id IS DISTINCT FROM _route_id
 THEN RAISE EXCEPTION 'G73 price not bound to trusted route' USING ERRCODE='P7301'; END IF;
 RETURN out_id;
END $f$;

CREATE FUNCTION public.mobility_stage_g73_quote_receipt(_passenger_id uuid,_quote_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,'ownerId',q.passenger_id,
  'routeId',r.id,'quoteId',q.id,'quoteRequestKey',q.request_key,
  'fareMode','AUTO','service',r.service,'currency','PYG',
  'amountGs',q.total_pyg,'fareVersion',f.rule_key,
  'expiresAt',floor(pg_catalog.extract(epoch from q.expires_at)*1000)::bigint,
  'serverPriced',true,'routingVerified',true,'status','QUOTED_QA')
 FROM public.mobility_stage_g72_auto_prequotes q
 JOIN public.mobility_stage_g73_auto_routes r ON r.id=q.route_id
 JOIN public.mobility_stage_fare_rules f ON f.id=q.rule_id
 WHERE q.passenger_id=$1 AND q.id=$2 AND r.passenger_id=$1
$f$;

CREATE FUNCTION public.mobility_stage_g73_book(
 _passenger_id uuid,_quote_id uuid,_request_key uuid)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE q public.mobility_stage_g72_auto_prequotes%ROWTYPE;
 r public.mobility_stage_g73_auto_routes%ROWTYPE;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _passenger_id IS NULL OR _quote_id IS NULL OR _request_key IS NULL
 THEN RAISE EXCEPTION 'G73 invalid accept request' USING ERRCODE='P7301'; END IF;
 SELECT * INTO q FROM public.mobility_stage_g72_auto_prequotes
 WHERE id=_quote_id FOR UPDATE;
 IF NOT FOUND OR q.passenger_id<>_passenger_id OR q.route_id IS NULL
 THEN RAISE EXCEPTION 'G73 missing quote route binding' USING ERRCODE='P7301'; END IF;
 SELECT * INTO r FROM public.mobility_stage_g73_auto_routes
 WHERE id=q.route_id AND passenger_id=_passenger_id;
 IF NOT FOUND OR (q.trip_id IS NULL AND r.expires_at<=pg_catalog.clock_timestamp())
 THEN RAISE EXCEPTION 'G73 unverified or expired route' USING ERRCODE='P7301'; END IF;
 RETURN public.mobility_stage_g72_book(_passenger_id,_quote_id,_request_key);
END $f$;

CREATE FUNCTION public.mobility_stage_g73_booking_receipt(
 _passenger_id uuid,_request_key uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,'ownerId',q.passenger_id,
  'requestKey',q.booking_key,'quoteId',q.id,'routeId',q.route_id,
  'tripId',q.trip_id,'revision',t.revision,'serverPersisted',true,'status','ACCEPTED_QA')
 FROM public.mobility_stage_g72_auto_prequotes q
 JOIN public.mobility_stage_auto_demo_trips t ON t.id=q.trip_id
 WHERE q.passenger_id=$1 AND q.booking_key=$2 AND t.passenger_id=$1
 AND t.request_key=$2
$f$;

REVOKE ALL ON FUNCTION public.mobility_stage_g73_route(
 uuid,uuid,public.mobility_service_kind,text,text,text,integer,integer,integer)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g73_route_receipt(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g73_quote(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g73_quote_receipt(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g73_book(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g73_booking_receipt(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g73_route(
 uuid,uuid,public.mobility_service_kind,text,text,text,integer,integer,integer)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g73_route_receipt(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g73_quote(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g73_quote_receipt(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g73_book(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g73_booking_receipt(uuid,uuid) TO service_role;
COMMIT;
