-- G52 adversarial QA: 205 messages across three keyset pages; per-thread
-- stable revisions, old-session denial, service switch, foreign actor denial.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g52_thread_versions') IS NULL
 OR to_regclass('public.mobility_stage_g50_race_source') IS NULL
 THEN RAISE EXCEPTION 'G52 isolated chain or fixture missing'; END IF;
 IF has_table_privilege('service_role','public.mobility_stage_g52_message_versions','SELECT')
 OR has_table_privilege('authenticated','public.mobility_stage_g52_thread_versions','INSERT')
 OR has_table_privilege('mobility_g48_gateway_ci','public.mobility_stage_g52_thread_versions','SELECT')
 OR has_function_privilege('service_role',
 'public.mobility_stage_g52_history_owner_qa(uuid,uuid,uuid,bigint,bigint,bigint,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'G52 SQL role leaked'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
INSERT INTO auth.users(id) VALUES
 ('52520000-0000-4252-8252-000000000001'),
 ('52520000-0000-4252-8252-000000000002'),
 ('52520000-0000-4252-8252-000000000003')
ON CONFLICT DO NOTHING;
DELETE FROM public.user_roles
 WHERE user_id='52520000-0000-4252-8252-000000000002' AND role='passenger'::public.app_role;
INSERT INTO public.user_roles(user_id,role)
 VALUES('52520000-0000-4252-8252-000000000002','driver'::public.app_role);
INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
 SELECT u.id,
 ('52520000-0000-4252-8252-'||lpad((100+row_number() OVER(ORDER BY u.id))::text,12,'0'))::uuid,
 clock_timestamp()-interval '1 day',
 clock_timestamp()-interval '1 minute',
 clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY'
 FROM auth.users u WHERE u.id IN(
 '52520000-0000-4252-8252-000000000001',
 '52520000-0000-4252-8252-000000000002',
 '52520000-0000-4252-8252-000000000003');
INSERT INTO public.mobility_stage_g50_race_source VALUES(
 '52520000-0000-4252-8252-000000000200',
 '52520000-0000-4252-8252-000000000001',
 '52520000-0000-4252-8252-000000000002',true);
DO $cases$
DECLARE p uuid:='52520000-0000-4252-8252-000000000001';
 d uuid:='52520000-0000-4252-8252-000000000002';
 outsider uuid:='52520000-0000-4252-8252-000000000003';
 ps uuid:='52520000-0000-4252-8252-000000000101';
 ds uuid:='52520000-0000-4252-8252-000000000102';
 os uuid:='52520000-0000-4252-8252-000000000103';
 sid uuid:='52520000-0000-4252-8252-000000000200';
 at_ms bigint:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
 conv uuid; rec jsonb; page jsonb; rev bigint; pos bigint:=NULL;
 n integer; page_count integer:=0; rows_count integer:=0;
 prev_created bigint:=NULL; seen_ids uuid[];
 denied boolean:=false;
BEGIN
 rec:=public.mobility_stage_g50_open_owner_qa('RIDE',sid,p,ps,at_ms);
 conv:=(rec->>'conversationId')::uuid;
 IF (SELECT revision FROM public.mobility_stage_g52_thread_versions
     WHERE conversation_id=conv)<>1
 THEN RAISE EXCEPTION 'G52 new thread revision wrong'; END IF;
 FOR n IN 1..205 LOOP
  rec:=public.mobility_stage_g50_send_owner_qa(conv,
   CASE WHEN n%2=0 THEN d ELSE p END,
   CASE WHEN n%2=0 THEN ds ELSE ps END,at_ms,
   ('52520000-0000-4252-8252-'||lpad((5000+n)::text,12,'0'))::uuid,
   'Mensaje '||n);
 END LOOP;
 rec:=public.mobility_stage_g50_send_owner_qa(conv,p,ps,at_ms,
  '52520000-0000-4252-8252-000000005205','Mensaje 205');
 IF (SELECT count(*) FROM public.mobility_stage_g50_chat_messages
  WHERE conversation_id=conv)<>205
 OR (SELECT revision FROM public.mobility_stage_g52_thread_versions
  WHERE conversation_id=conv)<>206
 THEN RAISE EXCEPTION 'G52 idempotent replay changed version'; END IF;
 LOOP
  page:=public.mobility_stage_g52_history_owner_qa(
   conv,p,ps,at_ms,rev,pos,100);
  IF rev IS NULL THEN rev:=(page->>'revision')::bigint;
  ELSIF (page->>'revision')::bigint<>rev
  THEN RAISE EXCEPTION 'G52 version changed with static history'; END IF;
  page_count:=page_count+1;
  rows_count:=rows_count+jsonb_array_length(page->'messages');
  IF jsonb_array_length(page->'messages')>100
  THEN RAISE EXCEPTION 'G52 page overflow'; END IF;
  FOR n IN 0..jsonb_array_length(page->'messages')-1 LOOP
   rec:=page->'messages'->n;
   IF rec->>'senderRole' NOT IN('passenger','driver') OR
    (rec->>'revision')::bigint>rev OR
    (rec->>'createdAt')::bigint>floor(extract(epoch from clock_timestamp())*1000)::bigint
   THEN RAISE EXCEPTION 'G52 leaked sender or revision'; END IF;
   IF prev_created IS NOT NULL AND (rec->>'createdAt')::bigint>prev_created
   THEN RAISE EXCEPTION 'G52 timestamp not newest-first'; END IF;
   prev_created:=(rec->>'createdAt')::bigint;
   IF seen_ids @> ARRAY[(rec->>'messageId')::uuid]
   THEN RAISE EXCEPTION 'G52 duplicate message in pages'; END IF;
   seen_ids:=array_append(seen_ids,(rec->>'messageId')::uuid);
  END LOOP;
  EXIT WHEN (page->>'hasMore')::boolean=false;
  IF page->'nextPosition'='null'::jsonb OR
   (page->'nextPosition'->>'beforeSeq')::bigint<1
  THEN RAISE EXCEPTION 'G52 lost keyset position'; END IF;
  pos:=(page->'nextPosition'->>'beforeSeq')::bigint;
  IF page_count>5 THEN RAISE EXCEPTION 'G52 unbounded pagination loop'; END IF;
 END LOOP;
 IF rows_count<>205 OR page_count<>3 OR cardinality(seen_ids)<>205
 THEN RAISE EXCEPTION 'G52 capped history: % messages / % pages',rows_count,page_count; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g52_history_owner_qa(conv,outsider,os,at_ms,NULL,NULL,50);
 EXCEPTION WHEN SQLSTATE 'G5003' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G52 outsider read private messages'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g52_history_owner_qa(conv,d,ds,at_ms,NULL,NULL,50);
 EXCEPTION WHEN SQLSTATE 'G5203' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G52 driver read passenger-only endpoint'; END IF;
 rec:=public.mobility_stage_g50_send_owner_qa(conv,d,ds,at_ms,
  '52520000-0000-4252-8252-000000008000','Nueva actividad');
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g52_history_owner_qa(conv,p,ps,at_ms,rev,pos,100);
 EXCEPTION WHEN SQLSTATE 'G5209' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G52 accepted stale history cursor'; END IF;
 UPDATE public.mobility_stage_g50_race_source SET can_send=false WHERE id=sid;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g52_history_owner_qa(conv,p,ps,at_ms,NULL,NULL,50);
 EXCEPTION WHEN SQLSTATE 'G5204' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G52 terminal service message history exposed'; END IF;
 UPDATE public.mobility_stage_g50_race_source
 SET can_send=true,driver_id=outsider WHERE id=sid;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g52_history_owner_qa(conv,p,ps,at_ms,NULL,NULL,50);
 EXCEPTION WHEN SQLSTATE 'G5003' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G52 old conversation survived reassignment'; END IF;
 UPDATE public.mobility_stage_g50_race_source SET driver_id=d WHERE id=sid;
 UPDATE public.mobility_stage_g42_provider_session_grants SET revoked_at=clock_timestamp()
  WHERE user_id=p AND session_id=ps;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g52_history_owner_qa(conv,p,ps,at_ms,NULL,NULL,50);
 EXCEPTION WHEN SQLSTATE 'G5001' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G52 revoked session read private history'; END IF;
 RAISE NOTICE 'G52 PASS: % messages in % pages, idempotency, version, privacy and revocation',rows_count,page_count;
END $cases$;
ROLLBACK;
