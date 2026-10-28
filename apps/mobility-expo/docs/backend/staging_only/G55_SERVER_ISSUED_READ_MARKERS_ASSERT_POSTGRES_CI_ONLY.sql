-- G55 adversarial PG16 disposable tests; no production data or live RPC.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
 current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g50_race_source') IS NULL
 OR to_regprocedure('public.mobility_stage_g55_mark_viewed_qa(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G55 test requires isolated chain'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
INSERT INTO auth.users(id) VALUES
 ('55550000-0000-4555-8555-000000000001'),
 ('55550000-0000-4555-8555-000000000002'),
 ('55550000-0000-4555-8555-000000000003')
 ON CONFLICT DO NOTHING;
DELETE FROM public.user_roles
 WHERE user_id='55550000-0000-4555-8555-000000000002'
 AND role='passenger'::public.app_role;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('55550000-0000-4555-8555-000000000002','driver'::public.app_role)
 ON CONFLICT DO NOTHING;
INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
 SELECT u.id,('55550000-0000-4555-8555-'||
 lpad((100+row_number() OVER(ORDER BY u.id))::text,12,'0'))::uuid,
 clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 minute',
 clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY'
 FROM auth.users u WHERE u.id IN (
 '55550000-0000-4555-8555-000000000001',
 '55550000-0000-4555-8555-000000000002',
 '55550000-0000-4555-8555-000000000003');
INSERT INTO public.mobility_stage_g50_race_source(id,passenger_id,driver_id,can_send)
 VALUES('55550000-0000-4555-8555-000000000200',
 '55550000-0000-4555-8555-000000000001',
 '55550000-0000-4555-8555-000000000002',true);
DO $arrange$
DECLARE p uuid:='55550000-0000-4555-8555-000000000001';
 d uuid:='55550000-0000-4555-8555-000000000002';
 ps uuid:='55550000-0000-4555-8555-000000000101';
 ds uuid:='55550000-0000-4555-8555-000000000102';
 svc uuid:='55550000-0000-4555-8555-000000000200';
 cid uuid; driver_msg uuid; t jsonb; page jsonb; seq bigint;
 at_ms bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 bad boolean; fn text; user_role text;
BEGIN
 FOREACH user_role IN ARRAY ARRAY['anon','authenticated','service_role',
  'mobility_g48_gateway_ci'] LOOP
  FOREACH fn IN ARRAY ARRAY[
   'public.mobility_stage_g55_history_marker_qa(uuid,bigint,bigint,integer)',
   'public.mobility_stage_g55_mark_viewed_qa(uuid,uuid)'
  ] LOOP
   IF has_function_privilege(user_role,fn,'EXECUTE')
   THEN RAISE EXCEPTION 'G55 public/SDK privilege leaked % %',user_role,fn; END IF;
  END LOOP;
 END LOOP;
 IF has_table_privilege('mobility_g49_chat_gateway_ci',
   'public.mobility_stage_g55_read_markers','SELECT')
 OR NOT has_function_privilege('mobility_g49_chat_gateway_ci',
   'public.mobility_stage_g55_history_marker_qa(uuid,bigint,bigint,integer)','EXECUTE')
 OR NOT has_function_privilege('mobility_g49_chat_gateway_ci',
   'public.mobility_stage_g55_mark_viewed_qa(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'G55 delegated wrong grants'; END IF;
 cid:=(public.mobility_stage_g50_open_owner_qa(
  'RIDE',svc,p,ps,at_ms)->>'conversationId')::uuid;
 driver_msg:=(public.mobility_stage_g50_send_owner_qa(
  cid,d,ds,at_ms,'55550000-0000-4555-8555-000000000401',
  'Estoy junto al porton')->>'messageId')::uuid;
 seq:=(SELECT m.seq FROM public.mobility_stage_g50_chat_messages m
  WHERE m.message_id=driver_msg);
 PERFORM public.mobility_stage_g50_send_owner_qa(
  cid,p,ps,at_ms,'55550000-0000-4555-8555-000000000402','Gracias');
 -- A later passenger message must NOT produce its own read marker.
 t:=public.mobility_stage_g49_mint_owner_qa(
  p,ps,at_ms,'CHAT_HISTORY','RIDE',svc,cid);
 page:=public.mobility_stage_g55_history_marker_qa(
  (t->>'ticket')::uuid,NULL,NULL,100);
 IF jsonb_array_length(page->'page'->'messages')<>2 OR
 page->'page'->'messages'->0->>'senderRole'<>'passenger' OR
 page->'readMarker'->>'messageId'<>driver_msg::text OR
 page->>'qaOnly'<>'true' OR page->>'productionEnabled'<>'false'
 THEN RAISE EXCEPTION 'G55 marker not tied to returned Driver message'; END IF;
 PERFORM set_config('qore.g55.marker',page->'readMarker'->>'marker',true);
 PERFORM set_config('qore.g55.message',driver_msg::text,true);
 PERFORM set_config('qore.g55.conversation',cid::text,true);
 PERFORM set_config('qore.g55.seq',seq::text,true);
 bad:=false;
 BEGIN
  PERFORM public.mobility_stage_g55_history_marker_qa(
   (t->>'ticket')::uuid,NULL,NULL,100);
 EXCEPTION WHEN SQLSTATE 'G4905' THEN bad:=true; END;
 IF NOT bad THEN RAISE EXCEPTION 'G55 reused historical authorization'; END IF;
 bad:=false;
 BEGIN
  PERFORM public.mobility_stage_g55_mark_viewed_qa(
   '55550000-0000-4555-8555-000000009999',(
    page->'readMarker'->>'marker')::uuid);
 EXCEPTION WHEN SQLSTATE 'G5402' THEN bad:=true; END;
 IF NOT bad THEN RAISE EXCEPTION 'G55 marker alone confirmed read'; END IF;
 t:=public.mobility_stage_g54_mint_owner_qa(p,ps,at_ms,'CHAT_READ',cid);
 PERFORM set_config('qore.g55.readticket',t->>'ticket',true);
 RAISE NOTICE 'G55 setup: read proof issued only for returned driver message';
END $arrange$;

SET LOCAL ROLE mobility_g49_chat_gateway_ci;
DO $delegated$
DECLARE output jsonb; cid uuid;
 bad boolean:=false;
BEGIN
 IF current_user<>'mobility_g49_chat_gateway_ci'
 OR pg_catalog.has_table_privilege(current_user,
  'public.mobility_stage_g55_read_markers','SELECT')
 OR pg_catalog.has_function_privilege(current_user,
  'public.mobility_stage_g51_mark_read_owner_qa(uuid,uuid,uuid,bigint,bigint)',
  'EXECUTE')
 THEN RAISE EXCEPTION 'G55 unsafe delegated identity'; END IF;
 cid:=current_setting('qore.g55.conversation')::uuid;
 output:=public.mobility_stage_g55_mark_viewed_qa(
  current_setting('qore.g55.readticket')::uuid,
  current_setting('qore.g55.marker')::uuid);
 IF output->>'conversationId'<>cid::text
 OR output->>'messageId'<>current_setting('qore.g55.message')
 OR (output->>'readThrough')::bigint<>current_setting('qore.g55.seq')::bigint
 OR output->>'readConfirmed'<>'true'
 THEN RAISE EXCEPTION 'G55 delegated marker confirmation invalid'; END IF;
 bad:=false;
 BEGIN
  PERFORM public.mobility_stage_g55_mark_viewed_qa(
   current_setting('qore.g55.readticket')::uuid,
   current_setting('qore.g55.marker')::uuid);
 EXCEPTION WHEN SQLSTATE 'G5405' THEN bad:=true; END;
 IF NOT bad THEN RAISE EXCEPTION 'G55 read ticket replayed'; END IF;
 RAISE NOTICE 'G55 PASS delegated marker->persisted seq and replay denial';
END $delegated$;
RESET ROLE;

DO $final$
DECLARE p uuid:='55550000-0000-4555-8555-000000000001';
 d uuid:='55550000-0000-4555-8555-000000000002';
 outsider uuid:='55550000-0000-4555-8555-000000000003';
 ps uuid:='55550000-0000-4555-8555-000000000101';
 svc uuid:='55550000-0000-4555-8555-000000000200';
 cid uuid:=current_setting('qore.g55.conversation')::uuid;
 at_ms bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 t jsonb; page jsonb; before_rev bigint; deny boolean; marker uuid;
BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_g51_chat_reads
  WHERE actor_id=p AND conversation_id=cid AND
  through_seq=current_setting('qore.g55.seq')::bigint)<>1
 THEN RAISE EXCEPTION 'G55 read seq not persisted'; END IF;
 before_rev:=(SELECT revision FROM public.mobility_stage_g51_inbox_revisions
  WHERE passenger_id=p);
 t:=public.mobility_stage_g49_mint_owner_qa(
  p,ps,at_ms,'CHAT_HISTORY','RIDE',svc,cid);
 page:=public.mobility_stage_g55_history_marker_qa(
  (t->>'ticket')::uuid,NULL,NULL,100);
 marker:=(page->'readMarker'->>'marker')::uuid;
 t:=public.mobility_stage_g54_mint_owner_qa(p,ps,at_ms,'CHAT_READ',cid);
 PERFORM public.mobility_stage_g55_mark_viewed_qa((t->>'ticket')::uuid,marker);
 IF (SELECT revision FROM public.mobility_stage_g51_inbox_revisions WHERE passenger_id=p)
  IS DISTINCT FROM before_rev
 THEN RAISE EXCEPTION 'G55 idempotent read spuriously advanced G51 inbox'; END IF;
 -- A marker minted on the old assignment is immediately useless.
 t:=public.mobility_stage_g49_mint_owner_qa(
  p,ps,at_ms,'CHAT_HISTORY','RIDE',svc,cid);
 page:=public.mobility_stage_g55_history_marker_qa(
  (t->>'ticket')::uuid,NULL,NULL,100);
 marker:=(page->'readMarker'->>'marker')::uuid;
 t:=public.mobility_stage_g54_mint_owner_qa(p,ps,at_ms,'CHAT_READ',cid);
 UPDATE public.mobility_stage_g50_race_source
 SET driver_id=outsider WHERE id=svc;
 deny:=false;
 BEGIN
  PERFORM public.mobility_stage_g55_mark_viewed_qa((t->>'ticket')::uuid,marker);
 EXCEPTION WHEN SQLSTATE 'G5003' THEN deny:=true; END;
 IF NOT deny THEN RAISE EXCEPTION 'G55 stale assignment marked read'; END IF;
 UPDATE public.mobility_stage_g50_race_source SET driver_id=d WHERE id=svc;
 t:=public.mobility_stage_g49_mint_owner_qa(
  p,ps,at_ms,'CHAT_HISTORY','RIDE',svc,cid);
 page:=public.mobility_stage_g55_history_marker_qa(
  (t->>'ticket')::uuid,NULL,NULL,100);
 marker:=(page->'readMarker'->>'marker')::uuid;
 t:=public.mobility_stage_g54_mint_owner_qa(p,ps,at_ms,'CHAT_READ',cid);
 UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=clock_timestamp(),revision=revision+1
 WHERE user_id=p AND session_id=ps;
 deny:=false;
 BEGIN
  PERFORM public.mobility_stage_g55_mark_viewed_qa((t->>'ticket')::uuid,marker);
 EXCEPTION WHEN SQLSTATE 'G5401' THEN deny:=true; END;
 IF NOT deny THEN RAISE EXCEPTION 'G55 revoked session marked read'; END IF;
 RAISE NOTICE 'G55 PASS: no-op revision, assignment and revocation';
END $final$;
ROLLBACK;
