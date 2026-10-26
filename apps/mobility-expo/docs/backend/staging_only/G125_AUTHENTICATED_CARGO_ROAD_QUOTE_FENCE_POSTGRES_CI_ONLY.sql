-- G125: SQL-bound independent road attestation before ALL NEW cargo G7 quotes.
-- CI-only disposable PG16. Evidence MUST be supplied by a trusted server-side
-- verifier, never derived from Client request. No external provider is enabled.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g124_delivery_tariff_policy') IS NULL
 OR to_regprocedure('public.mobility_stage_fare_quote(uuid,uuid,public.mobility_stage_fare_mode,public.mobility_stage_fare_subject,uuid,text,integer,integer,integer)') IS NULL
 THEN RAISE EXCEPTION 'G125 only disposable QA with G124'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g125_cargo_road_attestations(
 delivery_id uuid PRIMARY KEY REFERENCES public.mobility_stage_deliveries(id) ON DELETE RESTRICT,
 sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 evidence_id uuid NOT NULL UNIQUE,
 vehicle_kind public.mobility_vehicle_kind NOT NULL,
 rule_id uuid NOT NULL REFERENCES public.mobility_stage_fare_rules(id),
 zone_tag text NOT NULL CHECK(zone_tag ~ '^[A-Z_]{3,40}$'),
 pickup_tag text NOT NULL,
 delivery_tag text NOT NULL,
 distance_meters integer NOT NULL CHECK(distance_meters BETWEEN 1 AND 500000),
 duration_seconds integer NOT NULL CHECK(duration_seconds BETWEEN 1 AND 86400),
 tolls_pyg integer NOT NULL CHECK(tolls_pyg BETWEEN 0 AND 1000000),
 verified_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 provider_status text NOT NULL DEFAULT 'INDEPENDENT_ROAD_ATTESTED_QA'
  CHECK(provider_status='INDEPENDENT_ROAD_ATTESTED_QA'),
 CHECK(expires_at>verified_at)
);
ALTER TABLE public.mobility_stage_g125_cargo_road_attestations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g125_cargo_road_attestations
 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mobility_stage_g125_record_cargo_road_qa(
 _sender uuid,_delivery uuid,_evidence uuid,
 _vehicle text,_zone text,_pickup text,_destination text,
 _meters integer,_seconds integer,_tolls integer,
 _verified_at_ms bigint,_expires_at_ms bigint
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE d public.mobility_stage_deliveries%ROWTYPE;
 p public.mobility_stage_g124_delivery_tariff_policy%ROWTYPE;
 r public.mobility_stage_fare_rules%ROWTYPE;
 old public.mobility_stage_g125_cargo_road_attestations%ROWTYPE;
 verified_at timestamptz; expiry timestamptz; at timestamptz;
BEGIN
 at:=pg_catalog.clock_timestamp();
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _sender IS NULL OR _delivery IS NULL OR _evidence IS NULL
 OR _vehicle NOT IN ('AUTO','MOTO') OR _zone !~ '^(AUTO|MOTO)_[A-Z_]{3,20}$'
 OR _zone<>_vehicle||'_'||pg_catalog.substring(_zone FROM pg_catalog.length(_vehicle)+2)
 OR _pickup !~ '^[A-Z_]{3,60}$' OR _destination !~ '^[A-Z_]{3,60}$'
 OR _pickup=_destination OR _meters NOT BETWEEN 1 AND 500000
 OR _seconds NOT BETWEEN 1 AND 86400 OR _tolls NOT BETWEEN 0 AND 1000000
 OR _verified_at_ms IS NULL OR _expires_at_ms IS NULL
 OR _verified_at_ms NOT BETWEEN 1000000000000 AND 9000000000000
 OR _expires_at_ms NOT BETWEEN 1000000000000 AND 9000000000000
 THEN RAISE EXCEPTION 'G125 invalid independent route attestation'
  USING ERRCODE='P1251'; END IF;
 verified_at:=pg_catalog.to_timestamp(_verified_at_ms / 1000.0);
 expiry:=pg_catalog.to_timestamp(_expires_at_ms / 1000.0);
 IF verified_at>at OR verified_at<at-interval '60 seconds'
 OR expiry<=at OR expiry>verified_at+interval '60 seconds'
 THEN RAISE EXCEPTION 'G125 expired or future route evidence'
  USING ERRCODE='P1251'; END IF;
 SELECT * INTO d FROM public.mobility_stage_deliveries
 WHERE id=_delivery AND sender_id=_sender FOR UPDATE;
 IF NOT FOUND OR d.status<>'requested' OR d.courier_id IS NOT NULL
 OR d.requested_vehicle_kind::text<>_vehicle
 OR d.pickup_tag<>_pickup OR d.delivery_tag<>_destination
 OR (SELECT count(*) FROM public.user_roles WHERE user_id=_sender)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
  WHERE user_id=_sender AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G125 sender, delivery or vehicle not independently matched'
  USING ERRCODE='P1251'; END IF;
 SELECT * INTO old FROM public.mobility_stage_g125_cargo_road_attestations
 WHERE delivery_id=_delivery;
 IF FOUND THEN
  IF old.sender_id<>_sender OR old.evidence_id<>_evidence
  OR old.vehicle_kind::text<>_vehicle OR old.zone_tag<>_zone
  OR old.pickup_tag<>_pickup OR old.delivery_tag<>_destination
  OR old.distance_meters<>_meters OR old.duration_seconds<>_seconds
  OR old.tolls_pyg<>_tolls OR old.verified_at<>verified_at
  OR old.expires_at<>expiry OR old.expires_at<=at
  THEN RAISE EXCEPTION 'G125 immutable road evidence replay mismatch'
   USING ERRCODE='P1251'; END IF;
 ELSE
  SELECT * INTO p FROM public.mobility_stage_g124_delivery_tariff_policy
   WHERE vehicle_kind=_vehicle::public.mobility_vehicle_kind
   AND cargo_zone=pg_catalog.substring(_zone FROM pg_catalog.length(_vehicle)+2)
   FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'G125 no Owner cargo tariff'
   USING ERRCODE='P1251'; END IF;
  SELECT * INTO r FROM public.mobility_stage_fare_rules
   WHERE id=p.current_rule_id FOR SHARE;
  IF NOT FOUND OR r.mode<>'DELIVERY' OR r.zone_tag<>_zone
  OR r.active IS NOT TRUE OR r.valid_from>at OR r.valid_until<=at
  OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_g122_delivery_rate_vehicle_qa b
   WHERE b.rule_id=r.id AND b.vehicle_kind=d.requested_vehicle_kind)
  THEN RAISE EXCEPTION 'G125 approved Owner vehicle tariff unavailable'
   USING ERRCODE='P1251'; END IF;
  INSERT INTO public.mobility_stage_g125_cargo_road_attestations(
   delivery_id,sender_id,evidence_id,vehicle_kind,rule_id,
   zone_tag,pickup_tag,delivery_tag,distance_meters,duration_seconds,
   tolls_pyg,verified_at,expires_at)
  VALUES(_delivery,_sender,_evidence,d.requested_vehicle_kind,r.id,
   _zone,_pickup,_destination,_meters,_seconds,_tolls,verified_at,expiry);
 END IF;
 RETURN pg_catalog.jsonb_build_object(
  'deliveryId',_delivery,'ownerId',_sender,'evidenceId',_evidence,
  'vehicleKind',_vehicle,'zoneTag',_zone,'distanceMeters',_meters,
  'durationSeconds',_seconds,'tollsPyg',_tolls,
  'routingVerified',true,'liveEnabled',false,'serverPersisted',true);
END $f$;

-- Seal the generic G7 DELIVERY pricing path: no sender/zone/route witness,
-- no quote. AUTO passenger and existing other modes retain their own contracts.
ALTER FUNCTION public.mobility_stage_fare_quote(
 uuid,uuid,public.mobility_stage_fare_mode,public.mobility_stage_fare_subject,
 uuid,text,integer,integer,integer)
 RENAME TO mobility_stage_g125_fare_quote_core;
CREATE FUNCTION public.mobility_stage_fare_quote(
 _sender uuid,_key uuid,_mode public.mobility_stage_fare_mode,
 _subject public.mobility_stage_fare_subject,_delivery uuid,
 _zone text,_meters integer,_seconds integer,_tolls integer
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE previous public.mobility_stage_fare_quotes%ROWTYPE;
 attested public.mobility_stage_g125_cargo_road_attestations%ROWTYPE;
BEGIN
 IF _subject='DELIVERY' OR _mode='DELIVERY' THEN
  IF _mode IS DISTINCT FROM 'DELIVERY'::public.mobility_stage_fare_mode
  OR _subject IS DISTINCT FROM 'DELIVERY'::public.mobility_stage_fare_subject
  OR _sender IS NULL OR _key IS NULL OR _delivery IS NULL
  THEN RAISE EXCEPTION 'G125 unsupported cargo quote scope'
   USING ERRCODE='P1251'; END IF;
  SELECT * INTO attested
  FROM public.mobility_stage_g125_cargo_road_attestations e
  JOIN public.mobility_stage_deliveries d ON d.id=e.delivery_id
   AND d.sender_id=e.sender_id
   AND d.requested_vehicle_kind=e.vehicle_kind
  JOIN public.mobility_stage_g124_delivery_tariff_policy p
   ON p.vehicle_kind=e.vehicle_kind AND
    e.zone_tag=e.vehicle_kind::text||'_'||p.cargo_zone
  WHERE e.delivery_id=_delivery AND e.sender_id=_sender
   AND d.status='requested' AND d.courier_id IS NULL
   AND e.zone_tag=_zone AND e.distance_meters=_meters
   AND e.duration_seconds=_seconds AND e.tolls_pyg=_tolls
  FOR SHARE OF e,d,p;
  IF NOT FOUND THEN RAISE EXCEPTION 'G125 independent road provenance unavailable'
   USING ERRCODE='P1251'; END IF;
  SELECT * INTO previous FROM public.mobility_stage_fare_quotes
   WHERE request_key=_key;
  IF FOUND THEN
   IF previous.customer_id<>_sender OR previous.subject_kind<>'DELIVERY'
   OR previous.mode<>'DELIVERY' OR previous.subject_id<>_delivery
   OR previous.distance_meters<>_meters OR previous.duration_seconds<>_seconds
   OR previous.tolls_pyg<>_tolls
   THEN RAISE EXCEPTION 'G125 mismatched quote replay'
    USING ERRCODE='P1251'; END IF;
   RETURN previous.id;
  END IF;
  IF attested.expires_at<=pg_catalog.clock_timestamp()
  OR NOT EXISTS(SELECT 1 FROM public.mobility_stage_g124_delivery_tariff_policy p
   JOIN public.mobility_stage_fare_rules r ON r.id=p.current_rule_id
   WHERE p.vehicle_kind=attested.vehicle_kind
   AND attested.zone_tag=attested.vehicle_kind::text||'_'||p.cargo_zone
   AND p.current_rule_id=attested.rule_id
   AND r.active AND r.valid_until>pg_catalog.clock_timestamp())
  THEN RAISE EXCEPTION 'G125 expired route or changed Owner tariff'
   USING ERRCODE='P1251'; END IF;
 END IF;
 RETURN public.mobility_stage_g125_fare_quote_core(_sender,_key,_mode,
  _subject,_delivery,_zone,_meters,_seconds,_tolls);
END $f$;
REVOKE ALL ON FUNCTION public.mobility_stage_g125_record_cargo_road_qa(
 uuid,uuid,uuid,text,text,text,text,integer,integer,integer,bigint,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g125_fare_quote_core(
 uuid,uuid,public.mobility_stage_fare_mode,public.mobility_stage_fare_subject,
 uuid,text,integer,integer,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_fare_quote(
 uuid,uuid,public.mobility_stage_fare_mode,public.mobility_stage_fare_subject,
 uuid,text,integer,integer,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g125_record_cargo_road_qa(
 uuid,uuid,uuid,text,text,text,text,integer,integer,integer,bigint,bigint)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_fare_quote(
 uuid,uuid,public.mobility_stage_fare_mode,public.mobility_stage_fare_subject,
 uuid,text,integer,integer,integer) TO service_role;
COMMIT;
