-- G33: real PostgreSQL diagnostic read, never publish G31 counts.
-- All 7 Drivers, 2 zones and assignments are disposable fixtures (ROLLBACK).
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
 current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G33 assertions refuse non-disposable PostgreSQL'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
INSERT INTO auth.users(id)
SELECT md5('G33_USER_'||n)::uuid FROM generate_series(1,9) n;
-- U1-U7 have only the Driver role; U8 is the Admin and U9 a passenger.
DELETE FROM public.user_roles WHERE user_id IN (
 SELECT md5('G33_USER_'||n)::uuid FROM generate_series(1,8) n);
INSERT INTO public.user_roles(user_id,role)
SELECT md5('G33_USER_'||n)::uuid,'driver'::public.app_role
 FROM generate_series(1,7) n;
INSERT INTO public.mobility_stage_backoffice_roles(
 user_id,role,status,approved_by)
VALUES(md5('G33_USER_8')::uuid,'admin','active',
 md5('G33_USER_9')::uuid);
INSERT INTO public.mobility_location_consents(driver_id,opted_in_at,revoked_at)
SELECT md5('G33_USER_'||n)::uuid,
 clock_timestamp()-interval '1 hour',
 CASE WHEN n=3 THEN clock_timestamp()-interval '1 minute'
 ELSE NULL END
FROM generate_series(1,7) n;
INSERT INTO public.driver_locations(driver_id,available,lat,lng,updated_at)
SELECT md5('G33_USER_'||n)::uuid,
 n<>4, -25.3,-57.6,
 clock_timestamp()-interval '1 second'
FROM generate_series(1,7) n;
INSERT INTO public.mobility_stage_g31_zone_coverage(
 zone_id,municipality,service_kind,coverage_status)
VALUES
(md5('G33_ZONE_ONE')::uuid,'Asuncion','AUTO_DELIVERY','PLANNED'),
(md5('G33_ZONE_TWO')::uuid,'Asuncion','AUTO_DELIVERY','PLANNED');

-- Two fake approved vehicles enable direct fixture rows for BUSY trips.
INSERT INTO public.mobility_vehicles(
 id,driver_id,vehicle_kind,service_kind,country_code,municipality_code,
 plate_normalized,brand,model,manufacture_year,passenger_capacity)
VALUES
(md5('G33_VEHICLE_2')::uuid,md5('G33_USER_2')::uuid,'AUTO',
 'economico','PY','ASUNCION','G33CAR0002','QA','CAR',2021,4),
(md5('G33_VEHICLE_7')::uuid,md5('G33_USER_7')::uuid,'AUTO',
 'economico','PY','ASUNCION','G33CAR0007','QA','CAR',2021,4);
-- Driver #2 is BUSY in an accepted passenger ride, so not idle.
INSERT INTO public.mobility_stage_auto_demo_trips(
 id,request_key,passenger_id,driver_id,vehicle_id,service,
 origin_tag,destination_tag,status)
VALUES(md5('G33_TRIP')::uuid,md5('G33_TRIP_REQ')::uuid,
 md5('G33_USER_9')::uuid,md5('G33_USER_2')::uuid,
 md5('G33_VEHICLE_2')::uuid,'economico',
 'QA_ORIGIN','QA_DESTINATION','accepted');
-- Driver #7 is BUSY in an accepted delivery, so not idle.
INSERT INTO public.mobility_stage_deliveries(
 id,request_key,sender_id,courier_id,vehicle_id,requested_vehicle_kind,
 category,grams,length_cm,width_cm,height_cm,
 pickup_tag,delivery_tag,status)
VALUES(md5('G33_DELIVERY')::uuid,md5('G33_DELIVERY_REQ')::uuid,
 md5('G33_USER_9')::uuid,md5('G33_USER_7')::uuid,
 md5('G33_VEHICLE_7')::uuid,'AUTO','PARCEL',100,10,10,10,
 'QA_PICKUP','QA_DROP','accepted');

-- D1,D2,D3,D4,D7 are FRESH in Zone One. D5 is stale by >30s.
-- D6 has an old event in Zone One and a NEWER event in Zone Two;
-- global latest-state join must exclude the moved Driver from Zone One.
INSERT INTO public.mobility_stage_g32_signal_quarantine(
 event_id,driver_id,sequence,captured_at,zone_id,service_kind,
 consent_revision,geometry_revision)
SELECT md5('G33_EVENT_'||n)::uuid,
 md5('G33_USER_'||n)::uuid,1,
 clock_timestamp()-CASE WHEN n=5 THEN interval '2 minutes'
 ELSE interval '2 seconds' END,
 md5('G33_ZONE_ONE')::uuid,'AUTO_DELIVERY',1,1
FROM generate_series(1,7) n;
INSERT INTO public.mobility_stage_g32_signal_quarantine(
 event_id,driver_id,sequence,captured_at,zone_id,service_kind,
 consent_revision,geometry_revision)
VALUES(md5('G33_MOVED_EVENT')::uuid,md5('G33_USER_6')::uuid,2,
 clock_timestamp()-interval '1 second',
 md5('G33_ZONE_TWO')::uuid,'AUTO_DELIVERY',1,1);
INSERT INTO public.mobility_stage_g32_signal_state(
 driver_id,last_sequence,last_captured_at,last_event_id)
SELECT md5('G33_USER_'||n)::uuid,
 CASE WHEN n=6 THEN 2 ELSE 1 END,
 (SELECT q.captured_at FROM public.mobility_stage_g32_signal_quarantine q
  WHERE q.event_id=CASE WHEN n=6 THEN md5('G33_MOVED_EVENT')::uuid
   ELSE md5('G33_EVENT_'||n)::uuid END),
 CASE WHEN n=6 THEN md5('G33_MOVED_EVENT')::uuid
 ELSE md5('G33_EVENT_'||n)::uuid END
FROM generate_series(1,7) n;

DO $grants$
BEGIN
 IF has_function_privilege('authenticated',
 'public.mobility_stage_g33_quarantined_zone_diagnostic(uuid,uuid,text,bigint)','EXECUTE')
 OR has_function_privilege('anon',
 'public.mobility_stage_g33_quarantined_zone_diagnostic(uuid,uuid,text,bigint)','EXECUTE')
 OR NOT has_function_privilege('service_role',
 'public.mobility_stage_g33_quarantined_zone_diagnostic(uuid,uuid,text,bigint)','EXECUTE')
 THEN RAISE EXCEPTION 'G33 diagnostic permission leaked'; END IF;
END $grants$;
SET LOCAL ROLE service_role;
DO $reading$
DECLARE
 anchor_ms bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 doc jsonb;other jsonb;
BEGIN
 doc:=public.mobility_stage_g33_quarantined_zone_diagnostic(
  md5('G33_USER_8')::uuid,md5('G33_ZONE_ONE')::uuid,
  'AUTO_DELIVERY',anchor_ms);
 IF doc->>'source'<>'QA_G32_QUARANTINE_ONLY'
 OR (doc->>'quarantinedRecentSignals')::int<>5
 OR (doc->>'consentingIdleCandidates')::int<>1
 OR doc->>'productionEnabled'<>'false'
 OR doc->>'publishedToG31'<>'false'
 OR doc->>'dispatchAuthorized'<>'false'
 OR doc->>'availabilityConfirmed'<>'false'
 OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(doc))<>10
 THEN RAISE EXCEPTION 'G33 unsafe or incorrect diagnosis %',doc; END IF;
 other:=public.mobility_stage_g33_quarantined_zone_diagnostic(
  md5('G33_USER_8')::uuid,md5('G33_ZONE_TWO')::uuid,
  'AUTO_DELIVERY',anchor_ms);
 IF (other->>'quarantinedRecentSignals')::int<>1
 OR (other->>'consentingIdleCandidates')::int<>1
 THEN RAISE EXCEPTION 'G33 moved Driver not attributed exclusively to newest zone %',other; END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g31_zone_observations
  WHERE zone_id IN(md5('G33_ZONE_ONE')::uuid,md5('G33_ZONE_TWO')::uuid))
 THEN RAISE EXCEPTION 'G33 diagnostic mutated G31 public availability'; END IF;
 RAISE NOTICE 'G33 source-backed diagnostic: 5 recent quarantined, 1 consenting idle; moved cross-zone 1; no published availability';
END $reading$;
DO $attacks$
DECLARE
 denied boolean:=false;
 now_ms bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g33_quarantined_zone_diagnostic(
   md5('G33_USER_9')::uuid,md5('G33_ZONE_ONE')::uuid,'AUTO_DELIVERY',now_ms);
 EXCEPTION WHEN SQLSTATE 'G3301' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G33 native passenger gained Admin read'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g33_quarantined_zone_diagnostic(
   md5('G33_USER_8')::uuid,md5('G33_ZONE_ONE')::uuid,'MOTO_PASAJERO',now_ms);
 EXCEPTION WHEN SQLSTATE 'G3301' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G33 illegal moto passenger service counted'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g33_quarantined_zone_diagnostic(
   md5('G33_USER_8')::uuid,md5('G33_ZONE_ONE')::uuid,'AUTO_DELIVERY',now_ms-65000);
 EXCEPTION WHEN SQLSTATE 'G3301' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G33 stale query anchor accepted'; END IF;
END $attacks$;
RESET ROLE;
-- Withdrawal after accepted location must immediately eliminate candidate.
UPDATE public.mobility_location_consents SET revoked_at=clock_timestamp()
 WHERE driver_id=md5('G33_USER_1')::uuid;
SET LOCAL ROLE service_role;
DO $revocation$
DECLARE doc jsonb;
BEGIN
 doc:=public.mobility_stage_g33_quarantined_zone_diagnostic(
 md5('G33_USER_8')::uuid,md5('G33_ZONE_ONE')::uuid,
 'AUTO_DELIVERY',
 floor(extract(epoch FROM clock_timestamp())*1000)::bigint);
 IF (doc->>'consentingIdleCandidates')::int<>0 OR
    (doc->>'quarantinedRecentSignals')::int<>5
 THEN RAISE EXCEPTION 'G33 withdrawal did not invalidate idle count %',doc; END IF;
END $revocation$;
RESET ROLE;
ROLLBACK;
