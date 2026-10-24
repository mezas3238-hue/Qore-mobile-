-- G57 A39: real PostgreSQL16 assertions, all inside rolled back local chain.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g57_mark_visible_ordered_qa(uuid,uuid)') IS NULL
 OR to_regclass('public.mobility_stage_g50_race_source') IS NULL
 THEN RAISE EXCEPTION 'G57 requires disposable full schema chain'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
DO $grants$
DECLARE fn text;
BEGIN
 FOREACH fn IN ARRAY ARRAY[
  'public.mobility_stage_g57_history_markers_qa(uuid,bigint,bigint,integer)',
  'public.mobility_stage_g57_mark_visible_ordered_qa(uuid,uuid)'
 ] LOOP
  IF NOT pg_catalog.has_function_privilege('mobility_g49_chat_gateway_ci',fn,'EXECUTE')
  OR pg_catalog.has_function_privilege('anon',fn,'EXECUTE')
  OR pg_catalog.has_function_privilege('authenticated',fn,'EXECUTE')
  OR pg_catalog.has_function_privilege('service_role',fn,'EXECUTE')
  OR pg_catalog.has_function_privilege('mobility_g56_driver_gateway_ci',fn,'EXECUTE')
  THEN RAISE EXCEPTION 'G57 invalid delegated grants %',fn; END IF;
 END LOOP;
 IF pg_catalog.has_function_privilege('mobility_g49_chat_gateway_ci',
  'public.mobility_stage_g55_mark_viewed_qa(uuid,uuid)','EXECUTE')
 OR pg_catalog.has_table_privilege('mobility_g49_chat_gateway_ci',
  'public.mobility_stage_g57_visible_markers','SELECT')
 THEN RAISE EXCEPTION 'G57 legacy G55 skip bypass still exposed'; END IF;
END $grants$;
INSERT INTO auth.users(id) VALUES
 ('57570000-0000-4757-8757-000000000001'),
 ('57570000-0000-4757-8757-000000000002'),
 ('57570000-0000-4757-8757-000000000003')
 ON CONFLICT DO NOTHING;
DELETE FROM public.user_roles WHERE user_id='57570000-0000-4757-8757-000000000002'
 AND role='passenger'::public.app_role;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('57570000-0000-4757-8757-000000000002','driver'::public.app_role)
 ON CONFLICT DO NOTHING;
INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
VALUES
 ('57570000-0000-4757-8757-000000000001',
  '57570000-0000-4757-8757-000000000101',
  clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 minute',
  clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY'),
 ('57570000-0000-4757-8757-000000000002',
  '57570000-0000-4757-8757-000000000102',
  clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 minute',
  clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY'),
 ('57570000-0000-4757-8757-000000000001',
  '57570000-0000-4757-8757-000000000103',
  clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 minute',
  clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY');
INSERT INTO public.mobility_stage_g50_race_source(
 id,passenger_id,driver_id,can_send)
VALUES('57570000-0000-4757-8757-000000000200',
 '57570000-0000-4757-8757-000000000001',
 '57570000-0000-4757-8757-000000000002',true);
DO $arrange$
DECLARE p uuid:='57570000-0000-4757-8757-000000000001';
 d uuid:='57570000-0000-4757-8757-000000000002';
 ps uuid:='57570000-0000-4757-8757-000000000101';
 ds uuid:='57570000-0000-4757-8757-000000000102';
 svc uuid:='57570000-0000-4757-8757-000000000200';
 cid uuid; m1 uuid; m2 uuid; page jsonb; t jsonb;
 at_ms bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
BEGIN
 cid:=(public.mobility_stage_g50_open_owner_qa('RIDE',svc,p,ps,at_ms)->>'conversationId')::uuid;
 m1:=(public.mobility_stage_g50_send_owner_qa(
  cid,d,ds,at_ms,'57570000-0000-4757-8757-000000000401','Primero entrante')->>'messageId')::uuid;
 PERFORM public.mobility_stage_g50_send_owner_qa(
  cid,p,ps,at_ms,'57570000-0000-4757-8757-000000000402','Mi respuesta');
 m2:=(public.mobility_stage_g50_send_owner_qa(
  cid,d,ds,at_ms,'57570000-0000-4757-8757-000000000403','Segundo entrante')->>'messageId')::uuid;
 t:=public.mobility_stage_g49_mint_owner_qa(
  p,ps,at_ms,'CHAT_HISTORY','RIDE',svc,cid);
 PERFORM pg_catalog.set_config('qore.g57.historyticket',t->>'ticket',true);
 PERFORM pg_catalog.set_config('qore.g57.conversation',cid::text,true);
 PERFORM pg_catalog.set_config('qore.g57.first',m1::text,true);
 PERFORM pg_catalog.set_config('qore.g57.second',m2::text,true);
END $arrange$;
SET LOCAL ROLE mobility_g49_chat_gateway_ci;
SELECT public.mobility_stage_g57_history_markers_qa(
 pg_catalog.current_setting('qore.g57.historyticket')::uuid,
 NULL,NULL,100) AS initial_history \gset
RESET ROLE;
SELECT pg_catalog.set_config('qore.g57.page', :'initial_history',true);
DO $markers$
DECLARE envelope jsonb:=pg_catalog.current_setting('qore.g57.page')::jsonb;
 m jsonb; oldest uuid; newest uuid;
BEGIN
 IF pg_catalog.jsonb_array_length(envelope->'page'->'messages')<>3
 OR pg_catalog.jsonb_array_length(envelope->'readMarkers')<>2
 OR envelope->>'productionEnabled'<>'false'
 OR envelope->>'qaOnly'<>'true'
 OR envelope->'page'->'messages'->0->>'senderRole'<>'driver'
 THEN RAISE EXCEPTION 'G57 missing per-message page-bound markers'; END IF;
 SELECT (x->>'marker')::uuid INTO oldest
 FROM pg_catalog.jsonb_array_elements(envelope->'readMarkers') AS x
 WHERE x->>'messageId'=pg_catalog.current_setting('qore.g57.first');
 SELECT (x->>'marker')::uuid INTO newest
 FROM pg_catalog.jsonb_array_elements(envelope->'readMarkers') AS x
 WHERE x->>'messageId'=pg_catalog.current_setting('qore.g57.second');
 IF oldest IS NULL OR newest IS NULL OR oldest=newest
 THEN RAISE EXCEPTION 'G57 failed to mint two distinct inbound markers'; END IF;
 PERFORM pg_catalog.set_config('qore.g57.oldest',oldest::text,true);
 PERFORM pg_catalog.set_config('qore.g57.newest',newest::text,true);
 IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(envelope->'readMarkers') x
  WHERE x->>'messageId' NOT IN(
   pg_catalog.current_setting('qore.g57.first'),
   pg_catalog.current_setting('qore.g57.second')))
 THEN RAISE EXCEPTION 'G57 minted marker for outgoing Passenger message'; END IF;
END $markers$;
-- Valid marker and a real read ticket for second Driver message MUST NOT
-- skip the earlier unread Driver message, even though it was in the same page.
DO $skip$
DECLARE p uuid:='57570000-0000-4757-8757-000000000001';
 ps uuid:='57570000-0000-4757-8757-000000000101';
 cid uuid:=pg_catalog.current_setting('qore.g57.conversation')::uuid;
 at_ms bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 t jsonb; denied boolean:=false;
BEGIN
 t:=public.mobility_stage_g54_mint_owner_qa(p,ps,at_ms,'CHAT_READ',cid);
 PERFORM pg_catalog.set_config('qore.g57.skip',t->>'ticket',true);
END $skip$;
SET LOCAL ROLE mobility_g49_chat_gateway_ci;
DO $skip_delegate$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g57_mark_visible_ordered_qa(
   pg_catalog.current_setting('qore.g57.skip')::uuid,
   pg_catalog.current_setting('qore.g57.newest')::uuid);
 EXCEPTION WHEN SQLSTATE 'G5708' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G57 later visible message skipped unread earlier'; END IF;
END $skip_delegate$;
RESET ROLE;
DO $checkpoint$
BEGIN
 IF EXISTS(SELECT 1 FROM public.mobility_stage_g51_chat_reads
  WHERE actor_id='57570000-0000-4757-8757-000000000001'
   AND conversation_id=pg_catalog.current_setting('qore.g57.conversation')::uuid)
 THEN RAISE EXCEPTION 'G57 denied skip advanced watermark'; END IF;
END $checkpoint$;
-- Mint separate fresh CHAT_READ scopes. Each marker can be consumed only once.
DO $mint_receipts$
DECLARE p uuid:='57570000-0000-4757-8757-000000000001';
 ps uuid:='57570000-0000-4757-8757-000000000101';
 cid uuid:=pg_catalog.current_setting('qore.g57.conversation')::uuid;
 at_ms bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 t jsonb;
BEGIN
 t:=public.mobility_stage_g54_mint_owner_qa(p,ps,at_ms,'CHAT_READ',cid);
 PERFORM pg_catalog.set_config('qore.g57.ticket1',t->>'ticket',true);
 t:=public.mobility_stage_g54_mint_owner_qa(p,ps,at_ms,'CHAT_READ',cid);
 PERFORM pg_catalog.set_config('qore.g57.ticket2',t->>'ticket',true);
END $mint_receipts$;
SET LOCAL ROLE mobility_g49_chat_gateway_ci;
SELECT public.mobility_stage_g57_mark_visible_ordered_qa(
 pg_catalog.current_setting('qore.g57.ticket1')::uuid,
 pg_catalog.current_setting('qore.g57.oldest')::uuid) AS read_first \gset
SELECT public.mobility_stage_g57_mark_visible_ordered_qa(
 pg_catalog.current_setting('qore.g57.ticket2')::uuid,
 pg_catalog.current_setting('qore.g57.newest')::uuid) AS read_second \gset
RESET ROLE;
SELECT pg_catalog.set_config('qore.g57.read_first', :'read_first',true);
SELECT pg_catalog.set_config('qore.g57.read_second', :'read_second',true);
DO $verify$
DECLARE a jsonb:=pg_catalog.current_setting('qore.g57.read_first')::jsonb;
 b jsonb:=pg_catalog.current_setting('qore.g57.read_second')::jsonb;
 read_seq bigint; expected_seq bigint;
BEGIN
 IF a->>'messageId' IS DISTINCT FROM pg_catalog.current_setting('qore.g57.first')
 OR b->>'messageId' IS DISTINCT FROM pg_catalog.current_setting('qore.g57.second')
 OR a->>'readConfirmed'<>'true' OR b->>'readConfirmed'<>'true'
 OR a ? 'readThrough' OR b ? 'readThrough'
 THEN RAISE EXCEPTION 'G57 leaked raw read position or wrong ACK'; END IF;
 SELECT through_seq INTO read_seq FROM public.mobility_stage_g51_chat_reads
 WHERE conversation_id=pg_catalog.current_setting('qore.g57.conversation')::uuid
 AND actor_id='57570000-0000-4757-8757-000000000001';
 SELECT seq INTO expected_seq FROM public.mobility_stage_g50_chat_messages
 WHERE message_id=pg_catalog.current_setting('qore.g57.second')::uuid;
 IF read_seq IS DISTINCT FROM expected_seq
 THEN RAISE EXCEPTION 'G57 did not commit ordered visible watermark'; END IF;
END $verify$;
DO $stale$
DECLARE p uuid:='57570000-0000-4757-8757-000000000001';
 ps uuid:='57570000-0000-4757-8757-000000000101';
 cid uuid:=pg_catalog.current_setting('qore.g57.conversation')::uuid;
 at_ms bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 t jsonb; denied boolean:=false;
BEGIN
 t:=public.mobility_stage_g54_mint_owner_qa(p,ps,at_ms,'CHAT_READ',cid);
 BEGIN
  PERFORM public.mobility_stage_g57_mark_visible_ordered_qa(
   (t->>'ticket')::uuid,pg_catalog.current_setting('qore.g57.oldest')::uuid);
 EXCEPTION WHEN SQLSTATE 'G5705' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G57 marker replay accepted'; END IF;
 -- A NEW marker for a previously read message still must not advance.
 t:=public.mobility_stage_g49_mint_owner_qa(p,ps,at_ms,'CHAT_HISTORY','RIDE',
  '57570000-0000-4757-8757-000000000200',cid);
 PERFORM pg_catalog.set_config('qore.g57.next_history',t->>'ticket',true);
END $stale$;
SET LOCAL ROLE mobility_g49_chat_gateway_ci;
SELECT public.mobility_stage_g57_history_markers_qa(
 pg_catalog.current_setting('qore.g57.next_history')::uuid,
 NULL,NULL,100) AS second_history \gset
RESET ROLE;
SELECT pg_catalog.set_config('qore.g57.page2', :'second_history',true);
DO $stale2$
DECLARE p uuid:='57570000-0000-4757-8757-000000000001';
 ps uuid:='57570000-0000-4757-8757-000000000101';
 cid uuid:=pg_catalog.current_setting('qore.g57.conversation')::uuid;
 at_ms bigint:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 old uuid; t jsonb; denied boolean:=false;
BEGIN
 SELECT (x->>'marker')::uuid INTO old
 FROM pg_catalog.jsonb_array_elements(
 pg_catalog.current_setting('qore.g57.page2')::jsonb->'readMarkers') x
 WHERE x->>'messageId'=pg_catalog.current_setting('qore.g57.first');
 IF old IS NULL THEN RAISE EXCEPTION 'G57 missing refreshed marker'; END IF;
 t:=public.mobility_stage_g54_mint_owner_qa(p,ps,at_ms,'CHAT_READ',cid);
 BEGIN
  PERFORM public.mobility_stage_g57_mark_visible_ordered_qa(
   (t->>'ticket')::uuid,old);
 EXCEPTION WHEN SQLSTATE 'G5709' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G57 accepted already-read message'; END IF;
 RAISE NOTICE 'G57 PASS: two incoming messages ordered, own message ignored, legacy bypass blocked, replay and stale denial';
END $stale2$;
ROLLBACK;
