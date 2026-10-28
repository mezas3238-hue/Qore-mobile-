-- G49 PG16 QA privilege and one-use capability assertions, synthetic-only.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g50_race_source') IS NULL
 THEN RAISE EXCEPTION 'G49 tests require disposable synthetic G50'; END IF;
 IF (SELECT rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit
  FROM pg_catalog.pg_roles WHERE rolname='mobility_g49_chat_gateway_ci')
 IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'G49 gateway role elevated'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
INSERT INTO auth.users(id) VALUES
 ('49490000-0000-4949-8949-000000000001'),
 ('49490000-0000-4949-8949-000000000002'),
 ('49490000-0000-4949-8949-000000000003')
ON CONFLICT DO NOTHING;
DELETE FROM public.user_roles
 WHERE user_id='49490000-0000-4949-8949-000000000002'
 AND role='passenger'::public.app_role;
INSERT INTO public.user_roles(user_id,role)
 VALUES('49490000-0000-4949-8949-000000000002','driver'::public.app_role)
 ON CONFLICT DO NOTHING;
INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
 SELECT u.id,('49490000-0000-4949-8949-'||
 lpad((100+row_number() OVER(ORDER BY u.id))::text,12,'0'))::uuid,
 clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 minute',
 clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY'
 FROM auth.users u WHERE u.id IN(
 '49490000-0000-4949-8949-000000000001',
 '49490000-0000-4949-8949-000000000002',
 '49490000-0000-4949-8949-000000000003');
INSERT INTO public.mobility_stage_g50_race_source(id,passenger_id,driver_id,can_send)
 VALUES('49490000-0000-4949-8949-000000000200',
 '49490000-0000-4949-8949-000000000001',
 '49490000-0000-4949-8949-000000000002',true);
DO $cases$
DECLARE p uuid:='49490000-0000-4949-8949-000000000001';
 d uuid:='49490000-0000-4949-8949-000000000002';
 stranger uuid:='49490000-0000-4949-8949-000000000003';
 ps uuid:='49490000-0000-4949-8949-000000000101';
 ds uuid:='49490000-0000-4949-8949-000000000102';
 ss uuid:='49490000-0000-4949-8949-000000000103';
 sid uuid:='49490000-0000-4949-8949-000000000200';
 key1 uuid:='49490000-0000-4949-8949-000000000400';
 tick jsonb; conv uuid; receipt jsonb; atms bigint:=
  floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 denial boolean;
 r text; fname text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role',
   'mobility_g48_gateway_ci'] LOOP
  FOREACH fname IN ARRAY ARRAY[
   'public.mobility_stage_g49_open_qa(uuid)',
   'public.mobility_stage_g49_send_qa(uuid,uuid,text)',
   'public.mobility_stage_g49_history_qa(uuid,bigint,bigint,integer)',
   'public.mobility_stage_g49_mint_owner_qa(uuid,uuid,bigint,text,text,uuid,uuid)'
  ] LOOP
   IF has_function_privilege(r,fname,'EXECUTE')
   THEN RAISE EXCEPTION 'G49 leaked SQL capability % %',r,fname; END IF;
  END LOOP;
 END LOOP;
 FOREACH fname IN ARRAY ARRAY[
  'public.mobility_stage_g49_mint_owner_qa(uuid,uuid,bigint,text,text,uuid,uuid)',
  'public.mobility_stage_g49_consume_qa(uuid,text)',
  'public.mobility_stage_g50_open_owner_qa(text,uuid,uuid,uuid,bigint)',
  'public.mobility_stage_g50_send_owner_qa(uuid,uuid,uuid,bigint,uuid,text)',
  'public.mobility_stage_g52_history_owner_qa(uuid,uuid,uuid,bigint,bigint,bigint,integer)',
  'public.mobility_stage_g53_passenger_send_owner_qa(text,uuid,uuid,uuid,uuid,bigint,uuid,text)'
 ] LOOP
  IF has_function_privilege('mobility_g49_chat_gateway_ci',fname,'EXECUTE')
  THEN RAISE EXCEPTION 'G49 delegate can bypass capability %',fname; END IF;
 END LOOP;
 FOREACH fname IN ARRAY ARRAY[
  'public.mobility_stage_g49_open_qa(uuid)',
  'public.mobility_stage_g49_history_qa(uuid,bigint,bigint,integer)',
  'public.mobility_stage_g49_send_qa(uuid,uuid,text)'
 ] LOOP
  IF NOT has_function_privilege('mobility_g49_chat_gateway_ci',fname,'EXECUTE')
  THEN RAISE EXCEPTION 'G49 missing narrow wrapper %',fname; END IF;
 END LOOP;
 IF has_table_privilege('mobility_g49_chat_gateway_ci',
   'public.mobility_stage_g49_chat_tickets','SELECT') OR
 has_table_privilege('mobility_g49_chat_gateway_ci',
   'public.mobility_stage_g50_chat_messages','SELECT') OR
 has_table_privilege('mobility_g49_chat_gateway_ci',
   'public.mobility_stage_g42_provider_session_grants','SELECT')
 THEN RAISE EXCEPTION 'G49 delegate can view secrets or bodies'; END IF;
 denial:=false;
 BEGIN
  PERFORM public.mobility_stage_g49_mint_owner_qa(
   d,ds,atms,'CHAT_OPEN','RIDE',sid,NULL);
 EXCEPTION WHEN SQLSTATE 'G4903' THEN denial:=true; END;
 IF NOT denial THEN RAISE EXCEPTION 'G49 Driver minted Passenger open'; END IF;
 denial:=false;
 BEGIN
  PERFORM public.mobility_stage_g49_mint_owner_qa(
   stranger,ss,atms,'CHAT_OPEN','RIDE',sid,NULL);
 EXCEPTION WHEN SQLSTATE 'G4904' THEN denial:=true; END;
 IF NOT denial THEN RAISE EXCEPTION 'G49 stranger minted chat'; END IF;
 denial:=false;
 BEGIN
  PERFORM public.mobility_stage_g49_mint_owner_qa(
   p,ps,atms,'CHAT_SEND','RIDE',sid,NULL);
 EXCEPTION WHEN SQLSTATE 'G4901' THEN denial:=true; END;
 IF NOT denial THEN RAISE EXCEPTION 'G49 send ticket without conversation'; END IF;
 tick:=public.mobility_stage_g49_mint_owner_qa(
  p,ps,atms,'CHAT_OPEN','RIDE',sid,NULL);
 IF tick->>'operation'<>'CHAT_OPEN' OR tick->>'qaOnly'<>'true'
 OR tick->>'productionEnabled'<>'false' THEN
  RAISE EXCEPTION 'G49 mint receipt not QA only'; END IF;
 conv:=(public.mobility_stage_g49_open_qa((tick->>'ticket')::uuid)->>'conversationId')::uuid;
 denial:=false;
 BEGIN
  PERFORM public.mobility_stage_g49_open_qa((tick->>'ticket')::uuid);
 EXCEPTION WHEN SQLSTATE 'G4905' THEN denial:=true; END;
 IF NOT denial THEN RAISE EXCEPTION 'G49 one-use open replay succeeded'; END IF;
 denial:=false;
 BEGIN
  PERFORM public.mobility_stage_g49_send_qa((tick->>'ticket')::uuid,key1,'No');
 EXCEPTION WHEN SQLSTATE 'G4902' THEN denial:=true; END;
 IF NOT denial THEN RAISE EXCEPTION 'G49 wrong-purpose ticket accepted'; END IF;
 tick:=public.mobility_stage_g49_mint_owner_qa(
  p,ps,atms,'CHAT_SEND','RIDE',sid,conv);
 receipt:=public.mobility_stage_g49_send_qa((tick->>'ticket')::uuid,key1,'Voy llegando');
 IF receipt->>'serverStored'<>'true' OR receipt->>'senderRole'<>'passenger'
 OR (receipt->>'revision')::bigint<>2 THEN
  RAISE EXCEPTION 'G49 delegated persisted ACK invalid'; END IF;
 denial:=false;
 BEGIN
  PERFORM public.mobility_stage_g49_send_qa(
   (tick->>'ticket')::uuid,key1,'Voy llegando');
 EXCEPTION WHEN SQLSTATE 'G4905' THEN denial:=true; END;
 IF NOT denial THEN RAISE EXCEPTION 'G49 one-use send replay succeeded'; END IF;
 tick:=public.mobility_stage_g49_mint_owner_qa(
  p,ps,atms,'CHAT_HISTORY','RIDE',sid,conv);
 receipt:=public.mobility_stage_g49_history_qa((tick->>'ticket')::uuid,NULL,NULL,100);
 IF jsonb_array_length(receipt->'messages')<>1 OR
 receipt->'messages'->0->>'body'<>'Voy llegando'
 THEN RAISE EXCEPTION 'G49 delegated history wrong'; END IF;
 denial:=false;
 BEGIN
  PERFORM public.mobility_stage_g49_history_qa(
   (tick->>'ticket')::uuid,NULL,NULL,100);
 EXCEPTION WHEN SQLSTATE 'G4905' THEN denial:=true; END;
 IF NOT denial THEN RAISE EXCEPTION 'G49 history double-use'; END IF;
 tick:=public.mobility_stage_g49_mint_owner_qa(
  p,ps,atms,'CHAT_SEND','RIDE',sid,conv);
 UPDATE public.mobility_stage_g50_race_source
  SET driver_id=stranger WHERE id=sid;
 denial:=false;
 BEGIN
  PERFORM public.mobility_stage_g49_send_qa(
   (tick->>'ticket')::uuid,key1,'Voy llegando');
 EXCEPTION WHEN SQLSTATE 'G5003' THEN denial:=true; END;
 IF NOT denial THEN RAISE EXCEPTION 'G49 assignment changed after mint'; END IF;
 UPDATE public.mobility_stage_g50_race_source
  SET driver_id=d,can_send=true WHERE id=sid;
 tick:=public.mobility_stage_g49_mint_owner_qa(
  p,ps,atms,'CHAT_HISTORY','RIDE',sid,conv);
 UPDATE public.mobility_stage_g42_provider_session_grants
  SET revoked_at=clock_timestamp(),revision=revision+1
  WHERE user_id=p AND session_id=ps;
 denial:=false;
 BEGIN
  PERFORM public.mobility_stage_g49_history_qa(
   (tick->>'ticket')::uuid,NULL,NULL,100);
 EXCEPTION WHEN SQLSTATE 'G4901' THEN denial:=true; END;
 IF NOT denial THEN RAISE EXCEPTION 'G49 revoked session after mint'; END IF;
 RAISE NOTICE 'G49 PASS: privilege confinement, one-use purpose, rechecks, stored ACK, expired actor and session';
END $cases$;
ROLLBACK;
