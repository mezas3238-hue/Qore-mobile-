-- G199: expand G197 to passenger-MOTO without weakening G118 legal denial.
-- Install ONLY AFTER G118, in disposable PostgreSQL 16.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g118_moto_offers') IS NULL
 OR to_regprocedure('public.mobility_stage_g197_save_pickup_qa(uuid,uuid,bigint,text,integer,bigint)') IS NULL
 THEN RAISE EXCEPTION 'G199 requires G118 and G197 isolated migrations'
  USING ERRCODE='P9901'; END IF;
END $guard$;
BEGIN;
ALTER TABLE public.mobility_stage_g197_pickup_preferences
 DROP CONSTRAINT mobility_stage_g197_pickup_preferences_service_kind_check;
ALTER TABLE public.mobility_stage_g197_pickup_preferences
 ADD CONSTRAINT mobility_stage_g197_pickup_preferences_service_kind_check
 CHECK(service_kind IN('RIDE','MOTO_RIDE','DELIVERY','MERCHANT_ORDER'));
ALTER TABLE public.mobility_stage_g197_verified_pickup_routes
 DROP CONSTRAINT mobility_stage_g197_verified_pickup_routes_service_kind_check;
ALTER TABLE public.mobility_stage_g197_verified_pickup_routes
 ADD CONSTRAINT mobility_stage_g197_verified_pickup_routes_service_kind_check
 CHECK(service_kind IN('RIDE','MOTO_RIDE','DELIVERY','MERCHANT_ORDER'));

CREATE OR REPLACE FUNCTION public.mobility_stage_g197_save_pickup_qa(
 _driver uuid,_session uuid,_iat_ms bigint,_kind text,
 _distance_meters integer,_expected_revision bigint
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE old public.mobility_stage_g197_pickup_preferences%ROWTYPE;
 next_revision bigint;
BEGIN
 IF _driver IS NULL OR _session IS NULL OR _iat_ms IS NULL
 OR _kind NOT IN ('RIDE','MOTO_RIDE','DELIVERY','MERCHANT_ORDER')
 OR _distance_meters IS NULL OR _distance_meters NOT IN
   (0,1000,2000,3000,5000,8000,10000,15000,20000,30000,50000)
 OR _expected_revision IS NULL OR _expected_revision<0
 THEN RAISE EXCEPTION 'G197 invalid preference input' USING ERRCODE='P9701'; END IF;
 IF NOT public.mobility_stage_g42_lock_session(_driver,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G197 revoked Driver session' USING ERRCODE='P9702'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_driver)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_driver
 AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'G197 exclusive Driver identity required'
 USING ERRCODE='P9703'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('g197/'||_driver::text||'/'||_kind,0));
 SELECT * INTO old FROM public.mobility_stage_g197_pickup_preferences
 WHERE driver_id=_driver AND service_kind=_kind FOR UPDATE;
 IF NOT FOUND THEN
  IF _expected_revision<>0 THEN RAISE EXCEPTION 'G197 stale initial revision'
   USING ERRCODE='P9704'; END IF;
  INSERT INTO public.mobility_stage_g197_pickup_preferences(
   driver_id,service_kind,maximum_road_meters)
  VALUES(_driver,_kind,_distance_meters);
  next_revision:=1;
 ELSE
  IF old.revision<>_expected_revision
  THEN RAISE EXCEPTION 'G197 revision conflict' USING ERRCODE='P9704'; END IF;
  UPDATE public.mobility_stage_g197_pickup_preferences
  SET maximum_road_meters=_distance_meters,revision=revision+1,
   updated_at=pg_catalog.clock_timestamp()
  WHERE driver_id=_driver AND service_kind=_kind
  RETURNING revision INTO next_revision;
 END IF;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','driverId',_driver,'serviceKind',_kind,
  'maximumRoadMeters',_distance_meters,'revision',next_revision,
  'serverPersisted',true,'liveEnabled',false,'productionEnabled',false);
END $f$;

CREATE OR REPLACE FUNCTION public.mobility_stage_g197_check_pickup_qa(
 _kind text,_service uuid,_driver uuid
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path='' AS $f$
DECLARE max_road integer; verified record;
BEGIN
 IF _kind NOT IN('RIDE','MOTO_RIDE','DELIVERY','MERCHANT_ORDER')
 OR _service IS NULL OR _driver IS NULL
 THEN RAISE EXCEPTION 'G197 missing dispatch scope' USING ERRCODE='P9701'; END IF;
 SELECT maximum_road_meters INTO max_road
 FROM public.mobility_stage_g197_pickup_preferences
 WHERE driver_id=_driver AND service_kind=_kind FOR SHARE;
 -- No verified preference means no claim of distance filtering. Existing
 -- G82/G10 QA candidate discovery remains documentary-only until enrolled.
 IF max_road IS NULL THEN RETURN true; END IF;
 -- Explicit OFF for passenger-MOTO always denies an offer, regardless of
 -- a zero-meter routing claim. This cannot authorize municipal transport.
 IF max_road=0 THEN RETURN false; END IF;
 SELECT distance_meters,verified_at,expires_at,source INTO verified
 FROM public.mobility_stage_g197_verified_pickup_routes
 WHERE service_kind=_kind AND service_id=_service AND driver_id=_driver FOR SHARE;
 IF NOT FOUND OR verified.source<>'INDEPENDENT_SERVER_ROAD_ROUTING'
 OR verified.distance_meters>max_road
 OR verified.verified_at>pg_catalog.clock_timestamp()+interval '5 seconds'
 OR verified.verified_at<pg_catalog.clock_timestamp()-interval '90 seconds'
 OR verified.expires_at<=pg_catalog.clock_timestamp()
 THEN RETURN false; END IF;
 RETURN true;
END $f$;

CREATE FUNCTION public.mobility_stage_g199_moto_pickup_fence_qa()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path='' AS $f$
BEGIN
 -- G118 still owns the legal gate; this only ADDS an independent road
 -- restriction. It never approves a Driver, legal zone, or commercial trip.
 IF (TG_OP='INSERT' OR NEW.status='accepted') AND
 NOT public.mobility_stage_g197_check_pickup_qa(
  'MOTO_RIDE',NEW.trip_id,NEW.driver_id)
 THEN RAISE EXCEPTION 'G199 MOTO pickup road range denied'
 USING ERRCODE='P9905'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER mobility_g199_moto_pickup_guard
 BEFORE INSERT OR UPDATE OF status ON public.mobility_stage_g118_moto_offers
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g199_moto_pickup_fence_qa();
REVOKE ALL ON FUNCTION public.mobility_stage_g199_moto_pickup_fence_qa()
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
