-- G50 adversarial database QA. All fixtures and mock source override ROLLBACK.
-- Source wiring to physical active trips/deliveries still requires separate E2E.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g50_chat_threads') IS NULL
 THEN RAISE EXCEPTION 'G50 non-disposable/missing schema'; END IF;
 IF has_table_privilege('service_role','public.mobility_stage_g50_chat_messages','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_g50_chat_threads','INSERT')
 OR has_table_privilege('mobility_g48_gateway_ci','public.mobility_stage_g50_chat_messages','SELECT')
 OR has_function_privilege('service_role',
  'public.mobility_stage_g50_send_owner_qa(uuid,uuid,uuid,bigint,uuid,text)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.mobility_stage_g50_open_owner_qa(text,uuid,uuid,uuid,bigint)','EXECUTE')
 THEN RAISE EXCEPTION 'G50 leaked SQL capability'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
-- Check actual-source unknown service denial BEFORE replacing with mock.
DO $actual$
BEGIN
 IF EXISTS (SELECT 1 FROM public.mobility_stage_g50_source(
  'RIDE','50500000-0000-4050-8050-000000000900'))
 THEN RAISE EXCEPTION 'G50 actual source invented assignment'; END IF;
END $actual$;
INSERT INTO auth.users(id) VALUES
 ('50500000-0000-4050-8050-000000000001'),
 ('50500000-0000-4050-8050-000000000002'),
 ('50500000-0000-4050-8050-000000000003'),
 ('50500000-0000-4050-8050-000000000004')
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('50500000-0000-4050-8050-000000000001','passenger'),
 ('50500000-0000-4050-8050-000000000002','driver'),
 ('50500000-0000-4050-8050-000000000003','passenger'),
 ('50500000-0000-4050-8050-000000000004','driver');
INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind
) SELECT u.id,'50500000-0000-4050-8050-'||
 lpad((100+row_number() OVER(ORDER BY u.id))::text,12,'0')::text::uuid,
 pg_catalog.clock_timestamp()-interval '1 day',
 pg_catalog.clock_timestamp()-interval '1 minute',
 pg_catalog.clock_timestamp()+interval '1 hour',
 'QA_SYNTHETIC_PROVIDER_SESSION_ONLY'
 FROM auth.users u WHERE u.id IN(
 '50500000-0000-4050-8050-000000000001',
 '50500000-0000-4050-8050-000000000002',
 '50500000-0000-4050-8050-000000000003',
 '50500000-0000-4050-8050-000000000004');
-- Fixture is intentionally isolated from G37 commercial assignment constraints.
CREATE TABLE public.mobility_stage_g50_fixture_source(
 id uuid PRIMARY KEY,passenger_id uuid NOT NULL,driver_id uuid NOT NULL,
 can_send boolean NOT NULL
);
INSERT INTO public.mobility_stage_g50_fixture_source VALUES(
 '50500000-0000-4050-8050-000000000200',
 '50500000-0000-4050-8050-000000000001',
 '50500000-0000-4050-8050-000000000002',true);
CREATE OR REPLACE FUNCTION public.mobility_stage_g50_source(_kind text,_service uuid)
RETURNS TABLE(passenger_id uuid,driver_id uuid,can_send boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fixture$
BEGIN
 IF _kind='RIDE' THEN
  RETURN QUERY SELECT f.passenger_id,f.driver_id,f.can_send
  FROM public.mobility_stage_g50_fixture_source f WHERE id=_service FOR SHARE;
 END IF;
END $fixture$;
DO $test$
DECLARE buyer uuid:='50500000-0000-4050-8050-000000000001';
 driver uuid:='50500000-0000-4050-8050-000000000002';
 foreign_actor uuid:='50500000-0000-4050-8050-000000000003';
 next_driver uuid:='50500000-0000-4050-8050-000000000004';
 service uuid:='50500000-0000-4050-8050-000000000200';
 buyer_session uuid:='50500000-0000-4050-8050-000000000101';
 driver_session uuid:='50500000-0000-4050-8050-000000000102';
 foreign_session uuid:='50500000-0000-4050-8050-000000000103';
 next_session uuid:='50500000-0000-4050-8050-000000000104';
 at_ms bigint:=floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint;
 thread1 uuid; thread2 uuid; r jsonb; sent jsonb; old jsonb;
 denied boolean:=false;
BEGIN
 r:=public.mobility_stage_g50_open_owner_qa(
  'RIDE',service,buyer,buyer_session,at_ms);
 thread1:=(r->>'conversationId')::uuid;
 IF thread1 IS NULL OR r->>'serverStored'<>'true' OR
 (public.mobility_stage_g50_open_owner_qa(
  'RIDE',service,driver,driver_session,at_ms)->>'conversationId')::uuid<>thread1
 THEN RAISE EXCEPTION 'G50 two participants need same persisted thread'; END IF;
 sent:=public.mobility_stage_g50_send_owner_qa(thread1,buyer,buyer_session,at_ms,
  '50500000-0000-4050-8050-000000000401','Hola');
 r:=public.mobility_stage_g50_send_owner_qa(thread1,buyer,buyer_session,at_ms,
  '50500000-0000-4050-8050-000000000401','Hola');
 IF r->>'messageId'<>sent->>'messageId'
 OR (SELECT count(*) FROM public.mobility_stage_g50_chat_messages
  WHERE conversation_id=thread1)<>1
 THEN RAISE EXCEPTION 'G50 requestKey replay duplicated write'; END IF;
 BEGIN
  PERFORM public.mobility_stage_g50_send_owner_qa(thread1,buyer,buyer_session,at_ms,
   '50500000-0000-4050-8050-000000000401','tampered');
 EXCEPTION WHEN SQLSTATE 'G5009' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G50 conflicting replay succeeded'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g50_page_owner_qa(thread1,foreign_actor,foreign_session,
   at_ms,0,50);
 EXCEPTION WHEN SQLSTATE 'G5003' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G50 foreign actor could read'; END IF;
 r:=public.mobility_stage_g50_page_owner_qa(thread1,driver,driver_session,at_ms,0,50);
 IF jsonb_array_length(r->'messages')<>1 OR r->>'hasMore'<>'false' OR
  (r->>'nextAfter')::bigint<1
 THEN RAISE EXCEPTION 'G50 page was incomplete'; END IF;
 -- Reassignment: previous thread must not leak or accept a message.
 UPDATE public.mobility_stage_g50_fixture_source
 SET driver_id=next_driver WHERE id=service;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g50_send_owner_qa(thread1,driver,driver_session,at_ms,
   '50500000-0000-4050-8050-000000000402','mensaje tardio');
 EXCEPTION WHEN SQLSTATE 'G5003' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G50 old driver could write'; END IF;
 r:=public.mobility_stage_g50_open_owner_qa(
  'RIDE',service,buyer,buyer_session,at_ms);
 thread2:=(r->>'conversationId')::uuid;
 IF thread1=thread2 OR
 (SELECT state FROM public.mobility_stage_g50_chat_threads
  WHERE conversation_id=thread1)<>'CLOSED'
 THEN RAISE EXCEPTION 'G50 did not rotate on driver reassignment'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g50_page_owner_qa(
   thread1,driver,driver_session,at_ms,0,50);
 EXCEPTION WHEN SQLSTATE 'G5004' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G50 stale conversation readable'; END IF;
 r:=public.mobility_stage_g50_page_owner_qa(
  thread2,next_driver,next_session,at_ms,0,50);
 IF jsonb_array_length(r->'messages')<>0
 THEN RAISE EXCEPTION 'G50 new driver received prior message'; END IF;
 UPDATE public.mobility_stage_g50_fixture_source
 SET can_send=false WHERE id=service;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g50_send_owner_qa(thread2,buyer,buyer_session,at_ms,
   '50500000-0000-4050-8050-000000000403','terminal');
 EXCEPTION WHEN SQLSTATE 'G5004' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G50 wrote after terminal service'; END IF;
 UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=pg_catalog.clock_timestamp()
 WHERE user_id=buyer AND session_id=buyer_session;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g50_page_owner_qa(
   thread2,buyer,buyer_session,at_ms,0,50);
 EXCEPTION WHEN SQLSTATE 'G5001' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G50 revoked session could read'; END IF;
 RAISE NOTICE 'G50 PASS: SQL roles, idempotency, reassignment isolation, terminal, revocation';
END $test$;
ROLLBACK;
