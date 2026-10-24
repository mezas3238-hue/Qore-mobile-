-- G51 QA asserts 205 private conversations, 3 keyset pages, unread and revocation.
-- Must execute after G50 two-session race fixture on isolated disposable DB only.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_g51_chat_activity') IS NULL
 OR to_regclass('public.mobility_stage_g50_race_source') IS NULL
 THEN RAISE EXCEPTION 'G51 requires disposable chain and G50 race fixture'; END IF;
 IF has_table_privilege('service_role','public.mobility_stage_g51_chat_reads','INSERT')
 OR has_table_privilege('authenticated','public.mobility_stage_g51_chat_activity','SELECT')
 OR has_table_privilege('mobility_g48_gateway_ci','public.mobility_stage_g51_chat_reads','SELECT')
 OR has_function_privilege('service_role',
 'public.mobility_stage_g51_passenger_inbox_owner_qa(uuid,uuid,bigint,bigint,bigint,uuid,integer)','EXECUTE')
 OR has_function_privilege('authenticated',
 'public.mobility_stage_g51_mark_read_owner_qa(uuid,uuid,uuid,bigint,bigint)','EXECUTE')
 THEN RAISE EXCEPTION 'G51 browser/service grants leaked'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
INSERT INTO auth.users(id) VALUES
 ('51510000-0000-4151-8151-000000000001'),
 ('51510000-0000-4151-8151-000000000002')
ON CONFLICT DO NOTHING;
DELETE FROM public.user_roles
 WHERE user_id='51510000-0000-4151-8151-000000000002'
 AND role='passenger'::public.app_role;
INSERT INTO public.user_roles(user_id,role)
 VALUES('51510000-0000-4151-8151-000000000002','driver'::public.app_role);
INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind
) VALUES
 ('51510000-0000-4151-8151-000000000001',
  '51510000-0000-4151-8151-000000000101',
  clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 minute',
  clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY'),
 ('51510000-0000-4151-8151-000000000002',
  '51510000-0000-4151-8151-000000000102',
  clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 minute',
  clock_timestamp()+interval '1 hour','QA_SYNTHETIC_PROVIDER_SESSION_ONLY');
-- G50 QA fixture supplies a synthetic read-only assignment with FOR SHARE.
INSERT INTO public.mobility_stage_g50_race_source(id,passenger_id,driver_id,can_send)
 SELECT ('51510000-0000-4151-8151-'||lpad((1000+n)::text,12,'0'))::uuid,
 '51510000-0000-4151-8151-000000000001',
 '51510000-0000-4151-8151-000000000002',true
 FROM generate_series(1,205) n;
DO $cases$
DECLARE owner_id uuid:='51510000-0000-4151-8151-000000000001';
 driver uuid:='51510000-0000-4151-8151-000000000002';
 owner_session uuid:='51510000-0000-4151-8151-000000000101';
 driver_session uuid:='51510000-0000-4151-8151-000000000102';
 at_ms bigint:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
 service uuid; conversation uuid; first_conversation uuid; seq bigint;
 r jsonb; pg jsonb; rev bigint; after_ms bigint:=null; after_id uuid:=null;
 n integer; total integer:=0; page_count integer:=0;
 rec record; denied boolean:=false; first_item jsonb;
BEGIN
 FOR n IN 1..205 LOOP
  service:=('51510000-0000-4151-8151-'||lpad((1000+n)::text,12,'0'))::uuid;
  r:=public.mobility_stage_g50_open_owner_qa('RIDE',service,owner_id,owner_session,at_ms);
  conversation:=(r->>'conversationId')::uuid;
  IF n=1 THEN first_conversation:=conversation; END IF;
  IF n IN(1,2,3) THEN
   r:=public.mobility_stage_g50_send_owner_qa(
    conversation,driver,driver_session,at_ms,
    ('51510000-0000-4151-8151-'||lpad((5000+n)::text,12,'0'))::uuid,
    'Mensaje de prueba');
   IF n=1 THEN seq:=(r->>'seq')::bigint; END IF;
  END IF;
 END LOOP;
 r:=public.mobility_stage_g51_mark_read_owner_qa(
  first_conversation,owner_id,owner_session,at_ms,seq);
 IF (r->>'readThrough')::bigint<>seq
 THEN RAISE EXCEPTION 'G51 watermark receipt wrong'; END IF;
 -- Repeating older watermark never regresses unread position.
 r:=public.mobility_stage_g51_mark_read_owner_qa(
  first_conversation,owner_id,owner_session,at_ms,0);
 IF (r->>'readThrough')::bigint<>seq
 THEN RAISE EXCEPTION 'G51 read watermark rolled back'; END IF;
 BEGIN
  PERFORM public.mobility_stage_g51_mark_read_owner_qa(
   first_conversation,owner_id,owner_session,at_ms,9223372036854775807);
 EXCEPTION WHEN SQLSTATE 'G5102' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G51 allowed marking future messages'; END IF;
 CREATE TEMP TABLE g51_seen(id uuid PRIMARY KEY) ON COMMIT DROP;
 LOOP
  pg:=public.mobility_stage_g51_passenger_inbox_owner_qa(
   owner_id,owner_session,at_ms,rev,after_ms,after_id,100);
  IF rev IS NULL THEN rev:=(pg->>'revision')::bigint;
  ELSIF (pg->>'revision')::bigint<>rev
  THEN RAISE EXCEPTION 'G51 page revision changed without activity'; END IF;
  page_count:=page_count+1;
  total:=total+jsonb_array_length(pg->'items');
  FOR rec IN SELECT * FROM jsonb_array_elements(pg->'items') LOOP
   IF (rec.value->>'assignmentVerified')::boolean IS DISTINCT FROM true
   OR rec.value->>'counterpartRole'<>'driver'
   OR (rec.value->>'unreadCount')::bigint<0
   THEN RAISE EXCEPTION 'G51 invalid private inbox row'; END IF;
   INSERT INTO g51_seen(id) VALUES((rec.value->>'conversationId')::uuid);
  END LOOP;
  EXIT WHEN (pg->>'hasMore')::boolean=false;
  IF pg->'nextPosition' IS NULL OR pg->'nextPosition'='null'::jsonb
  THEN RAISE EXCEPTION 'G51 lost keyset despite hasMore'; END IF;
  after_ms:=(pg->'nextPosition'->>'updatedAt')::bigint;
  after_id:=(pg->'nextPosition'->>'conversationId')::uuid;
  IF page_count>5 THEN RAISE EXCEPTION 'G51 infinite pagination'; END IF;
 END LOOP;
 IF total<>205 OR page_count<>3 OR
  (SELECT count(*) FROM g51_seen)<>205
 THEN RAISE EXCEPTION 'G51 total capped or duplicated: % rows % pages',total,page_count; END IF;
 -- A different Driver is never an inbox Passenger.
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g51_passenger_inbox_owner_qa(
   driver,driver_session,at_ms,NULL,NULL,NULL,10);
 EXCEPTION WHEN SQLSTATE 'G5103' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G51 Driver read passenger inbox'; END IF;
 -- A new message invalidates the entire old signed snapshot revision.
 r:=public.mobility_stage_g50_send_owner_qa(
  first_conversation,driver,driver_session,at_ms,
  '51510000-0000-4151-8151-000000005999'::uuid,'Nueva revision');
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g51_passenger_inbox_owner_qa(
   owner_id,owner_session,at_ms,rev,after_ms,after_id,100);
 EXCEPTION WHEN SQLSTATE 'G5109' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G51 accepted stale keyset revision'; END IF;
 -- A courier assignment that no longer matches must disappear from inbox.
 UPDATE public.mobility_stage_g50_race_source
 SET driver_id=owner_id WHERE id='51510000-0000-4151-8151-000000001001';
 r:=public.mobility_stage_g51_passenger_inbox_owner_qa(
  owner_id,owner_session,at_ms,NULL,NULL,NULL,100);
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(r->'items') x
   WHERE x->>'conversationId'=first_conversation::text)
 THEN RAISE EXCEPTION 'G51 leaked stale assignment'; END IF;
 UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=clock_timestamp() WHERE user_id=owner_id AND session_id=owner_session;
 denied:=false;
 BEGIN
  PERFORM public.mobility_stage_g51_passenger_inbox_owner_qa(
   owner_id,owner_session,at_ms,NULL,NULL,NULL,20);
 EXCEPTION WHEN SQLSTATE 'G5101' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'G51 revoked session read inbox'; END IF;
 RAISE NOTICE 'G51 PASS: % conversations in % pages, monotonic cursor, read receipt and revocation',total,page_count;
END $cases$;
ROLLBACK;
