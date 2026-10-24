-- G54: authenticate capabilities across actual SET LOCAL ROLE, not owner-only
-- wrapper calls. PG16 disposable fixtures only; all new data is rolled back.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g50_race_source') IS NULL
 OR to_regprocedure('public.mobility_stage_g54_inbox_qa(uuid,bigint,bigint,uuid,integer)') IS NULL
 THEN RAISE EXCEPTION 'G54 synthetic PG16 chain unavailable'; END IF;
 IF (SELECT rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit
  FROM pg_catalog.pg_roles WHERE rolname='mobility_g49_chat_gateway_ci')
 IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'G54 gateway has unsafe role flags'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
INSERT INTO auth.users(id) VALUES
 ('54540000-0000-4454-8454-000000000001'),
 ('54540000-0000-4454-8454-000000000002'),
 ('54540000-0000-4454-8454-000000000003')
ON CONFLICT DO NOTHING;
DELETE FROM public.user_roles
 WHERE user_id='54540000-0000-4454-8454-000000000002'
 AND role='passenger'::public.app_role;
INSERT INTO public.user_roles(user_id,role)
 VALUES('54540000-0000-4454-8454-000000000002','driver'::public.app_role)
 ON CONFLICT DO NOTHING;
INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
 SELECT u.id,('54540000-0000-4454-8454-'||
 lpad((100+row_number() OVER(ORDER BY u.id))::text,12,'0'))::uuid,
 clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 minute',
 clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY'
 FROM auth.users u WHERE u.id IN(
 '54540000-0000-4454-8454-000000000001',
 '54540000-0000-4454-8454-000000000002',
 '54540000-0000-4454-8454-000000000003');
INSERT INTO public.mobility_stage_g50_race_source(id,passenger_id,driver_id,can_send)
 VALUES('54540000-0000-4454-8454-000000000200',
 '54540000-0000-4454-8454-000000000001',
 '54540000-0000-4454-8454-000000000002',true);
DO $case$
DECLARE p uuid:='54540000-0000-4454-8454-000000000001';
 d uuid:='54540000-0000-4454-8454-000000000002';
 outsider uuid:='54540000-0000-4454-8454-000000000003';
 ps uuid:='54540000-0000-4454-8454-000000000101';
 ds uuid:='54540000-0000-4454-8454-000000000102';
 os uuid:='54540000-0000-4454-8454-000000000103';
 service uuid:='54540000-0000-4454-8454-000000000200';
 c uuid; inbox jsonb; send jsonb; ticket jsonb;
 nowms bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 deny boolean;
 role_name text; func_name text;
BEGIN
 FOR role_name IN SELECT unnest(ARRAY['anon','authenticated','service_role',
  'mobility_g48_gateway_ci']) LOOP
  FOREACH func_name IN ARRAY ARRAY[
   'public.mobility_stage_g54_inbox_qa(uuid,bigint,bigint,uuid,integer)',
   'public.mobility_stage_g54_mark_read_qa(uuid,bigint)',
   'public.mobility_stage_g54_mint_owner_qa(uuid,uuid,bigint,text,uuid)',
   'public.mobility_stage_g54_consume_qa(uuid,text)'
  ] LOOP
   IF has_function_privilege(role_name,func_name,'EXECUTE')
   THEN RAISE EXCEPTION 'G54 leaked gateway privilege % %',role_name,func_name; END IF;
  END LOOP;
 END LOOP;
 FOREACH func_name IN ARRAY ARRAY[
   'public.mobility_stage_g54_mint_owner_qa(uuid,uuid,bigint,text,uuid)',
   'public.mobility_stage_g54_consume_qa(uuid,text)',
   'public.mobility_stage_g51_passenger_inbox_owner_qa(uuid,uuid,bigint,bigint,bigint,uuid,integer)',
   'public.mobility_stage_g51_mark_read_owner_qa(uuid,uuid,uuid,bigint,bigint)'
 ] LOOP
  IF has_function_privilege('mobility_g49_chat_gateway_ci',func_name,'EXECUTE')
  THEN RAISE EXCEPTION 'G54 delegated owner privilege %',func_name; END IF;
 END LOOP;
 IF NOT has_function_privilege('mobility_g49_chat_gateway_ci',
  'public.mobility_stage_g54_inbox_qa(uuid,bigint,bigint,uuid,integer)','EXECUTE')
 OR NOT has_function_privilege('mobility_g49_chat_gateway_ci',
  'public.mobility_stage_g54_mark_read_qa(uuid,bigint)','EXECUTE')
 OR has_table_privilege('mobility_g49_chat_gateway_ci',
  'public.mobility_stage_g54_chat_receipt_tickets','SELECT')
 OR has_table_privilege('mobility_g49_chat_gateway_ci',
  'public.mobility_stage_g51_chat_reads','SELECT')
 THEN RAISE EXCEPTION 'G54 wrong narrowed gateway grants'; END IF;
 deny:=false;
 BEGIN
  PERFORM public.mobility_stage_g54_mint_owner_qa(d,ds,nowms,'CHAT_INBOX',NULL);
 EXCEPTION WHEN SQLSTATE 'G5403' THEN deny:=true; END;
 IF NOT deny THEN RAISE EXCEPTION 'G54 Driver obtained Passenger inbox'; END IF;
 deny:=false;
 BEGIN
  PERFORM public.mobility_stage_g54_mint_owner_qa(p,ps,nowms,'CHAT_READ',NULL);
 EXCEPTION WHEN SQLSTATE 'G5401' THEN deny:=true; END;
 IF NOT deny THEN RAISE EXCEPTION 'G54 READ without conversation'; END IF;
 c:=(public.mobility_stage_g50_open_owner_qa('RIDE',service,p,ps,nowms)->>'conversationId')::uuid;
 send:=public.mobility_stage_g50_send_owner_qa(c,d,ds,nowms,
  '54540000-0000-4454-8454-000000000888','Entregado en la esquina');
 PERFORM pg_catalog.set_config('qore.g54.conversation',c::text,true);
 PERFORM pg_catalog.set_config('qore.g54.seq',(
  SELECT max(m.seq)::text FROM public.mobility_stage_g50_chat_messages m
   WHERE m.conversation_id=c),true);
 ticket:=public.mobility_stage_g54_mint_owner_qa(p,ps,nowms,'CHAT_INBOX',NULL);
 PERFORM pg_catalog.set_config('qore.g54.inbox',ticket->>'ticket',true);
 ticket:=public.mobility_stage_g54_mint_owner_qa(p,ps,nowms,'CHAT_READ',c);
 PERFORM pg_catalog.set_config('qore.g54.read',ticket->>'ticket',true);
 deny:=false;
 BEGIN
  PERFORM public.mobility_stage_g54_mint_owner_qa(
   outsider,os,nowms,'CHAT_READ',c);
 EXCEPTION WHEN SQLSTATE 'G5003' THEN deny:=true; END;
 IF NOT deny THEN RAISE EXCEPTION 'G54 forged foreign read ticket'; END IF;
END $case$;

-- Exercise both narrow wrappers as the *actual non-login delegated role*.
SET LOCAL ROLE mobility_g49_chat_gateway_ci;
DO $delegate$
DECLARE inbox jsonb; receipt jsonb; c uuid; seq bigint; bad boolean;
BEGIN
 IF current_user<>'mobility_g49_chat_gateway_ci'
 THEN RAISE EXCEPTION 'G54 delegated role was not actually assumed'; END IF;
 c:=pg_catalog.current_setting('qore.g54.conversation')::uuid;
 seq:=pg_catalog.current_setting('qore.g54.seq')::bigint;
 IF pg_catalog.has_function_privilege(current_user,
  'public.mobility_stage_g54_mint_owner_qa(uuid,uuid,bigint,text,uuid)','EXECUTE')
 OR pg_catalog.has_table_privilege(current_user,
  'public.mobility_stage_g54_chat_receipt_tickets','SELECT')
 OR pg_catalog.has_table_privilege(current_user,
  'public.mobility_stage_g50_chat_messages','SELECT')
 THEN RAISE EXCEPTION 'G54 delegated principal can bypass ticket'; END IF;
 inbox:=public.mobility_stage_g54_inbox_qa(
  pg_catalog.current_setting('qore.g54.inbox')::uuid,NULL,NULL,NULL,100);
 IF inbox->>'ownerId'<>'54540000-0000-4454-8454-000000000001'
 OR pg_catalog.jsonb_array_length(inbox->'items')<>1
 OR inbox->'items'->0->>'conversationId'<>c::text
 OR (inbox->'items'->0->>'unreadCount')::bigint<>1
 THEN RAISE EXCEPTION 'G54 role-executed Passenger inbox incorrect'; END IF;
 bad:=false;
 BEGIN
  PERFORM public.mobility_stage_g54_inbox_qa(
   pg_catalog.current_setting('qore.g54.inbox')::uuid,NULL,NULL,NULL,100);
 EXCEPTION WHEN SQLSTATE 'G5405' THEN bad:=true; END;
 IF NOT bad THEN RAISE EXCEPTION 'G54 consumed inbox capability replayed'; END IF;
 bad:=false;
 BEGIN
  PERFORM public.mobility_stage_g54_mark_read_qa(
   pg_catalog.current_setting('qore.g54.read')::uuid,seq+1);
 EXCEPTION WHEN SQLSTATE 'G5102' THEN bad:=true; END;
 IF NOT bad THEN RAISE EXCEPTION 'G54 accepted future watermark'; END IF;
 -- Failed transaction's update to ticket must rollback before next attempt.
 receipt:=public.mobility_stage_g54_mark_read_qa(
  pg_catalog.current_setting('qore.g54.read')::uuid,seq);
 IF receipt->>'conversationId'<>c::text OR
  (receipt->>'readThrough')::bigint<>seq
 THEN RAISE EXCEPTION 'G54 role-executed read receipt missing'; END IF;
 bad:=false;
 BEGIN
  PERFORM public.mobility_stage_g54_mark_read_qa(
   pg_catalog.current_setting('qore.g54.read')::uuid,seq);
 EXCEPTION WHEN SQLSTATE 'G5405' THEN bad:=true; END;
 IF NOT bad THEN RAISE EXCEPTION 'G54 consumed read capability replayed'; END IF;
 RAISE NOTICE 'G54 PASS: NOLOGIN role executed inbox/read, one-use and future seq denied';
END $delegate$;
RESET ROLE;

DO $case$
DECLARE p uuid:='54540000-0000-4454-8454-000000000001';
 d uuid:='54540000-0000-4454-8454-000000000002';
 other uuid:='54540000-0000-4454-8454-000000000003';
 ps uuid:='54540000-0000-4454-8454-000000000101';
 c uuid:=current_setting('qore.g54.conversation')::uuid;
 atms bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 t jsonb; r jsonb; denied boolean;
BEGIN
 t:=public.mobility_stage_g54_mint_owner_qa(p,ps,atms,'CHAT_INBOX',NULL);
 r:=public.mobility_stage_g54_inbox_qa((t->>'ticket')::uuid,NULL,NULL,NULL,100);
 IF (r->'items'->0->>'unreadCount')::integer<>0
 THEN RAISE EXCEPTION 'G54 read receipt failed to suppress unread counter'; END IF;
 t:=public.mobility_stage_g54_mint_owner_qa(p,ps,atms,'CHAT_READ',c);
 UPDATE public.mobility_stage_g50_race_source SET driver_id=other
 WHERE id='54540000-0000-4454-8454-000000000200';
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g54_mark_read_qa((t->>'ticket')::uuid,0);
 EXCEPTION WHEN SQLSTATE 'G5003' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G54 stale assignment after ticket mint'; END IF;
 UPDATE public.mobility_stage_g50_race_source
  SET driver_id=d,can_send=true WHERE id='54540000-0000-4454-8454-000000000200';
 t:=public.mobility_stage_g54_mint_owner_qa(p,ps,atms,'CHAT_INBOX',NULL);
 UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=clock_timestamp(),revision=revision+1
 WHERE user_id=p AND session_id=ps;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g54_inbox_qa((t->>'ticket')::uuid,NULL,NULL,NULL,100);
 EXCEPTION WHEN SQLSTATE 'G5401' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G54 revoked session used inbox'; END IF;
 RAISE NOTICE 'G54 PASS: unread cleared, stale assignment and revocation denied';
END $case$;
ROLLBACK;
