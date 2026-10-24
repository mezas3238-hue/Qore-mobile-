-- G53 adversarial disposable QA. Uses the synthetic source fixture G50 race.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g50_race_source') IS NULL
 OR to_regprocedure('public.mobility_stage_g53_passenger_send_owner_qa(text,uuid,uuid,uuid,uuid,bigint,uuid,text)') IS NULL
 THEN RAISE EXCEPTION 'G53 requires fully disposable G50/G52 fixture'; END IF;
 IF has_function_privilege('service_role',
   'public.mobility_stage_g53_passenger_send_owner_qa(text,uuid,uuid,uuid,uuid,bigint,uuid,text)','EXECUTE')
 OR has_function_privilege('authenticated',
   'public.mobility_stage_g53_passenger_send_owner_qa(text,uuid,uuid,uuid,uuid,bigint,uuid,text)','EXECUTE')
 OR has_function_privilege('mobility_g48_gateway_ci',
   'public.mobility_stage_g53_passenger_send_owner_qa(text,uuid,uuid,uuid,uuid,bigint,uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'G53 leaked executor to HTTP/SDK'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
INSERT INTO auth.users(id) VALUES
 ('53530000-0000-4353-8353-000000000001'),
 ('53530000-0000-4353-8353-000000000002'),
 ('53530000-0000-4353-8353-000000000003')
ON CONFLICT DO NOTHING;
DELETE FROM public.user_roles
 WHERE user_id='53530000-0000-4353-8353-000000000002'
 AND role='passenger'::public.app_role;
INSERT INTO public.user_roles(user_id,role)
 VALUES('53530000-0000-4353-8353-000000000002','driver'::public.app_role);
INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind
) SELECT u.id,('53530000-0000-4353-8353-'||
 lpad((100+row_number() OVER(ORDER BY u.id))::text,12,'0'))::uuid,
 clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 minute',
 clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY'
 FROM auth.users u WHERE u.id IN(
 '53530000-0000-4353-8353-000000000001',
 '53530000-0000-4353-8353-000000000002',
 '53530000-0000-4353-8353-000000000003');
INSERT INTO public.mobility_stage_g50_race_source(id,passenger_id,driver_id,can_send)
 VALUES('53530000-0000-4353-8353-000000000200',
 '53530000-0000-4353-8353-000000000001',
 '53530000-0000-4353-8353-000000000002',true);
DO $cases$
DECLARE p uuid:='53530000-0000-4353-8353-000000000001';
 d uuid:='53530000-0000-4353-8353-000000000002';
 outsider uuid:='53530000-0000-4353-8353-000000000003';
 ps uuid:='53530000-0000-4353-8353-000000000101';
 ds uuid:='53530000-0000-4353-8353-000000000102';
 os uuid:='53530000-0000-4353-8353-000000000103';
 service uuid:='53530000-0000-4353-8353-000000000200';
 key1 uuid:='53530000-0000-4353-8353-000000000401';
 key2 uuid:='53530000-0000-4353-8353-000000000402';
 t uuid; original jsonb; replay jsonb; later jsonb; denied boolean:=false;
 at_ms bigint:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
BEGIN
 t:=(public.mobility_stage_g50_open_owner_qa('RIDE',service,p,ps,at_ms)->>'conversationId')::uuid;
 original:=public.mobility_stage_g53_passenger_send_owner_qa(
  'RIDE',service,t,p,ps,at_ms,key1,'Estoy en la entrada');
 IF original->>'conversationId'<>t::text OR
 original->>'serviceId'<>service::text OR
 original->>'requestKey'<>key1::text OR
 original->>'senderRole'<>'passenger' OR
 original->>'body'<>'Estoy en la entrada' OR
 original->>'serverStored'<>'true' OR
 (original->>'revision')::bigint<>2 OR
 (original->>'createdAt')::bigint<=0
 THEN RAISE EXCEPTION 'G53 ACK not backed by stored message'; END IF;
 replay:=public.mobility_stage_g53_passenger_send_owner_qa(
  'RIDE',service,t,p,ps,at_ms,key1,'Estoy en la entrada');
 IF replay IS DISTINCT FROM original THEN
  RAISE EXCEPTION 'G53 replay changed original durable ACK'; END IF;
 later:=public.mobility_stage_g53_passenger_send_owner_qa(
  'RIDE',service,t,p,ps,at_ms,key2,'Gracias');
 IF later->>'messageId'=original->>'messageId' OR
 (later->>'revision')::bigint<>3
 THEN RAISE EXCEPTION 'G53 second unique message version wrong'; END IF;
 replay:=public.mobility_stage_g53_passenger_send_owner_qa(
  'RIDE',service,t,p,ps,at_ms,key1,'Estoy en la entrada');
 IF replay IS DISTINCT FROM original OR
 (SELECT count(*) FROM public.mobility_stage_g50_chat_messages WHERE conversation_id=t)<>2 OR
 (SELECT revision FROM public.mobility_stage_g52_thread_versions WHERE conversation_id=t)<>3
 THEN RAISE EXCEPTION 'G53 duplicate replay updated high-water mark'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g53_passenger_send_owner_qa(
   'RIDE',service,t,p,ps,at_ms,key1,'Mensaje alterado');
 EXCEPTION WHEN SQLSTATE 'G5009' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G53 key replay with different body succeeded'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g53_passenger_send_owner_qa(
   'DELIVERY',service,t,p,ps,at_ms,key1,'Incorrecto');
 EXCEPTION WHEN SQLSTATE 'G5304' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G53 wrong serviceKind succeeded'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g53_passenger_send_owner_qa(
   NULL,service,t,p,ps,at_ms,key1,'Tipo ausente');
 EXCEPTION WHEN SQLSTATE 'G5302' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G53 null serviceKind bypassed boundary'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g53_passenger_send_owner_qa(
   'RIDE','53530000-0000-4353-8353-000000000999',t,p,ps,at_ms,key1,'Incorrecto');
 EXCEPTION WHEN SQLSTATE 'G5304' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G53 wrong serviceId succeeded'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g53_passenger_send_owner_qa(
   'RIDE',service,t,d,ds,at_ms,key1,'Suplantar pasajero');
 EXCEPTION WHEN SQLSTATE 'G5303' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G53 driver forged Passenger ACK'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g53_passenger_send_owner_qa(
   'RIDE',service,t,outsider,os,at_ms,key1,'Intruso');
 EXCEPTION WHEN SQLSTATE 'G5003' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G53 foreign user sent to private thread'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g53_passenger_send_owner_qa(
   'RIDE',service,t,p,ps,at_ms,'53530000-0000-4353-8353-000000000450','<b>HTML</b>');
 EXCEPTION WHEN SQLSTATE 'G5002' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G53 stored Client-rejected text'; END IF;
 UPDATE public.mobility_stage_g50_race_source SET driver_id=outsider WHERE id=service;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g53_passenger_send_owner_qa(
   'RIDE',service,t,p,ps,at_ms,key1,'Estoy en la entrada');
 EXCEPTION WHEN SQLSTATE 'G5003' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G53 replay leaked after assignment change'; END IF;
 UPDATE public.mobility_stage_g50_race_source
 SET driver_id=d,can_send=false WHERE id=service;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g53_passenger_send_owner_qa(
   'RIDE',service,t,p,ps,at_ms,key1,'Estoy en la entrada');
 EXCEPTION WHEN SQLSTATE 'G5004' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G53 replay succeeded after service terminal'; END IF;
 UPDATE public.mobility_stage_g50_race_source SET can_send=true WHERE id=service;
 UPDATE public.mobility_stage_g42_provider_session_grants SET revoked_at=clock_timestamp()
 WHERE user_id=p AND session_id=ps;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g53_passenger_send_owner_qa(
   'RIDE',service,t,p,ps,at_ms,key1,'Estoy en la entrada');
 EXCEPTION WHEN SQLSTATE 'G5001' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G53 revoked session replayed durable ACK'; END IF;
 RAISE NOTICE 'G53 PASS: stored ACK, original immutable revision, replay, role, assignment and revocation';
END $cases$;
ROLLBACK;
