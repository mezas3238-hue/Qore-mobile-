-- G155 participant reputation. Disposable PG16 CI only, not a production migration.
-- No public comments, social scoring, automatic deactivation or dispatch bypass.
DO $gate$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_auto_demo_trips') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_g100_moto_trips') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_deliveries') IS NULL
 OR pg_catalog.to_regclass('public.mobility_stage_merchant_orders') IS NULL
 THEN RAISE EXCEPTION 'G155 requires isolated PG16 and original services'; END IF;
END $gate$;
BEGIN;
CREATE TABLE public.mobility_stage_g155_verified_ratings (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 service_kind text NOT NULL CHECK(service_kind IN
  ('AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE')),
 service_id uuid NOT NULL,
 reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 rated_kind text NOT NULL CHECK(rated_kind IN
  ('DRIVER','COURIER','MERCHANT','CLIENT')),
 rated_id uuid NOT NULL,
 stars integer NOT NULL CHECK(stars BETWEEN 1 AND 5),
 -- Only private, coded incident triage; never displayed as a public accusation.
 incident_code text CHECK(incident_code IN
  ('SUSPECTED_FRAUD','SAFETY','NO_SHOW','INCORRECT_ITEM','OTHER')),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 UNIQUE(service_kind,service_id,rated_kind),
 CHECK(reviewer_id<>rated_id)
);
ALTER TABLE public.mobility_stage_g155_verified_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g155_verified_ratings
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mobility_stage_g155_submit_rating_qa(
 _reviewer uuid,_session uuid,_iat_ms bigint,_request_key uuid,
 _service_kind text,_service_id uuid,_rated_kind text,_stars integer,
 _incident_code text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path='' AS $body$
DECLARE row0 public.mobility_stage_g155_verified_ratings%ROWTYPE;
 target uuid; required_role text; role_ok boolean:=false;
 o public.mobility_stage_merchant_orders%ROWTYPE;
 d public.mobility_stage_deliveries%ROWTYPE;
 source_is_completed boolean:=false;
BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR _reviewer IS NULL OR _session IS NULL OR _iat_ms IS NULL
 OR _request_key IS NULL OR _service_id IS NULL
 OR _service_kind NOT IN ('AUTO_RIDE','MOTO_RIDE','DELIVERY_AUTO','DELIVERY_MOTO','COMMERCE')
 OR _rated_kind NOT IN ('DRIVER','COURIER','MERCHANT','CLIENT')
 OR _stars NOT BETWEEN 1 AND 5
 OR (_incident_code IS NOT NULL AND _incident_code NOT IN
   ('SUSPECTED_FRAUD','SAFETY','NO_SHOW','INCORRECT_ITEM','OTHER'))
 OR NOT public.mobility_stage_g42_lock_session(_reviewer,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G155 verified identity or rating input denied'
 USING ERRCODE='P1551'; END IF;
 -- Exclusive reviewer role. Merchant staff is checked against the exact order.
 SELECT count(*)=1 INTO role_ok FROM public.user_roles WHERE user_id=_reviewer;
 IF NOT role_ok THEN RAISE EXCEPTION 'G155 reviewer role not exclusive'
  USING ERRCODE='P1551'; END IF;
 IF _service_kind='AUTO_RIDE' THEN
  SELECT passenger_id,driver_id,status='completed' AND driver_id IS NOT NULL
   INTO o.buyer_id,target,source_is_completed
   FROM public.mobility_stage_auto_demo_trips WHERE id=_service_id FOR UPDATE;
  -- Use the source's actual participant IDs; no caller-supplied rated user.
  IF source_is_completed IS TRUE THEN
   IF _rated_kind='DRIVER' AND _reviewer=o.buyer_id THEN
    required_role:='passenger';
   ELSIF _rated_kind='CLIENT' AND _reviewer=target THEN
    target:=o.buyer_id;required_role:='driver';
   ELSE target:=NULL; END IF;
  END IF;
 ELSIF _service_kind='MOTO_RIDE' THEN
  SELECT passenger_id,driver_id,
    status='completed' AND driver_id IS NOT NULL AND completed_at IS NOT NULL
   INTO o.buyer_id,target,source_is_completed
   FROM public.mobility_stage_g100_moto_trips WHERE id=_service_id FOR UPDATE;
  IF source_is_completed IS TRUE THEN
   IF _rated_kind='DRIVER' AND _reviewer=o.buyer_id THEN
    required_role:='passenger';
   ELSIF _rated_kind='CLIENT' AND _reviewer=target THEN
    target:=o.buyer_id;required_role:='driver';
   ELSE target:=NULL; END IF;
  END IF;
 ELSIF _service_kind IN ('DELIVERY_AUTO','DELIVERY_MOTO') THEN
  SELECT * INTO d FROM public.mobility_stage_deliveries
   WHERE id=_service_id FOR UPDATE;
  IF FOUND AND d.status='delivered' AND d.proof_ref IS NOT NULL
   AND d.courier_id IS NOT NULL
   AND ((_service_kind='DELIVERY_AUTO'
      AND d.requested_vehicle_kind='AUTO'::public.mobility_vehicle_kind)
     OR (_service_kind='DELIVERY_MOTO'
      AND d.requested_vehicle_kind='MOTO'::public.mobility_vehicle_kind))
   AND NOT EXISTS(SELECT 1 FROM public.mobility_stage_merchant_orders m
    WHERE m.delivery_id=d.id)
  THEN
   source_is_completed:=true;
   IF _rated_kind='COURIER' AND _reviewer=d.sender_id THEN
    target:=d.courier_id;required_role:='passenger';
   ELSIF _rated_kind='CLIENT' AND _reviewer=d.courier_id THEN
    target:=d.sender_id;required_role:='driver';
   END IF;
  END IF;
 ELSE
  SELECT * INTO o FROM public.mobility_stage_merchant_orders
   WHERE id=_service_id FOR UPDATE;
  IF FOUND AND o.status='delivered' AND o.delivery_id IS NOT NULL THEN
   SELECT * INTO d FROM public.mobility_stage_deliveries WHERE id=o.delivery_id;
   IF FOUND AND d.status='delivered' AND d.proof_ref IS NOT NULL
    AND d.sender_id=o.buyer_id AND d.courier_id IS NOT NULL THEN
    source_is_completed:=true;
    IF _reviewer=o.buyer_id AND _rated_kind='MERCHANT' THEN
     target:=o.merchant_id;required_role:='passenger';
    ELSIF _reviewer=o.buyer_id AND _rated_kind='COURIER' THEN
     target:=d.courier_id;required_role:='passenger';
    ELSIF _rated_kind='CLIENT' AND EXISTS(
     SELECT 1 FROM public.mobility_stage_merchant_staff s
     WHERE s.merchant_id=o.merchant_id AND s.user_id=_reviewer
      AND s.active=true)
    THEN target:=o.buyer_id;required_role:='merchant_staff';
    END IF;
   END IF;
  END IF;
 END IF;
 IF source_is_completed IS DISTINCT FROM true OR target IS NULL
  OR target=_reviewer OR required_role IS NULL
  OR (required_role<>'merchant_staff' AND NOT EXISTS(
   SELECT 1 FROM public.user_roles
   WHERE user_id=_reviewer AND role=required_role::public.app_role))
 THEN RAISE EXCEPTION 'G155 no verified completed service or participant'
  USING ERRCODE='P1552'; END IF;
 -- Per-service target-key serialization prevents review stuffing and races.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  _service_kind||':'||_service_id::text||':'||_rated_kind,155));
 SELECT * INTO row0 FROM public.mobility_stage_g155_verified_ratings
  WHERE request_key=_request_key OR
   (service_kind=_service_kind AND service_id=_service_id
    AND rated_kind=_rated_kind)
  FOR UPDATE;
 IF FOUND THEN
  IF row0.request_key<>_request_key OR row0.service_kind<>_service_kind
   OR row0.service_id<>_service_id OR row0.reviewer_id<>_reviewer
   OR row0.rated_kind<>_rated_kind OR row0.rated_id<>target
   OR row0.stars<>_stars OR row0.incident_code IS DISTINCT FROM _incident_code
  THEN RAISE EXCEPTION 'G155 immutable rating or key conflict'
   USING ERRCODE='P1553'; END IF;
 ELSE
  INSERT INTO public.mobility_stage_g155_verified_ratings
   (request_key,service_kind,service_id,reviewer_id,rated_kind,
    rated_id,stars,incident_code)
  VALUES(_request_key,_service_kind,_service_id,_reviewer,_rated_kind,
   target,_stars,_incident_code)
  RETURNING * INTO row0;
 END IF;
 RETURN pg_catalog.jsonb_build_object(
  'ratingId',row0.id,'serviceId',row0.service_id,
  'serviceKind',row0.service_kind,'ratedKind',row0.rated_kind,
  'stars',row0.stars,'requestKey',row0.request_key,
  'serverPersisted',true,'qaOnly',true,'productionEnabled',false,
  'dispatchPriorityChanged',false,'automatedSuspension',false);
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g155_submit_rating_qa(
 uuid,uuid,bigint,uuid,text,uuid,text,integer,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g155_submit_rating_qa(
 uuid,uuid,bigint,uuid,text,uuid,text,integer,text) TO service_role;

-- Aggregate only; never publish reviewer IDs, incident codes or per-job data.
-- Shrink toward 3.5 with ten prior observations; dispatch ranking remains OFF
-- until the Owner authorizes independent fairness/anti-fraud qualification.
CREATE FUNCTION public.mobility_stage_g155_reputation_qa(
 _rated_kind text,_rated_id uuid
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$
 SELECT pg_catalog.jsonb_build_object(
  'ratedKind',_rated_kind,'ratedId',_rated_id,
  'verifiedCount',count(*)::integer,
  'averageStars',CASE WHEN count(*)>=5
   THEN round(avg(stars)::numeric,2) ELSE NULL END,
  'bayesianScore',CASE WHEN count(*)>=5
   THEN round((sum(stars)::numeric+35.0)/(count(*)+10),3) ELSE NULL END,
  'reputationQualified',count(*)>=5,
  'dispatchPriorityApproved',false,'automatedSuspension',false,
  'qaOnly',true,'productionEnabled',false)
 FROM public.mobility_stage_g155_verified_ratings
 WHERE rated_kind=_rated_kind AND rated_id=_rated_id
  AND _rated_kind IN ('DRIVER','COURIER','MERCHANT','CLIENT')
  AND _rated_id IS NOT NULL
  AND pg_catalog.current_database()='qore_disposable_chain'
  AND pg_catalog.current_setting('application_name')='qore_ci_disposable_chain'
$body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g155_reputation_qa(text,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g155_reputation_qa(text,uuid)
 TO service_role;
COMMIT;
