-- G263 — real STAGING PG17 Driver pickup preferences, ONLY preference persistence.
-- This is NOT a road-distance dispatch filter or verified GPS / road proof.
-- Never apply any CI_ONLY G197 fixture to Supabase. No LIVE/PSP.
-- Driver-controlled service kinds: RIDE, MOTO_RIDE, DELIVERY, MERCHANT_ORDER.
BEGIN;
DO $preflight$
BEGIN
 IF current_setting('server_version_num')::integer < 170000
 OR to_regclass('public.user_roles') IS NULL
 OR to_regclass('auth.sessions') IS NULL
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR to_regnamespace('qore_private') IS NULL
 OR to_regclass('public.mobility_stage_g263_pickup_preferences') IS NOT NULL
 OR (SELECT count(*) FROM auth.users) <> 0
 THEN RAISE EXCEPTION 'G263 requires isolated empty PG17 STAGING with G42'; END IF;
END $preflight$;

CREATE TABLE public.mobility_stage_g263_pickup_preferences(
 driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 service_kind text NOT NULL CHECK(service_kind IN
  ('RIDE','MOTO_RIDE','DELIVERY','MERCHANT_ORDER')),
 maximum_road_meters integer NOT NULL CHECK(maximum_road_meters IN
  (0,1000,2000,3000,5000,8000,10000,15000,20000,30000,50000)),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 PRIMARY KEY(driver_id,service_kind)
);
ALTER TABLE public.mobility_stage_g263_pickup_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g263_pickup_preferences FROM
 PUBLIC,anon,authenticated,service_role;

-- Private implementation executes as owner, while a service-only public
-- wrapper remains SECURITY INVOKER and never supplies an elevated public API.
CREATE FUNCTION qore_private.g263_read_driver_pickup(
 _driver uuid,_session uuid,_iat_ms bigint
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path='' SET lock_timeout='500ms' AS $f$
DECLARE rows jsonb;
BEGIN
 IF _driver IS NULL OR _session IS NULL OR _iat_ms IS NULL
 OR NOT public.mobility_stage_g42_lock_session(_driver,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G263 provider Driver session denied' USING ERRCODE='P6301'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_driver)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
   WHERE user_id=_driver AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'G263 exclusive Driver role required' USING ERRCODE='P6302'; END IF;
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'serviceKind',p.service_kind,'maximumRoadMeters',p.maximum_road_meters,
  'revision',p.revision) ORDER BY p.service_kind),'[]'::jsonb)
 INTO rows FROM public.mobility_stage_g263_pickup_preferences p
 WHERE p.driver_id=_driver;
 RETURN pg_catalog.jsonb_build_object(
  'mode','STAGING_DEMO_ONLY','driverId',_driver,
  'preferences',rows,'productionEnabled',false,'liveEnabled',false);
END $f$;

CREATE FUNCTION qore_private.g263_save_driver_pickup(
 _driver uuid,_session uuid,_iat_ms bigint,_kind text,
 _distance_meters integer,_expected_revision bigint
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path='' SET lock_timeout='500ms' AS $f$
DECLARE old public.mobility_stage_g263_pickup_preferences%ROWTYPE;
 next_revision bigint;
BEGIN
 IF _driver IS NULL OR _session IS NULL OR _iat_ms IS NULL
 OR _kind IS NULL OR _kind NOT IN
   ('RIDE','MOTO_RIDE','DELIVERY','MERCHANT_ORDER')
 OR _distance_meters IS NULL OR _distance_meters NOT IN
   (0,1000,2000,3000,5000,8000,10000,15000,20000,30000,50000)
 OR _expected_revision IS NULL OR _expected_revision<0
 THEN RAISE EXCEPTION 'G263 invalid preference' USING ERRCODE='P6303'; END IF;
 -- G42 holds provider auth.sessions row through SAME SQL COMMIT.
 IF NOT public.mobility_stage_g42_lock_session(_driver,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G263 provider session revoked' USING ERRCODE='P6301'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_driver)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id=_driver AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'G263 exclusive Driver role required' USING ERRCODE='P6302'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('g263/'||_driver::text||'/'||_kind,0));
 SELECT * INTO old FROM public.mobility_stage_g263_pickup_preferences
 WHERE driver_id=_driver AND service_kind=_kind FOR UPDATE;
 IF NOT FOUND THEN
  IF _expected_revision<>0 THEN
   RAISE EXCEPTION 'G263 initial revision conflict' USING ERRCODE='P6304';
  END IF;
  INSERT INTO public.mobility_stage_g263_pickup_preferences(
   driver_id,service_kind,maximum_road_meters)
  VALUES(_driver,_kind,_distance_meters);
  next_revision:=1;
 ELSE
  IF old.revision<>_expected_revision THEN
   RAISE EXCEPTION 'G263 stale preference revision' USING ERRCODE='P6304';
  END IF;
  UPDATE public.mobility_stage_g263_pickup_preferences
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

REVOKE ALL ON FUNCTION
 qore_private.g263_read_driver_pickup(uuid,uuid,bigint),
 qore_private.g263_save_driver_pickup(uuid,uuid,bigint,text,integer,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION
 qore_private.g263_read_driver_pickup(uuid,uuid,bigint),
 qore_private.g263_save_driver_pickup(uuid,uuid,bigint,text,integer,bigint)
 TO service_role;

CREATE FUNCTION public.mobility_stage_g197_read_pickup_qa(
 _driver uuid,_session uuid,_iat_ms bigint
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $f$ SELECT qore_private.g263_read_driver_pickup($1,$2,$3); $f$;

CREATE FUNCTION public.mobility_stage_g197_save_pickup_qa(
 _driver uuid,_session uuid,_iat_ms bigint,_kind text,
 _distance_meters integer,_expected_revision bigint
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $f$ SELECT qore_private.g263_save_driver_pickup($1,$2,$3,$4,$5,$6); $f$;

REVOKE ALL ON FUNCTION
 public.mobility_stage_g197_read_pickup_qa(uuid,uuid,bigint),
 public.mobility_stage_g197_save_pickup_qa(uuid,uuid,bigint,text,integer,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION
 public.mobility_stage_g197_read_pickup_qa(uuid,uuid,bigint),
 public.mobility_stage_g197_save_pickup_qa(uuid,uuid,bigint,text,integer,bigint)
 TO service_role;
COMMIT;
