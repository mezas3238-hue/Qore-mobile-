-- G262. Isolated Supabase STAGING PostgreSQL 17, code-first pending review.
-- PRIVATE, NON-COMMERCIAL. Never install G72/G73 CI_ONLY SQL in remote DB.
-- Route metrics must come from an independently verified backend road provider.
-- SQL cannot itself prove road measurements. LIVE/payment/PSP are not enabled.
-- Do not apply until public signup is disabled, CI passes, and change is approved.

DO $guard$ BEGIN
 IF to_regclass('public.mobility_stage_auto_demo_trips') IS NULL
 OR to_regclass('public.mobility_stage_fare_rules') IS NULL
 OR to_regclass('public.user_roles') IS NULL
 OR to_regprocedure('public.mobility_stage_auto_demo_request(uuid,uuid,text,text,public.mobility_service_kind)') IS NULL
 OR to_regnamespace('qore_stage_internal') IS NULL
 THEN RAISE EXCEPTION 'G262 requires existing QORE STAGING base, stop without DDL'; END IF;
END $guard$;

CREATE TABLE public.mobility_stage_g73_auto_routes (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 service public.mobility_service_kind NOT NULL
   CHECK (service IN ('economico','confort','xl')),
 origin_tag text NOT NULL CHECK(origin_tag ~ '^[A-Z_]{3,40}$'),
 destination_tag text NOT NULL CHECK(destination_tag ~ '^[A-Z_]{3,40}$'),
 zone_tag text NOT NULL CHECK(zone_tag ~ '^[A-Z_]{3,40}$'),
 distance_meters integer NOT NULL CHECK(distance_meters BETWEEN 1 AND 500000),
 duration_seconds integer NOT NULL CHECK(duration_seconds BETWEEN 1 AND 86400),
 tolls_pyg integer NOT NULL CHECK(tolls_pyg BETWEEN 0 AND 1000000),
 verified_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 CHECK(origin_tag<>destination_tag),
 CHECK(expires_at>verified_at)
);
ALTER TABLE public.mobility_stage_g73_auto_routes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g73_auto_routes FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE public.mobility_stage_g262_auto_prequotes (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 route_id uuid NOT NULL UNIQUE REFERENCES public.mobility_stage_g73_auto_routes(id) ON DELETE RESTRICT,
 rule_id uuid NOT NULL REFERENCES public.mobility_stage_fare_rules(id) ON DELETE RESTRICT,
 total_pyg integer NOT NULL CHECK(total_pyg BETWEEN 0 AND 100000000),
 commission_pyg integer NOT NULL CHECK(commission_pyg BETWEEN 0 AND total_pyg),
 quoted_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 booking_key uuid UNIQUE,
 trip_id uuid UNIQUE REFERENCES public.mobility_stage_auto_demo_trips(id) ON DELETE RESTRICT,
 CHECK ((booking_key IS NULL)=(trip_id IS NULL)),
 CHECK(expires_at>quoted_at)
);
CREATE INDEX mobility_stage_g262_owner_quote_idx
 ON public.mobility_stage_g262_auto_prequotes(passenger_id,quoted_at DESC);
ALTER TABLE public.mobility_stage_g262_auto_prequotes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g262_auto_prequotes FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION qore_stage_internal.mobility_stage_g73_route(
 _passenger_id uuid,_request_key uuid,_service public.mobility_service_kind,
 _origin_tag text,_destination_tag text,_zone_tag text,
 _distance_meters integer,_duration_seconds integer,_tolls_pyg integer
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE existing public.mobility_stage_g73_auto_routes%ROWTYPE; new_id uuid;
BEGIN
 IF _passenger_id IS NULL OR _request_key IS NULL
 OR _service IS NULL OR _service NOT IN ('economico','confort','xl')
 OR _origin_tag IS NULL OR _origin_tag !~ '^[A-Z_]{3,40}$'
 OR _destination_tag IS NULL OR _destination_tag !~ '^[A-Z_]{3,40}$'
 OR _origin_tag=_destination_tag
 OR _zone_tag IS NULL OR _zone_tag !~ '^[A-Z_]{3,40}$'
 OR _distance_meters IS NULL OR _distance_meters NOT BETWEEN 1 AND 500000
 OR _duration_seconds IS NULL OR _duration_seconds NOT BETWEEN 1 AND 86400
 OR _tolls_pyg IS NULL OR _tolls_pyg NOT BETWEEN 0 AND 1000000
 OR (SELECT count(*) FROM public.user_roles WHERE user_id=_passenger_id)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
   WHERE user_id=_passenger_id AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G262 invalid backend route/actor' USING ERRCODE='P2621'; END IF;
 INSERT INTO public.mobility_stage_g73_auto_routes(
  request_key,passenger_id,service,origin_tag,destination_tag,zone_tag,
  distance_meters,duration_seconds,tolls_pyg,expires_at)
 VALUES(_request_key,_passenger_id,_service,_origin_tag,_destination_tag,
  _zone_tag,_distance_meters,_duration_seconds,_tolls_pyg,
  pg_catalog.clock_timestamp()+interval '10 minutes')
 ON CONFLICT(request_key) DO NOTHING RETURNING id INTO new_id;
 IF new_id IS NOT NULL THEN RETURN new_id; END IF;
 SELECT * INTO existing FROM public.mobility_stage_g73_auto_routes WHERE request_key=_request_key;
 IF NOT FOUND OR ROW(existing.passenger_id,existing.service,existing.origin_tag,
   existing.destination_tag,existing.zone_tag,existing.distance_meters,
   existing.duration_seconds,existing.tolls_pyg)
   IS DISTINCT FROM ROW(_passenger_id,_service,_origin_tag,_destination_tag,
   _zone_tag,_distance_meters,_duration_seconds,_tolls_pyg)
 THEN RAISE EXCEPTION 'G262 conflicting route key' USING ERRCODE='P2621'; END IF;
 RETURN existing.id;
END $f$;

CREATE FUNCTION qore_stage_internal.mobility_stage_g73_route_receipt(
 _passenger_id uuid,_route_id uuid
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,'ownerId',r.passenger_id,
  'routeId',r.id,'requestKey',r.request_key,'service',r.service,
  'routingVerified',true,'expiresAt',
  pg_catalog.floor(extract(epoch from r.expires_at)*1000)::bigint)
 FROM public.mobility_stage_g73_auto_routes r
 WHERE r.passenger_id=$1 AND r.id=$2
$f$;

CREATE FUNCTION qore_stage_internal.mobility_stage_g73_quote(
 _passenger_id uuid,_route_id uuid,_quote_request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE r public.mobility_stage_g73_auto_routes%ROWTYPE;
 old public.mobility_stage_g262_auto_prequotes%ROWTYPE;
 rule public.mobility_stage_fare_rules%ROWTYPE;
 rule_count integer; subtotal bigint; total bigint; commission bigint;
 new_id uuid;
BEGIN
 IF _passenger_id IS NULL OR _route_id IS NULL OR _quote_request_key IS NULL
 THEN RAISE EXCEPTION 'G262 quote requires owner and route' USING ERRCODE='P2622'; END IF;
 SELECT * INTO r FROM public.mobility_stage_g73_auto_routes
 WHERE id=_route_id AND passenger_id=_passenger_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G262 route ownership denied' USING ERRCODE='P2622'; END IF;
 SELECT * INTO old FROM public.mobility_stage_g262_auto_prequotes
 WHERE request_key=_quote_request_key FOR UPDATE;
 IF FOUND THEN
  IF old.passenger_id<>_passenger_id OR old.route_id<>_route_id
  THEN RAISE EXCEPTION 'G262 conflicting quote replay' USING ERRCODE='P2622'; END IF;
  RETURN old.id;
 END IF;
 IF r.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G262 expired verified route' USING ERRCODE='P2622'; END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g262_auto_prequotes WHERE route_id=_route_id)
 THEN RAISE EXCEPTION 'G262 route already quoted with another key' USING ERRCODE='P2622'; END IF;
 SELECT count(*) INTO rule_count FROM public.mobility_stage_fare_rules
 WHERE mode='AUTO'::public.mobility_stage_fare_mode
  AND zone_tag=r.zone_tag AND active=true
  AND valid_from<=pg_catalog.statement_timestamp()
  AND valid_until>pg_catalog.statement_timestamp();
 IF rule_count<>1 THEN RAISE EXCEPTION 'G262 requires one approved active AUTO rule' USING ERRCODE='P2622'; END IF;
 SELECT * INTO rule FROM public.mobility_stage_fare_rules
 WHERE mode='AUTO'::public.mobility_stage_fare_mode
  AND zone_tag=r.zone_tag AND active=true
  AND valid_from<=pg_catalog.statement_timestamp()
  AND valid_until>pg_catalog.statement_timestamp() FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G262 pricing rule unavailable' USING ERRCODE='P2622'; END IF;
 subtotal:=pg_catalog.greatest(rule.minimum_pyg::bigint,
   rule.base_pyg::bigint+(r.distance_meters::bigint*rule.per_km_pyg+500)/1000+
   (r.duration_seconds::bigint*rule.per_minute_pyg+30)/60);
 total:=subtotal+r.tolls_pyg;
 commission:=(subtotal*rule.commission_bps+5000)/10000;
 IF total NOT BETWEEN 0 AND 100000000 OR commission<0 OR commission>total
 THEN RAISE EXCEPTION 'G262 fare limits exceeded' USING ERRCODE='P2622'; END IF;
 INSERT INTO public.mobility_stage_g262_auto_prequotes(
  request_key,passenger_id,route_id,rule_id,total_pyg,commission_pyg,expires_at)
 VALUES(_quote_request_key,_passenger_id,r.id,rule.id,total,commission,
  pg_catalog.least(r.expires_at,pg_catalog.clock_timestamp()+interval '5 minutes'))
 RETURNING id INTO new_id;
 RETURN new_id;
END $f$;

CREATE FUNCTION qore_stage_internal.mobility_stage_g73_quote_receipt(
 _passenger_id uuid,_quote_id uuid
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,'ownerId',q.passenger_id,
  'routeId',r.id,'quoteId',q.id,'quoteRequestKey',q.request_key,
  'fareMode','AUTO','service',r.service,'currency','PYG',
  'amountGs',q.total_pyg,'fareVersion',f.rule_key,
  'expiresAt',pg_catalog.floor(extract(epoch from q.expires_at)*1000)::bigint,
  'serverPriced',true,'routingVerified',true,'status','QUOTED_QA')
 FROM public.mobility_stage_g262_auto_prequotes q
 JOIN public.mobility_stage_g73_auto_routes r ON r.id=q.route_id
 JOIN public.mobility_stage_fare_rules f ON f.id=q.rule_id
 WHERE q.passenger_id=$1 AND q.id=$2 AND r.passenger_id=$1
$f$;

CREATE FUNCTION qore_stage_internal.mobility_stage_g73_book(
 _passenger_id uuid,_quote_id uuid,_request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE q public.mobility_stage_g262_auto_prequotes%ROWTYPE;
 r public.mobility_stage_g73_auto_routes%ROWTYPE; result_id uuid;
BEGIN
 IF _passenger_id IS NULL OR _quote_id IS NULL OR _request_key IS NULL
 THEN RAISE EXCEPTION 'G262 invalid booking consent' USING ERRCODE='P2623'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(_passenger_id::text,262));
 SELECT * INTO q FROM public.mobility_stage_g262_auto_prequotes
 WHERE id=_quote_id AND passenger_id=_passenger_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G262 quote not owned' USING ERRCODE='P2623'; END IF;
 IF q.trip_id IS NOT NULL THEN
  IF q.booking_key IS DISTINCT FROM _request_key
  THEN RAISE EXCEPTION 'G262 quote already booked under another key' USING ERRCODE='P2623'; END IF;
  RETURN q.trip_id;
 END IF;
 IF q.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G262 quote consent expired' USING ERRCODE='P2623'; END IF;
 SELECT * INTO r FROM public.mobility_stage_g73_auto_routes
 WHERE id=q.route_id AND passenger_id=_passenger_id;
 IF NOT FOUND OR r.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G262 route expired at booking' USING ERRCODE='P2623'; END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_trips
  WHERE passenger_id=_passenger_id AND status IN ('searching','accepted','arriving','in_progress'))
 THEN RAISE EXCEPTION 'G262 passenger has active ride' USING ERRCODE='P2623'; END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g262_auto_prequotes
  WHERE booking_key=_request_key AND id<>_quote_id)
 THEN RAISE EXCEPTION 'G262 duplicate booking key' USING ERRCODE='P2623'; END IF;
 result_id:=public.mobility_stage_auto_demo_request(
  _passenger_id,_request_key,r.origin_tag,r.destination_tag,r.service);
 UPDATE public.mobility_stage_g262_auto_prequotes
 SET booking_key=_request_key,trip_id=result_id WHERE id=q.id;
 RETURN result_id;
END $f$;

CREATE FUNCTION qore_stage_internal.mobility_stage_g73_booking_receipt(
 _passenger_id uuid,_request_key uuid
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,'ownerId',q.passenger_id,
  'requestKey',q.booking_key,'quoteId',q.id,'routeId',q.route_id,
  'tripId',q.trip_id,'revision',t.revision,'serverPersisted',true,'status','ACCEPTED_QA')
 FROM public.mobility_stage_g262_auto_prequotes q
 JOIN public.mobility_stage_auto_demo_trips t ON
  t.id=q.trip_id AND t.passenger_id=q.passenger_id AND t.request_key=q.booking_key
 WHERE q.passenger_id=$1 AND q.booking_key=$2
$f$;

-- Public API wrappers are SECURITY INVOKER, only service_role can execute.
CREATE FUNCTION public.mobility_stage_g73_route(
 _passenger_id uuid,_request_key uuid,_service public.mobility_service_kind,
 _origin_tag text,_destination_tag text,_zone_tag text,
 _distance_meters integer,_duration_seconds integer,_tolls_pyg integer
) RETURNS uuid LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.mobility_stage_g73_route($1,$2,$3,$4,$5,$6,$7,$8,$9)
$f$;
CREATE FUNCTION public.mobility_stage_g73_route_receipt(_passenger_id uuid,_route_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.mobility_stage_g73_route_receipt($1,$2)
$f$;
CREATE FUNCTION public.mobility_stage_g73_quote(_passenger_id uuid,_route_id uuid,_quote_request_key uuid)
RETURNS uuid LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.mobility_stage_g73_quote($1,$2,$3)
$f$;
CREATE FUNCTION public.mobility_stage_g73_quote_receipt(_passenger_id uuid,_quote_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.mobility_stage_g73_quote_receipt($1,$2)
$f$;
CREATE FUNCTION public.mobility_stage_g73_book(_passenger_id uuid,_quote_id uuid,_request_key uuid)
RETURNS uuid LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.mobility_stage_g73_book($1,$2,$3)
$f$;
CREATE FUNCTION public.mobility_stage_g73_booking_receipt(_passenger_id uuid,_request_key uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $f$
 SELECT qore_stage_internal.mobility_stage_g73_booking_receipt($1,$2)
$f$;

-- Remove PostgreSQL default PUBLIC function EXECUTE; protect both layers.
DO $acl$ DECLARE sig text;
BEGIN
 FOR sig IN SELECT x FROM (VALUES
  ('mobility_stage_g73_route(uuid,uuid,public.mobility_service_kind,text,text,text,integer,integer,integer)'),
  ('mobility_stage_g73_route_receipt(uuid,uuid)'),
  ('mobility_stage_g73_quote(uuid,uuid,uuid)'),
  ('mobility_stage_g73_quote_receipt(uuid,uuid)'),
  ('mobility_stage_g73_book(uuid,uuid,uuid)'),
  ('mobility_stage_g73_booking_receipt(uuid,uuid)')
 ) AS v(x) LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION public.'||sig||' FROM PUBLIC,anon,authenticated,service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION qore_stage_internal.'||sig||' FROM PUBLIC,anon,authenticated,service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||sig||' TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION qore_stage_internal.'||sig||' TO service_role';
 END LOOP;
END $acl$;
