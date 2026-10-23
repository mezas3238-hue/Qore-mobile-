-- G32 genuine disposable PG concurrency-fenced signal quarantine assertions.
-- No GPS coordinates, no zone observation counts, no production data.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
 current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G32 assertions refuse non-disposable database'; END IF;
END $guard$;
BEGIN;
INSERT INTO auth.users(id) VALUES
 ('b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1'),
 ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2')
ON CONFLICT(id) DO NOTHING;
DELETE FROM public.user_roles WHERE user_id=
 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';
INSERT INTO public.user_roles(user_id,role) VALUES
 ('b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1','driver');
INSERT INTO public.mobility_location_consents(driver_id,opted_in_at)
 VALUES('b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1',
 pg_catalog.clock_timestamp()-interval '2 hours');
INSERT INTO public.mobility_stage_g31_zone_coverage
 (zone_id,municipality,service_kind,coverage_status)
 VALUES('b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3',
 'Asuncion','AUTO_DELIVERY','PLANNED');
DO $priv$
BEGIN
 IF has_function_privilege('anon',
 'public.mobility_stage_g32_quarantine_signal(uuid,uuid,bigint,bigint,uuid,text,bigint,bigint)','EXECUTE')
 OR has_function_privilege('authenticated',
 'public.mobility_stage_g32_quarantine_signal(uuid,uuid,bigint,bigint,uuid,text,bigint,bigint)','EXECUTE')
 OR has_table_privilege('authenticated',
 'public.mobility_stage_g32_signal_quarantine','SELECT')
 OR has_table_privilege('authenticated',
 'public.mobility_stage_g32_signal_quarantine','INSERT')
 OR has_table_privilege('service_role',
 'public.mobility_stage_g31_zone_observations','INSERT')
 OR NOT has_function_privilege('service_role',
 'public.mobility_stage_g32_quarantine_signal(uuid,uuid,bigint,bigint,uuid,text,bigint,bigint)','EXECUTE')
 THEN RAISE EXCEPTION 'G32 telemetry privilege leakage'; END IF;
END $priv$;
SET LOCAL ROLE service_role;
DO $event_checks$
DECLARE
 driver uuid:='b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';
 zone uuid:='b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3';
 ev1 uuid:='b4b4b4b4-b4b4-4b4b-8b4b-b4b4b4b4b4b4';
 ev2 uuid:='b5b5b5b5-b5b5-4b5b-8b5b-b5b5b5b5b5b5';
 stamp bigint:=floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint;
 result uuid; denied boolean;
BEGIN
 result:=public.mobility_stage_g32_quarantine_signal(
  driver,ev1,1,stamp,zone,'AUTO_DELIVERY',1,1);
 IF result<>ev1 THEN RAISE EXCEPTION 'G32 persisted event mismatch'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g32_quarantine_signal(
   driver,ev1,1,stamp,zone,'AUTO_DELIVERY',1,1);
 EXCEPTION WHEN SQLSTATE 'G3201' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G32 repeated event accepted'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g32_quarantine_signal(
   driver,ev2,1,stamp,zone,'AUTO_DELIVERY',1,1);
 EXCEPTION WHEN SQLSTATE 'G3201' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G32 monotonic sequence bypass'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g32_quarantine_signal(
   driver,ev2,2,stamp-90000,zone,'AUTO_DELIVERY',1,1);
 EXCEPTION WHEN SQLSTATE 'G3201' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G32 stale signal accepted'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g32_quarantine_signal(
   driver,ev2,2,stamp,zone,'MOTO_DELIVERY',1,1);
 EXCEPTION WHEN SQLSTATE 'G3201' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G32 cross-service zone spoof'; END IF;
 result:=public.mobility_stage_g32_quarantine_signal(
   driver,ev2,2,stamp,zone,'AUTO_DELIVERY',1,2);
 IF result<>ev2 THEN RAISE EXCEPTION 'G32 valid monotonic event rejected'; END IF;
 IF (SELECT count(*) FROM public.mobility_stage_g32_signal_quarantine
      WHERE driver_id=driver)<>2
 OR (SELECT last_sequence FROM public.mobility_stage_g32_signal_state
      WHERE driver_id=driver)<>2
 THEN RAISE EXCEPTION 'G32 atomic event+sequence state inconsistent'; END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g31_zone_observations
    WHERE zone_id=zone)
 THEN RAISE EXCEPTION 'G32 quarantine illegally created availability'; END IF;
 RAISE NOTICE 'G32 service-only private signal fence, replay and no availability: PASS';
END $event_checks$;
RESET ROLE;
UPDATE public.mobility_location_consents SET revoked_at=pg_catalog.clock_timestamp()
 WHERE driver_id='b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';
SET LOCAL ROLE service_role;
DO $revoke$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g32_quarantine_signal(
   'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1',
   'b6b6b6b6-b6b6-4b6b-8b6b-b6b6b6b6b6b6',3,
   floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint,
   'b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3','AUTO_DELIVERY',1,2);
 EXCEPTION WHEN SQLSTATE 'G3201' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G32 revoked consent still accepted'; END IF;
END $revoke$;
RESET ROLE;
UPDATE public.mobility_location_consents SET revoked_at=NULL
 WHERE driver_id='b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';
INSERT INTO public.user_roles(user_id,role)
 VALUES('b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1','passenger');
SET LOCAL ROLE service_role;
DO $dual$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g32_quarantine_signal(
   'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1',
   'b7b7b7b7-b7b7-4b7b-8b7b-b7b7b7b7b7b7',3,
   floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint,
   'b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3','AUTO_DELIVERY',1,2);
 EXCEPTION WHEN SQLSTATE 'G3201' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G32 mixed Passenger/Driver still accepted'; END IF;
END $dual$;
RESET ROLE;
ROLLBACK;
