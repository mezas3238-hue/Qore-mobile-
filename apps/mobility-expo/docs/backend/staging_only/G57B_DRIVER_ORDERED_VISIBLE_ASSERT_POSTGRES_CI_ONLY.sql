-- G57B: verify only current assigned Driver can mark Passenger messages,
-- one-by-one in sequence, using two separate delegated capabilities. QA ONLY.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g57b_driver_mark_visible_qa(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G57B requires disposable G57B chain'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
DO $rights$
DECLARE f text;
BEGIN
 FOREACH f IN ARRAY ARRAY[
  'public.mobility_stage_g57b_driver_history_markers_qa(uuid,bigint,bigint,integer)',
  'public.mobility_stage_g57b_driver_mark_visible_qa(uuid,uuid)'
 ] LOOP
  IF NOT has_function_privilege('mobility_g56_driver_gateway_ci',f,'EXECUTE')
   OR has_function_privilege('anon',f,'EXECUTE')
   OR has_function_privilege('authenticated',f,'EXECUTE')
   OR has_function_privilege('service_role',f,'EXECUTE')
   OR has_function_privilege('mobility_g49_chat_gateway_ci',f,'EXECUTE')
  THEN RAISE EXCEPTION 'G57B leaked Driver-only routine %',f; END IF;
 END LOOP;
 IF has_function_privilege('mobility_g56_driver_gateway_ci',
  'public.mobility_stage_g57b_mint_read_owner_qa(uuid,uuid,bigint,uuid)','EXECUTE')
 OR has_table_privilege('mobility_g56_driver_gateway_ci',
  'public.mobility_stage_g57b_driver_read_tickets','SELECT')
 OR has_table_privilege('mobility_g56_driver_gateway_ci',
  'public.mobility_stage_g57b_driver_markers','SELECT')
 THEN RAISE EXCEPTION 'G57B unsafe delegated privileges'; END IF;
END $rights$;
INSERT INTO auth.users(id) VALUES
 ('57572000-0000-4757-8757-000000000001'),
 ('57572000-0000-4757-8757-000000000002'),
 ('57572000-0000-4757-8757-000000000003')
 ON CONFLICT DO NOTHING;
DELETE FROM public.user_roles WHERE user_id IN(
 '57572000-0000-4757-8757-000000000002',
 '57572000-0000-4757-8757-000000000003')
 AND role='passenger'::public.app_role;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('57572000-0000-4757-8757-000000000002','driver'::public.app_role),
 ('57572000-0000-4757-8757-000000000003','driver'::public.app_role)
 ON CONFLICT DO NOTHING;
INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
VALUES
 ('57572000-0000-4757-8757-000000000001','57572000-0000-4757-8757-000000000101',
  clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 minute',
  clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY'),
 ('57572000-0000-4757-8757-000000000002','57572000-0000-4757-8757-000000000102',
  clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 minute',
  clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY'),
 ('57572000-0000-4757-8757-000000000003','57572000-0000-4757-8757-000000000103',
  clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 minute',
  clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY');
INSERT INTO public.mobility_stage_g50_race_source(id,passenger_id,driver_id,can_send)
 VALUES('57572000-0000-4757-8757-000000000200',
 '57572000-0000-4757-8757-000000000001',
 '57572000-0000-4757-8757-000000000002',true);
DO $arrange$
DECLARE p uuid:='57572000-0000-4757-8757-000000000001';
 d uuid:='57572000-0000-4757-8757-000000000002';
 ps uuid:='57572000-0000-4757-8757-000000000101';
 ds uuid:='57572000-0000-4757-8757-000000000102';
 svc uuid:='57572000-0000-4757-8757-000000000200';
 cid uuid; m1 uuid; m2 uuid; t jsonb;
 at_ms bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 denied boolean:=false;
BEGIN
 cid:=(public.mobility_stage_g50_open_owner_qa(
  'RIDE',svc,d,ds,at_ms)->>'conversationId')::uuid;
 m1:=(public.mobility_stage_g50_send_owner_qa(
  cid,p,ps,at_ms,'57572000-0000-4757-8757-000000000401','Primer mensaje cliente')->>'messageId')::uuid;
 PERFORM public.mobility_stage_g50_send_owner_qa(
  cid,d,ds,at_ms,'57572000-0000-4757-8757-000000000402','Estoy llegando');
 m2:=(public.mobility_stage_g50_send_owner_qa(
  cid,p,ps,at_ms,'57572000-0000-4757-8757-000000000403','Segundo mensaje cliente')->>'messageId')::uuid;
 PERFORM pg_catalog.set_config('qore.g57b.iat',at_ms::text,true);
 PERFORM pg_catalog.set_config('qore.g57b.conversation',cid::text,true);
 PERFORM pg_catalog.set_config('qore.g57b.first',m1::text,true);
 PERFORM pg_catalog.set_config('qore.g57b.second',m2::text,true);
 t:=public.mobility_stage_g56_mint_owner_qa(
  d,ds,at_ms,'DRIVER_HISTORY','RIDE',svc,cid);
 PERFORM pg_catalog.set_config('qore.g57b.history_ticket',t->>'ticket',true);
 -- Unassigned Driver cannot mint a G57B read scope.
 BEGIN
  PERFORM public.mobility_stage_g57b_mint_read_owner_qa(
   '57572000-0000-4757-8757-000000000003',
   '57572000-0000-4757-8757-000000000103',at_ms,cid);
 EXCEPTION WHEN SQLSTATE 'G5003' OR SQLSTATE 'G5713' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G57B foreign Driver minted read ticket'; END IF;
END $arrange$;
SET LOCAL ROLE mobility_g56_driver_gateway_ci;
SELECT public.mobility_stage_g57b_driver_history_markers_qa(
 pg_catalog.current_setting('qore.g57b.history_ticket')::uuid,
 NULL,NULL,100) AS envelope \gset
RESET ROLE;
SELECT pg_catalog.set_config('qore.g57b.page', :'envelope',true);
DO $markers$
DECLARE b jsonb:=pg_catalog.current_setting('qore.g57b.page')::jsonb;
 m1 uuid; m2 uuid;
BEGIN
 IF pg_catalog.jsonb_array_length(b->'page'->'messages')<>3
 OR pg_catalog.jsonb_array_length(b->'readMarkers')<>2
 OR b->>'productionEnabled'<>'false'
 OR b->'page'->>'counterpartRole'<>'passenger'
 THEN RAISE EXCEPTION 'G57B driver history marker layout incorrect'; END IF;
 SELECT (x->>'marker')::uuid INTO m1
 FROM pg_catalog.jsonb_array_elements(b->'readMarkers') AS x
 WHERE x->>'messageId'=pg_catalog.current_setting('qore.g57b.first');
 SELECT (x->>'marker')::uuid INTO m2
 FROM pg_catalog.jsonb_array_elements(b->'readMarkers') AS x
 WHERE x->>'messageId'=pg_catalog.current_setting('qore.g57b.second');
 IF m1 IS NULL OR m2 IS NULL OR m1=m2
 THEN RAISE EXCEPTION 'G57B failed to issue incoming Passenger markers'; END IF;
 PERFORM pg_catalog.set_config('qore.g57b.marker1',m1::text,true);
 PERFORM pg_catalog.set_config('qore.g57b.marker2',m2::text,true);
END $markers$;
DO $mint$
DECLARE d uuid:='57572000-0000-4757-8757-000000000002';
 ds uuid:='57572000-0000-4757-8757-000000000102';
 cid uuid:=pg_catalog.current_setting('qore.g57b.conversation')::uuid;
 iat bigint:=pg_catalog.current_setting('qore.g57b.iat')::bigint;
 t jsonb;
BEGIN
 t:=public.mobility_stage_g57b_mint_read_owner_qa(d,ds,iat,cid);
 PERFORM pg_catalog.set_config('qore.g57b.read_skip',t->>'ticket',true);
 t:=public.mobility_stage_g57b_mint_read_owner_qa(d,ds,iat,cid);
 PERFORM pg_catalog.set_config('qore.g57b.read1',t->>'ticket',true);
 t:=public.mobility_stage_g57b_mint_read_owner_qa(d,ds,iat,cid);
 PERFORM pg_catalog.set_config('qore.g57b.read2',t->>'ticket',true);
END $mint$;
SET LOCAL ROLE mobility_g56_driver_gateway_ci;
DO $skip$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g57b_driver_mark_visible_qa(
   pg_catalog.current_setting('qore.g57b.read_skip')::uuid,
   pg_catalog.current_setting('qore.g57b.marker2')::uuid);
 EXCEPTION WHEN SQLSTATE 'G5718' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G57B Driver skipped first unread Passenger message'; END IF;
END $skip$;
SELECT public.mobility_stage_g57b_driver_mark_visible_qa(
 pg_catalog.current_setting('qore.g57b.read1')::uuid,
 pg_catalog.current_setting('qore.g57b.marker1')::uuid) AS ack1 \gset
SELECT public.mobility_stage_g57b_driver_mark_visible_qa(
 pg_catalog.current_setting('qore.g57b.read2')::uuid,
 pg_catalog.current_setting('qore.g57b.marker2')::uuid) AS ack2 \gset
RESET ROLE;
SELECT pg_catalog.set_config('qore.g57b.ack1', :'ack1',true);
SELECT pg_catalog.set_config('qore.g57b.ack2', :'ack2',true);
DO $confirmed$
DECLARE a jsonb:=pg_catalog.current_setting('qore.g57b.ack1')::jsonb;
 b jsonb:=pg_catalog.current_setting('qore.g57b.ack2')::jsonb;
 actual bigint; expected bigint;
BEGIN
 IF a->>'messageId'<>pg_catalog.current_setting('qore.g57b.first')
 OR b->>'messageId'<>pg_catalog.current_setting('qore.g57b.second')
 OR a->>'readConfirmed'<>'true'
 OR b->>'readConfirmed'<>'true'
 OR a ? 'readThrough' OR b ? 'readThrough'
 THEN RAISE EXCEPTION 'G57B invalid ordered Driver ACK'; END IF;
 SELECT through_seq INTO actual FROM public.mobility_stage_g51_chat_reads
 WHERE actor_id='57572000-0000-4757-8757-000000000002'
 AND conversation_id=pg_catalog.current_setting('qore.g57b.conversation')::uuid;
 SELECT seq INTO expected FROM public.mobility_stage_g50_chat_messages
 WHERE message_id=pg_catalog.current_setting('qore.g57b.second')::uuid;
 IF actual IS DISTINCT FROM expected
 THEN RAISE EXCEPTION 'G57B failed to persist final watermark'; END IF;
END $confirmed$;
-- Already consumed marker can't be confirmed again. Rotated assignment
-- blocks a different valid marker even if the previous session is alive.
DO $final$
DECLARE d uuid:='57572000-0000-4757-8757-000000000002';
 ds uuid:='57572000-0000-4757-8757-000000000102';
 cid uuid:=pg_catalog.current_setting('qore.g57b.conversation')::uuid;
 iat bigint:=pg_catalog.current_setting('qore.g57b.iat')::bigint;
 t jsonb; denied boolean:=false; newcap jsonb;
BEGIN
 t:=public.mobility_stage_g57b_mint_read_owner_qa(d,ds,iat,cid);
 BEGIN
  PERFORM public.mobility_stage_g57b_driver_mark_visible_qa(
   (t->>'ticket')::uuid,pg_catalog.current_setting('qore.g57b.marker1')::uuid);
 EXCEPTION WHEN SQLSTATE 'G5715' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G57B replayed used marker'; END IF;
 -- Mint valid new evidence for second message and reassign its service.
 t:=public.mobility_stage_g56_mint_owner_qa(d,ds,iat,'DRIVER_HISTORY',
  'RIDE','57572000-0000-4757-8757-000000000200',cid);
 newcap:=public.mobility_stage_g57b_driver_history_markers_qa(
  (t->>'ticket')::uuid,NULL,NULL,100);
 t:=public.mobility_stage_g57b_mint_read_owner_qa(d,ds,iat,cid);
 UPDATE public.mobility_stage_g50_race_source
 SET driver_id='57572000-0000-4757-8757-000000000003'
 WHERE id='57572000-0000-4757-8757-000000000200';
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g57b_driver_mark_visible_qa(
   (t->>'ticket')::uuid,
   (newcap->'readMarkers'->0->>'marker')::uuid);
 EXCEPTION WHEN SQLSTATE 'G5003' OR SQLSTATE 'G5714' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G57B stale Driver still confirmed read'; END IF;
 RAISE NOTICE 'G57B PASS: two Passenger messages ordered, own Driver message ignored, crossed Driver and replay denied';
END $final$;
ROLLBACK;
