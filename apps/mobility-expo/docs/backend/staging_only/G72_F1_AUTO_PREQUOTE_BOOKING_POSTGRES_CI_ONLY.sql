-- G72 F1 AUTO / ONLY PostgreSQL16 disposable synthetic QA.
-- No remote migration, commercial fare, route attestation, payments, or LIVE.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g71_valid_locked_dossier(uuid,uuid)') IS NULL
 OR to_regclass('public.mobility_stage_fare_rules') IS NULL
 THEN RAISE EXCEPTION 'G72 requires isolated G71/G7 disposable chain'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g72_auto_prequotes (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 service public.mobility_service_kind NOT NULL CHECK(service IN ('economico','confort','xl')),
 origin_tag text NOT NULL CHECK(origin_tag ~ '^[A-Z_]{3,40}$'),
 destination_tag text NOT NULL CHECK(destination_tag ~ '^[A-Z_]{3,40}$'),
 zone_tag text NOT NULL CHECK(zone_tag ~ '^[A-Z_]{3,40}$'),
 rule_id uuid NOT NULL REFERENCES public.mobility_stage_fare_rules(id) ON DELETE RESTRICT,
 distance_meters integer NOT NULL CHECK(distance_meters BETWEEN 0 AND 500000),
 duration_seconds integer NOT NULL CHECK(duration_seconds BETWEEN 0 AND 86400),
 tolls_pyg integer NOT NULL CHECK(tolls_pyg BETWEEN 0 AND 1000000),
 subtotal_pyg integer NOT NULL CHECK(subtotal_pyg BETWEEN 0 AND 100000000),
 commission_pyg integer NOT NULL CHECK(commission_pyg BETWEEN 0 AND 100000000),
 total_pyg integer NOT NULL CHECK(total_pyg BETWEEN 1 AND 100000000),
 quoted_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 booking_key uuid UNIQUE,
 trip_id uuid UNIQUE REFERENCES public.mobility_stage_auto_demo_trips(id) ON DELETE RESTRICT,
 CHECK(origin_tag<>destination_tag),
 CHECK(total_pyg=subtotal_pyg+tolls_pyg),
 CHECK(commission_pyg<=subtotal_pyg),
 CHECK((booking_key IS NULL)=(trip_id IS NULL)),
 CHECK(expires_at>quoted_at)
);
ALTER TABLE public.mobility_stage_g72_auto_prequotes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g72_auto_prequotes FROM PUBLIC,anon,authenticated,service_role;
-- The existing G3 direct service RPC is NOT allowed to bypass prior consent.
-- Preserve its original body as an inaccessible owner-only SQL core.
ALTER FUNCTION public.mobility_stage_auto_demo_request(uuid,uuid,text,text,public.mobility_service_kind)
 RENAME TO mobility_stage_g72_auto_request_core;
REVOKE ALL ON FUNCTION public.mobility_stage_g72_auto_request_core(uuid,uuid,text,text,public.mobility_service_kind)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mobility_stage_g72_prequote(
 _passenger_id uuid,_request_key uuid,_service public.mobility_service_kind,
 _origin_tag text,_destination_tag text,_zone_tag text,
 _distance_meters integer,_duration_seconds integer,_tolls_pyg integer
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE
 prior public.mobility_stage_g72_auto_prequotes%ROWTYPE;
 rule public.mobility_stage_fare_rules%ROWTYPE;
 subtotal bigint; total bigint; commission bigint; out_id uuid;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _passenger_id IS NULL OR _request_key IS NULL
 OR _service NOT IN ('economico','confort','xl')
 OR _origin_tag !~ '^[A-Z_]{3,40}$'
 OR _destination_tag !~ '^[A-Z_]{3,40}$'
 OR _origin_tag=_destination_tag OR _zone_tag !~ '^[A-Z_]{3,40}$'
 OR _distance_meters NOT BETWEEN 0 AND 500000
 OR _duration_seconds NOT BETWEEN 0 AND 86400
 OR _tolls_pyg NOT BETWEEN 0 AND 1000000
 THEN RAISE EXCEPTION 'G72 invalid verified-route input' USING ERRCODE='P7201'; END IF;
 IF (SELECT count(*) FROM public.user_roles
    WHERE user_id=_passenger_id AND role='passenger'::public.app_role)<>1
 OR (SELECT count(*) FROM public.user_roles WHERE user_id=_passenger_id)<>1
 THEN RAISE EXCEPTION 'G72 passenger role required' USING ERRCODE='P7201'; END IF;
 SELECT * INTO prior FROM public.mobility_stage_g72_auto_prequotes
 WHERE request_key=_request_key;
 IF FOUND THEN
  IF ROW(prior.passenger_id,prior.service,prior.origin_tag,prior.destination_tag,
   prior.zone_tag,prior.distance_meters,prior.duration_seconds,prior.tolls_pyg)
   IS DISTINCT FROM ROW(_passenger_id,_service,_origin_tag,_destination_tag,
    _zone_tag,_distance_meters,_duration_seconds,_tolls_pyg)
  THEN RAISE EXCEPTION 'G72 conflicting prequote replay' USING ERRCODE='P7201'; END IF;
  RETURN prior.id;
 END IF;
 SELECT * INTO rule FROM public.mobility_stage_fare_rules
 WHERE mode='AUTO' AND zone_tag=_zone_tag AND active=true
 AND valid_from<=pg_catalog.clock_timestamp() AND valid_until>pg_catalog.clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'G72 no approved AUTO price rule' USING ERRCODE='P7201'; END IF;
 subtotal:=pg_catalog.greatest(rule.minimum_pyg,
  rule.base_pyg::bigint+(_distance_meters::bigint*rule.per_km_pyg+500)/1000
  +(_duration_seconds::bigint*rule.per_minute_pyg+30)/60);
 total:=subtotal+_tolls_pyg;
 commission:=(subtotal*rule.commission_bps+5000)/10000;
 IF total NOT BETWEEN 1 AND 100000000 OR commission>subtotal
 THEN RAISE EXCEPTION 'G72 invalid PYG total' USING ERRCODE='P7201'; END IF;
 INSERT INTO public.mobility_stage_g72_auto_prequotes
 (request_key,passenger_id,service,origin_tag,destination_tag,zone_tag,
  rule_id,distance_meters,duration_seconds,tolls_pyg,subtotal_pyg,commission_pyg,
  total_pyg,expires_at)
 VALUES (_request_key,_passenger_id,_service,_origin_tag,_destination_tag,_zone_tag,
  rule.id,_distance_meters,_duration_seconds,_tolls_pyg,subtotal,commission,
  total,pg_catalog.clock_timestamp()+interval '5 minutes')
 ON CONFLICT(request_key) DO NOTHING RETURNING id INTO out_id;
 IF out_id IS NULL THEN
  SELECT * INTO prior FROM public.mobility_stage_g72_auto_prequotes WHERE request_key=_request_key;
  IF NOT FOUND OR ROW(prior.passenger_id,prior.service,prior.origin_tag,prior.destination_tag,
   prior.zone_tag,prior.distance_meters,prior.duration_seconds,prior.tolls_pyg)
   IS DISTINCT FROM ROW(_passenger_id,_service,_origin_tag,_destination_tag,
    _zone_tag,_distance_meters,_duration_seconds,_tolls_pyg)
  THEN RAISE EXCEPTION 'G72 concurrent replay conflict' USING ERRCODE='P7201'; END IF;
  RETURN prior.id;
 END IF;
 RETURN out_id;
END $f$;

CREATE FUNCTION public.mobility_stage_g72_prequote_receipt(_passenger_id uuid,_quote_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
DECLARE q public.mobility_stage_g72_auto_prequotes%ROWTYPE; version text;
BEGIN
 SELECT * INTO q FROM public.mobility_stage_g72_auto_prequotes
 WHERE id=_quote_id AND passenger_id=_passenger_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT rule_key INTO version FROM public.mobility_stage_fare_rules WHERE id=q.rule_id;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,
  'ownerId',q.passenger_id,'quoteId',q.id,'requestKey',q.request_key,
  'fareMode','AUTO','service',q.service,'originTag',q.origin_tag,
  'destinationTag',q.destination_tag,'zoneTag',q.zone_tag,
  'amountGs',q.total_pyg,'subtotalGs',q.subtotal_pyg,
  'commissionGs',q.commission_pyg,'providerGs',q.total_pyg-q.commission_pyg,
  'fareVersion',version,'expiresAt',q.expires_at,
  'serverPriced',true,'serverPersisted',true,'bookingId',q.trip_id);
END $f$;

CREATE FUNCTION public.mobility_stage_g72_book(_passenger_id uuid,_quote_id uuid,_request_key uuid)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE q public.mobility_stage_g72_auto_prequotes%ROWTYPE; trip uuid;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _passenger_id IS NULL OR _quote_id IS NULL OR _request_key IS NULL
 THEN RAISE EXCEPTION 'G72 invalid booking' USING ERRCODE='P7201'; END IF;
 SELECT * INTO q FROM public.mobility_stage_g72_auto_prequotes
 WHERE id=_quote_id FOR UPDATE;
 IF NOT FOUND OR q.passenger_id<>_passenger_id
 THEN RAISE EXCEPTION 'G72 quote missing or foreign' USING ERRCODE='P7201'; END IF;
 -- Lost ACK: original committed receipt is stable even after quote expiry.
 IF q.trip_id IS NOT NULL THEN
  IF q.booking_key<>_request_key
  THEN RAISE EXCEPTION 'G72 quote booked with another key' USING ERRCODE='P7201'; END IF;
  RETURN q.trip_id;
 END IF;
 IF q.expires_at<=pg_catalog.clock_timestamp()
 OR (SELECT count(*) FROM public.user_roles WHERE user_id=_passenger_id)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
     WHERE user_id=_passenger_id AND role='passenger'::public.app_role)
 OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_fare_rules
  WHERE id=q.rule_id AND active=true AND valid_until>pg_catalog.clock_timestamp())
 THEN RAISE EXCEPTION 'G72 expired quote or revoked policy' USING ERRCODE='P7201'; END IF;
 -- SQL call is in the SAME transaction as quote acceptance; all-or-nothing.
 trip:=public.mobility_stage_g72_auto_request_core(_passenger_id,_request_key,
  q.origin_tag,q.destination_tag,q.service);
 UPDATE public.mobility_stage_g72_auto_prequotes
 SET booking_key=_request_key,trip_id=trip WHERE id=q.id;
 RETURN trip;
END $f$;

CREATE FUNCTION public.mobility_stage_g72_booking_receipt(_passenger_id uuid,_request_key uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
DECLARE q public.mobility_stage_g72_auto_prequotes%ROWTYPE; ver bigint;
BEGIN
 SELECT * INTO q FROM public.mobility_stage_g72_auto_prequotes
 WHERE booking_key=_request_key AND passenger_id=_passenger_id AND trip_id IS NOT NULL;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT revision INTO ver FROM public.mobility_stage_auto_demo_trips
 WHERE id=q.trip_id AND passenger_id=_passenger_id AND request_key=_request_key;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','commercialEnabled',false,'ownerId',_passenger_id,
  'requestKey',_request_key,'operation','rideRequest','serviceId',q.trip_id,
  'revision',ver,'serverPersisted',true,'status','ACCEPTED_QA');
END $f$;

-- Owners alone can execute internals; only 4 narrow service RPCs are exposed.
REVOKE ALL ON FUNCTION public.mobility_stage_g72_prequote(uuid,uuid,public.mobility_service_kind,text,text,text,integer,integer,integer)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g72_prequote_receipt(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g72_book(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g72_booking_receipt(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g72_prequote(uuid,uuid,public.mobility_service_kind,text,text,text,integer,integer,integer)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g72_prequote_receipt(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g72_book(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g72_booking_receipt(uuid,uuid) TO service_role;
COMMIT;
