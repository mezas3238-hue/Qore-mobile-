-- G213 security and positive state-change test. Uses the original G119
-- completed QA MOTO fixture, reversibly rewound inside ROLLBACK ONLY.
-- No legal permit, IdP, GPS, LIVE dispatch or commercial payment is issued.
DO $guard$ BEGIN
 IF pg_catalog.current_database()<>'qore_disposable_chain'
 OR pg_catalog.current_setting('application_name')<>'qore_ci_disposable_chain'
 OR pg_catalog.has_function_privilege('service_role',
  'public.mobility_stage_g118_moto_driver_step_qa(uuid,uuid,bigint,text,uuid)','EXECUTE')
 OR NOT pg_catalog.has_function_privilege('service_role',
  'public.mobility_stage_g213_moto_driver_step_qa(uuid,uuid,bigint,uuid,bigint,text,uuid)','EXECUTE')
 OR pg_catalog.has_function_privilege('authenticated',
  'public.mobility_stage_g213_moto_driver_step_qa(uuid,uuid,bigint,uuid,bigint,text,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G213 direct G118 bypass or mobile SQL grants exposed'; END IF;
END $guard$;
BEGIN;
DO $prepare$
DECLARE t public.mobility_stage_g100_moto_trips%ROWTYPE;
 driver uuid:='11900000-0000-4119-8119-000000000003';
 offer uuid:='11900000-0000-4119-8119-000000000011';
BEGIN
 SELECT * INTO t FROM public.mobility_stage_g100_moto_trips
 WHERE booking_key='11900000-0000-4119-8119-000000000020'::uuid;
 IF t.id IS NULL OR t.status<>'completed' OR t.revision<>5
 OR t.driver_id<>driver OR t.accepted_offer_id<>offer THEN
  RAISE EXCEPTION 'G213 original G119 QA MOTO source is not terminal'; END IF;
 DELETE FROM public.mobility_stage_g118_moto_events WHERE trip_id=t.id;
 UPDATE public.mobility_stage_g100_moto_trips
 SET status='accepted',revision=2,completed_at=NULL
 WHERE id=t.id;
 INSERT INTO public.mobility_stage_g118_moto_offers(
  id,trip_id,driver_id,vehicle_id,request_key,status,decision_key,
  created_at,expires_at
 ) VALUES(offer,t.id,driver,t.vehicle_id,
  '21300000-0000-4213-8213-000000000001',
  'accepted','21300000-0000-4213-8213-000000000002',
  t.created_at,pg_catalog.clock_timestamp()+interval '1 hour');
 DELETE FROM public.user_roles WHERE user_id=driver;
 INSERT INTO public.user_roles(user_id,role) VALUES(driver,'driver');
 INSERT INTO public.mobility_stage_g42_provider_session_grants(
  user_id,session_id,provider_confirmed_at,token_allowed_from,
  valid_until,evidence_kind
 ) VALUES(driver,'21300000-0000-4213-8213-000000000003',
  pg_catalog.clock_timestamp()-interval '10 minutes',
  pg_catalog.clock_timestamp()-interval '5 minutes',
  pg_catalog.clock_timestamp()+interval '1 hour',
  'QA_SYNTHETIC_PROVIDER_SESSION_ONLY');
END $prepare$;
SET LOCAL ROLE service_role;
DO $positive$
DECLARE driver uuid:='11900000-0000-4119-8119-000000000003';
 session uuid:='21300000-0000-4213-8213-000000000003';
 booking uuid:='11900000-0000-4119-8119-000000000020';
 iat bigint:=(extract(epoch FROM pg_catalog.clock_timestamp()-interval '1 minute')*1000)::bigint;
 got jsonb; denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g213_moto_driver_step_qa(
   driver,'21300000-0000-4213-8213-000000000099',iat,booking,
   2,'arriving','21300000-0000-4213-8213-000000000010');
 EXCEPTION WHEN SQLSTATE 'P2131' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G213 accepted foreign/revoked IdP session'; END IF;
 got:=public.mobility_stage_g213_moto_driver_step_qa(
  driver,session,iat,booking,
  2,'arriving','21300000-0000-4213-8213-000000000011');
 IF got->>'serviceKind'<>'MOTO_RIDE'
 OR got->>'bookingKey'<>booking::text
 OR got->>'tripState'<>'arriving'
 OR (got->>'tripRevision')::integer<>3
 OR got->>'serverPersisted'<>'true'
 THEN RAISE EXCEPTION 'G213 original MOTO transition not persisted: %',got; END IF;
END $positive$;
RESET ROLE;
UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=pg_catalog.clock_timestamp(),revision=revision+1
 WHERE user_id='11900000-0000-4119-8119-000000000003'
  AND session_id='21300000-0000-4213-8213-000000000003';
SET LOCAL ROLE service_role;
DO $revoked$
DECLARE denied boolean:=false; event_count integer;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g213_moto_driver_step_qa(
   '11900000-0000-4119-8119-000000000003',
   '21300000-0000-4213-8213-000000000003',
   (extract(epoch FROM pg_catalog.clock_timestamp()-interval '1 minute')*1000)::bigint,
   '11900000-0000-4119-8119-000000000020',
   3,'in_progress','21300000-0000-4213-8213-000000000012');
 EXCEPTION WHEN SQLSTATE 'P2131' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G213 advanced MOTO after session revocation'; END IF;
END $revoked$;
RESET ROLE;
-- G118 events remain inaccessible to service_role. Only the isolated QA
-- database owner may inspect the event count, never the app or Driver.
DO $auditor$
DECLARE event_count integer;
BEGIN
 SELECT count(*) INTO event_count FROM public.mobility_stage_g118_moto_events
 WHERE trip_id=(SELECT id FROM public.mobility_stage_g100_moto_trips
   WHERE booking_key='11900000-0000-4119-8119-000000000020');
 IF event_count<>1 THEN RAISE EXCEPTION 'G213 duplicate event after revocation'; END IF;
 RAISE NOTICE 'G213 PASS: original G119 MOTO accepted Driver to arriving under G42 row lock, revoked session rejects next stage, direct G118 SQL privilege blocked, no LIVE';
END $auditor$;
ROLLBACK;
