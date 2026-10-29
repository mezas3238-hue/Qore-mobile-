-- G197: Driver-controlled MAX ROAD pickup distance, never a GPS circle.
-- CI disposable PG16 ONLY. Not a hosted migration; no live Geoapify authority.
-- G4 AUTO offers and G10 AUTO/MOTO courier offers are fenced AT INSERT.
DO $guard$ BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR to_regclass('public.mobility_stage_auto_demo_offers') IS NULL
 OR to_regclass('public.mobility_stage_delivery_offers') IS NULL
 THEN RAISE EXCEPTION 'G197 requires original G4/G10 and G42 disposable chain'
 USING ERRCODE='P9701'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g197_pickup_preferences(
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 service_kind text NOT NULL CHECK(service_kind IN ('RIDE','DELIVERY','MERCHANT_ORDER')),
 maximum_road_meters integer NOT NULL
  CHECK(maximum_road_meters IN (1000,2000,3000,5000,8000,10000,15000,20000,30000,50000)),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 PRIMARY KEY(driver_id,service_kind)
);
CREATE TABLE public.mobility_stage_g197_verified_pickup_routes(
 service_kind text NOT NULL CHECK(service_kind IN ('RIDE','DELIVERY','MERCHANT_ORDER')),
 service_id uuid NOT NULL,
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 distance_meters integer NOT NULL CHECK(distance_meters BETWEEN 0 AND 500000),
 road_evidence_id uuid NOT NULL,
 verified_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 source text NOT NULL CHECK(source='INDEPENDENT_SERVER_ROAD_ROUTING'),
 PRIMARY KEY(service_kind,service_id,driver_id),
 UNIQUE(road_evidence_id),
 CHECK(expires_at>verified_at AND expires_at<=verified_at+interval '2 minutes')
);
ALTER TABLE public.mobility_stage_g197_pickup_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g197_verified_pickup_routes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g197_pickup_preferences,
 public.mobility_stage_g197_verified_pickup_routes
 FROM PUBLIC,anon,authenticated,service_role;
-- Preferences have NO app-direct INSERT/UPDATE; use session-locked RPC only.
-- Route evidence is not mobile input; it must arrive from a distinct server
-- road routing authority and is only installed by the isolated SQL owner.
CREATE FUNCTION public.mobility_stage_g197_save_pickup_qa(
 _driver uuid,_session uuid,_iat_ms bigint,_kind text,
 _distance_meters integer,_expected_revision bigint
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE old public.mobility_stage_g197_pickup_preferences%ROWTYPE;
 next_revision bigint;
BEGIN
 IF _driver IS NULL OR _session IS NULL OR _iat_ms IS NULL
 OR _kind NOT IN ('RIDE','DELIVERY','MERCHANT_ORDER')
 OR _distance_meters IS NULL OR _distance_meters NOT IN
   (1000,2000,3000,5000,8000,10000,15000,20000,30000,50000)
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
CREATE FUNCTION public.mobility_stage_g197_read_pickup_qa(
 _driver uuid,_session uuid,_iat_ms bigint
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE prefs jsonb;
BEGIN
 IF _driver IS NULL OR _session IS NULL OR _iat_ms IS NULL
 OR NOT public.mobility_stage_g42_lock_session(_driver,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G197 Driver session denied' USING ERRCODE='P9702'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_driver)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_driver
 AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'G197 Driver role denied' USING ERRCODE='P9703'; END IF;
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'serviceKind',service_kind,'maximumRoadMeters',maximum_road_meters,
  'revision',revision) ORDER BY service_kind),'[]'::jsonb)
 INTO prefs FROM public.mobility_stage_g197_pickup_preferences WHERE driver_id=_driver;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','driverId',_driver,'preferences',prefs,
  'productionEnabled',false,'liveEnabled',false);
END $f$;
CREATE FUNCTION public.mobility_stage_g197_check_pickup_qa(
 _kind text,_service uuid,_driver uuid
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path='' AS $f$
DECLARE max_road integer; verified record;
BEGIN
 IF _kind NOT IN('RIDE','DELIVERY','MERCHANT_ORDER')
 OR _service IS NULL OR _driver IS NULL
 THEN RAISE EXCEPTION 'G197 missing dispatch scope' USING ERRCODE='P9701'; END IF;
 SELECT maximum_road_meters INTO max_road
 FROM public.mobility_stage_g197_pickup_preferences
 WHERE driver_id=_driver AND service_kind=_kind FOR SHARE;
 -- No verified preference means no claim of distance filtering. Existing
 -- G82/G10 QA candidate discovery remains documentary-only until enrolled.
 IF max_road IS NULL THEN RETURN true; END IF;
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
CREATE FUNCTION public.mobility_stage_g197_auto_offer_fence_qa()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 IF (TG_OP='INSERT' OR NEW.status='accepted') AND
 NOT public.mobility_stage_g197_check_pickup_qa('RIDE',NEW.trip_id,NEW.driver_id)
 THEN RAISE EXCEPTION 'G197 road pickup radius exceeded or unverified'
 USING ERRCODE='P9705'; END IF;
 RETURN NEW;
END $f$;
CREATE FUNCTION public.mobility_stage_g197_courier_offer_fence_qa()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $f$
DECLARE k text;
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM public.mobility_stage_merchant_orders
  WHERE delivery_id=NEW.delivery_id) THEN 'MERCHANT_ORDER'
  ELSE 'DELIVERY' END INTO k;
 IF (TG_OP='INSERT' OR NEW.status='accepted') AND
 NOT public.mobility_stage_g197_check_pickup_qa(k,NEW.delivery_id,NEW.courier_id)
 THEN RAISE EXCEPTION 'G197 road pickup radius exceeded or unverified'
 USING ERRCODE='P9705'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER mobility_g197_auto_offer_guard
 BEFORE INSERT OR UPDATE OF status ON public.mobility_stage_auto_demo_offers
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g197_auto_offer_fence_qa();
CREATE TRIGGER mobility_g197_courier_offer_guard
 BEFORE INSERT OR UPDATE OF status ON public.mobility_stage_delivery_offers
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g197_courier_offer_fence_qa();
REVOKE ALL ON FUNCTION
 public.mobility_stage_g197_save_pickup_qa(uuid,uuid,bigint,text,integer,bigint),
 public.mobility_stage_g197_read_pickup_qa(uuid,uuid,bigint),
 public.mobility_stage_g197_check_pickup_qa(text,uuid,uuid),
 public.mobility_stage_g197_auto_offer_fence_qa(),
 public.mobility_stage_g197_courier_offer_fence_qa()
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION
 public.mobility_stage_g197_save_pickup_qa(uuid,uuid,bigint,text,integer,bigint),
 public.mobility_stage_g197_read_pickup_qa(uuid,uuid,bigint)
 TO service_role;
COMMIT;
