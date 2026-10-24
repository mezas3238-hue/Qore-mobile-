-- G56 A38 phase 1: actual NOLOGIN delegated Driver role; never a production fixture.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g56_driver_tickets') IS NULL
 THEN RAISE EXCEPTION 'G56 asserts need isolated database'; END IF;
 IF (SELECT rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit
  FROM pg_catalog.pg_roles WHERE rolname='mobility_g56_driver_gateway_ci') IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'G56 role privileged'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
DO $privileges$
DECLARE role_name text; f text;
BEGIN
 FOR role_name IN SELECT unnest(ARRAY[
  'anon','authenticated','service_role','mobility_g48_gateway_ci',
  'mobility_g49_chat_gateway_ci']) LOOP
  FOREACH f IN ARRAY ARRAY[
   'public.mobility_stage_g56_open_qa(uuid)',
   'public.mobility_stage_g56_send_qa(uuid,uuid,text)',
   'public.mobility_stage_g56_history_qa(uuid,bigint,bigint,integer)',
   'public.mobility_stage_g56_mint_owner_qa(uuid,uuid,bigint,text,text,uuid,uuid)'
  ] LOOP
   IF has_function_privilege(role_name,f,'EXECUTE')
   THEN RAISE EXCEPTION 'G56 leaked wrapper/mint % %',role_name,f; END IF;
  END LOOP;
 END LOOP;
 FOREACH f IN ARRAY ARRAY[
  'public.mobility_stage_g56_mint_owner_qa(uuid,uuid,bigint,text,text,uuid,uuid)',
  'public.mobility_stage_g56_consume_qa(uuid,text)',
  'public.mobility_stage_g50_send_owner_qa(uuid,uuid,uuid,bigint,uuid,text)',
  'public.mobility_stage_g49_open_qa(uuid)'
 ] LOOP
  IF has_function_privilege('mobility_g56_driver_gateway_ci',f,'EXECUTE')
  THEN RAISE EXCEPTION 'G56 bypass available %',f; END IF;
 END LOOP;
 FOREACH f IN ARRAY ARRAY[
  'public.mobility_stage_g56_open_qa(uuid)',
  'public.mobility_stage_g56_send_qa(uuid,uuid,text)',
  'public.mobility_stage_g56_history_qa(uuid,bigint,bigint,integer)'
 ] LOOP
  IF NOT has_function_privilege('mobility_g56_driver_gateway_ci',f,'EXECUTE')
  THEN RAISE EXCEPTION 'G56 absent delegate grant %',f; END IF;
 END LOOP;
 IF has_table_privilege('mobility_g56_driver_gateway_ci',
  'public.mobility_stage_g56_driver_tickets','SELECT')
 OR has_table_privilege('mobility_g56_driver_gateway_ci',
  'public.mobility_stage_g50_chat_messages','SELECT')
 THEN RAISE EXCEPTION 'G56 delegate exposes private content'; END IF;
END $privileges$;
INSERT INTO auth.users(id) VALUES
 ('56560000-0000-4656-8656-000000000001'),
 ('56560000-0000-4656-8656-000000000002'),
 ('56560000-0000-4656-8656-000000000003'),
 ('56560000-0000-4656-8656-000000000004')
ON CONFLICT DO NOTHING;
DELETE FROM public.user_roles
 WHERE user_id IN('56560000-0000-4656-8656-000000000002',
  '56560000-0000-4656-8656-000000000003')
 AND role='passenger'::public.app_role;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('56560000-0000-4656-8656-000000000002','driver'::public.app_role),
 ('56560000-0000-4656-8656-000000000003','driver'::public.app_role)
ON CONFLICT DO NOTHING;
INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
SELECT u.id,('56560000-0000-4656-8656-'||
 lpad((100+row_number() OVER(ORDER BY u.id))::text,12,'0'))::uuid,
 pg_catalog.clock_timestamp()-interval '1 day',
 pg_catalog.clock_timestamp()-interval '1 minute',
 pg_catalog.clock_timestamp()+interval '1 hour',
 'QA_SYNTHETIC_PROVIDER_SESSION_ONLY'
FROM auth.users u WHERE u.id IN(
 '56560000-0000-4656-8656-000000000001',
 '56560000-0000-4656-8656-000000000002',
 '56560000-0000-4656-8656-000000000003',
 '56560000-0000-4656-8656-000000000004');
CREATE TABLE public.mobility_stage_g56_fixture_source(
 id uuid PRIMARY KEY,passenger_id uuid NOT NULL,driver_id uuid NOT NULL,
 can_send boolean NOT NULL
);
INSERT INTO public.mobility_stage_g56_fixture_source VALUES(
 '56560000-0000-4656-8656-000000000200',
 '56560000-0000-4656-8656-000000000001',
 '56560000-0000-4656-8656-000000000002',true);
CREATE OR REPLACE FUNCTION public.mobility_stage_g50_source(_kind text,_service uuid)
 RETURNS TABLE(passenger_id uuid,driver_id uuid,can_send boolean)
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fixture$
BEGIN
 IF _kind='RIDE' THEN
  RETURN QUERY SELECT f.passenger_id,f.driver_id,f.can_send
  FROM public.mobility_stage_g56_fixture_source f WHERE id=_service FOR SHARE;
 END IF;
END $fixture$;
DO $denials$
DECLARE atms bigint:=floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint;
 denied boolean;
BEGIN
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g56_mint_owner_qa(
   '56560000-0000-4656-8656-000000000001',
   '56560000-0000-4656-8656-000000000101',atms,'DRIVER_OPEN',
   'RIDE','56560000-0000-4656-8656-000000000200',NULL);
 EXCEPTION WHEN SQLSTATE 'G5603' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G56 passenger obtained Driver ticket'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g56_mint_owner_qa(
   '56560000-0000-4656-8656-000000000003',
   '56560000-0000-4656-8656-000000000103',atms,'DRIVER_OPEN',
   'RIDE','56560000-0000-4656-8656-000000000200',NULL);
 EXCEPTION WHEN SQLSTATE 'G5604' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G56 unassigned Driver obtained ticket'; END IF;
END $denials$;
-- The actual NOLOGIN delegated identity invokes OPEN with no direct table privileges.
SELECT public.mobility_stage_g56_mint_owner_qa(
 '56560000-0000-4656-8656-000000000002',
 '56560000-0000-4656-8656-000000000102',
 floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
 'DRIVER_OPEN','RIDE','56560000-0000-4656-8656-000000000200',NULL)->>'ticket'
 AS open_ticket \gset
SET LOCAL ROLE mobility_g56_driver_gateway_ci;
SELECT public.mobility_stage_g56_open_qa(:'open_ticket'::uuid)->>'conversationId'
 AS conversation \gset
RESET ROLE;
DO $opened$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.mobility_stage_g50_chat_threads
  WHERE conversation_id=:'conversation'::uuid)
 THEN RAISE EXCEPTION 'G56 delegated open did not persist'; END IF;
END $opened$;
-- Request payload is sent by a delegated ticket; actor never comes from mobile.
SELECT public.mobility_stage_g56_mint_owner_qa(
 '56560000-0000-4656-8656-000000000002',
 '56560000-0000-4656-8656-000000000102',
 floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
 'DRIVER_SEND','RIDE','56560000-0000-4656-8656-000000000200',
 :'conversation'::uuid)->>'ticket' AS send_ticket \gset
SET LOCAL ROLE mobility_g56_driver_gateway_ci;
SELECT public.mobility_stage_g56_send_qa(
 :'send_ticket'::uuid,'56560000-0000-4656-8656-000000000401','Voy llegando')
 ->>'messageId' AS message \gset
RESET ROLE;
SELECT public.mobility_stage_g56_mint_owner_qa(
 '56560000-0000-4656-8656-000000000002',
 '56560000-0000-4656-8656-000000000102',
 floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
 'DRIVER_SEND','RIDE','56560000-0000-4656-8656-000000000200',
 :'conversation'::uuid)->>'ticket' AS replay_ticket \gset
SET LOCAL ROLE mobility_g56_driver_gateway_ci;
SELECT public.mobility_stage_g56_send_qa(
 :'replay_ticket'::uuid,'56560000-0000-4656-8656-000000000401','Voy llegando')
 ->>'messageId' AS replayed \gset
RESET ROLE;
DO $verify_ack$
BEGIN
 IF :'message'<>:'replayed' OR
 (SELECT count(*) FROM public.mobility_stage_g50_chat_messages
  WHERE conversation_id=:'conversation'::uuid)<>1
 THEN RAISE EXCEPTION 'G56 idempotence duplicated Driver message'; END IF;
END $verify_ack$;
SELECT public.mobility_stage_g56_mint_owner_qa(
 '56560000-0000-4656-8656-000000000002',
 '56560000-0000-4656-8656-000000000102',
 floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
 'DRIVER_HISTORY','RIDE','56560000-0000-4656-8656-000000000200',
 :'conversation'::uuid)->>'ticket' AS history_ticket \gset
SET LOCAL ROLE mobility_g56_driver_gateway_ci;
SELECT public.mobility_stage_g56_history_qa(:'history_ticket'::uuid,NULL,NULL,100)
 AS delegated_driver_history;
RESET ROLE;
DO $final$
DECLARE minted jsonb; denied boolean; atms bigint:=
 floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint;
BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_g50_chat_messages
  WHERE sender_id='56560000-0000-4656-8656-000000000002'
  AND message_id=:'message'::uuid)<>1
 THEN RAISE EXCEPTION 'G56 wrong Driver sender'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g56_open_qa(:'open_ticket'::uuid);
 EXCEPTION WHEN SQLSTATE 'G5605' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G56 one-use ticket replay accepted'; END IF;
 minted:=public.mobility_stage_g56_mint_owner_qa(
  '56560000-0000-4656-8656-000000000002',
  '56560000-0000-4656-8656-000000000102',atms,
  'DRIVER_SEND','RIDE','56560000-0000-4656-8656-000000000200',
  :'conversation'::uuid);
 UPDATE public.mobility_stage_g56_fixture_source
 SET driver_id='56560000-0000-4656-8656-000000000003';
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g56_send_qa(
   (minted->>'ticket')::uuid,'56560000-0000-4656-8656-000000000402','Hola');
 EXCEPTION WHEN SQLSTATE 'G5003' OR SQLSTATE 'G5604' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G56 old Driver survived reassignment'; END IF;
 UPDATE public.mobility_stage_g56_fixture_source
 SET driver_id='56560000-0000-4656-8656-000000000002';
 minted:=public.mobility_stage_g56_mint_owner_qa(
  '56560000-0000-4656-8656-000000000002',
  '56560000-0000-4656-8656-000000000102',atms,
  'DRIVER_HISTORY','RIDE','56560000-0000-4656-8656-000000000200',
  :'conversation'::uuid);
 UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=clock_timestamp(),revision=revision+1
 WHERE user_id='56560000-0000-4656-8656-000000000002'
 AND session_id='56560000-0000-4656-8656-000000000102';
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g56_history_qa(
   (minted->>'ticket')::uuid,NULL,NULL,50);
 EXCEPTION WHEN SQLSTATE 'G5601' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G56 revoked Driver session accepted'; END IF;
 RAISE NOTICE 'G56 phase1 PASS: Driver role, actual delegate, one-use, ACK, stale assignment and revoked session';
END $final$;
ROLLBACK;
