-- G56B A38: Driver inbox pagination, unreadCount, real NOLOGIN role,
-- cross-Driver privacy, stale assignment and monotonic revision. QA ONLY.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain' OR
 current_setting('application_name')<>'qore_ci_disposable_chain' OR
 to_regprocedure('public.mobility_stage_g56_driver_inbox_qa(uuid,bigint,bigint,uuid,integer)') IS NULL
 THEN RAISE EXCEPTION 'G56B test refuses wrong database'; END IF;
END $guard$;
BEGIN;
SET LOCAL statement_timeout='120s';
DO $grants$
DECLARE f text;
BEGIN
 IF (SELECT rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit
  FROM pg_catalog.pg_roles WHERE rolname='mobility_g56_driver_gateway_ci')
  IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'G56B insecure role'; END IF;
 FOREACH f IN ARRAY ARRAY[
  'public.mobility_stage_g56_driver_inbox_qa(uuid,bigint,bigint,uuid,integer)',
  'public.mobility_stage_g56_inbox_mint_owner_qa(uuid,uuid,bigint)'
 ] LOOP
  IF has_function_privilege('anon',f,'EXECUTE') OR
   has_function_privilege('authenticated',f,'EXECUTE') OR
   has_function_privilege('service_role',f,'EXECUTE') OR
   has_function_privilege('mobility_g49_chat_gateway_ci',f,'EXECUTE')
  THEN RAISE EXCEPTION 'G56B leaked routine %',f; END IF;
 END LOOP;
 IF NOT has_function_privilege('mobility_g56_driver_gateway_ci',
  'public.mobility_stage_g56_driver_inbox_qa(uuid,bigint,bigint,uuid,integer)','EXECUTE')
 OR has_function_privilege('mobility_g56_driver_gateway_ci',
  'public.mobility_stage_g56_inbox_mint_owner_qa(uuid,uuid,bigint)','EXECUTE')
 OR has_table_privilege('mobility_g56_driver_gateway_ci',
  'public.mobility_stage_g56_driver_inbox_tickets','SELECT')
 OR has_table_privilege('mobility_g56_driver_gateway_ci',
  'public.mobility_stage_g51_chat_reads','SELECT')
 THEN RAISE EXCEPTION 'G56B delegate has unsafe rights'; END IF;
END $grants$;

INSERT INTO auth.users(id) VALUES
 ('56561200-0000-4656-8656-000000000001'),
 ('56561200-0000-4656-8656-000000000002'),
 ('56561200-0000-4656-8656-000000000003')
ON CONFLICT DO NOTHING;
DELETE FROM public.user_roles
 WHERE user_id IN ('56561200-0000-4656-8656-000000000002',
                   '56561200-0000-4656-8656-000000000003')
 AND role='passenger'::public.app_role;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('56561200-0000-4656-8656-000000000002','driver'::public.app_role),
 ('56561200-0000-4656-8656-000000000003','driver'::public.app_role)
ON CONFLICT DO NOTHING;
INSERT INTO public.mobility_stage_g42_provider_session_grants(
 user_id,session_id,provider_confirmed_at,token_allowed_from,valid_until,evidence_kind)
SELECT u.id,CASE WHEN u.id='56561200-0000-4656-8656-000000000002'
 THEN '56561200-0000-4656-8656-000000000102'::uuid
 ELSE '56561200-0000-4656-8656-000000000103'::uuid END,
 pg_catalog.clock_timestamp()-interval '1 day',
 pg_catalog.clock_timestamp()-interval '1 minute',
 pg_catalog.clock_timestamp()+interval '1 hour',
 'QA_SYNTHETIC_PROVIDER_SESSION_ONLY'
FROM auth.users u WHERE u.id IN(
 '56561200-0000-4656-8656-000000000002',
 '56561200-0000-4656-8656-000000000003');

CREATE TABLE public.mobility_stage_g56b_fixture_source(
 id uuid PRIMARY KEY,passenger_id uuid NOT NULL,driver_id uuid NOT NULL,
 can_send boolean NOT NULL
);
INSERT INTO public.mobility_stage_g56b_fixture_source
 SELECT pg_catalog.gen_random_uuid(),
 '56561200-0000-4656-8656-000000000001'::uuid,
 '56561200-0000-4656-8656-000000000002'::uuid,true
 FROM pg_catalog.generate_series(1,205);
CREATE OR REPLACE FUNCTION public.mobility_stage_g50_source(_kind text,_service uuid)
 RETURNS TABLE(passenger_id uuid,driver_id uuid,can_send boolean)
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fixture$
BEGIN
 IF _kind='RIDE' THEN
  RETURN QUERY SELECT f.passenger_id,f.driver_id,f.can_send
  FROM public.mobility_stage_g56b_fixture_source f
  WHERE f.id=_service FOR SHARE;
 END IF;
END $fixture$;

INSERT INTO public.mobility_stage_g50_chat_threads(
 conversation_id,service_kind,service_id,passenger_id,driver_id)
SELECT pg_catalog.gen_random_uuid(),'RIDE',f.id,f.passenger_id,f.driver_id
FROM public.mobility_stage_g56b_fixture_source f;

-- Two Passenger messages in one thread become Driver unread; no fake send.
INSERT INTO public.mobility_stage_g50_chat_messages(
 conversation_id,sender_id,request_key,body)
SELECT t.conversation_id,t.passenger_id,pg_catalog.gen_random_uuid(),txt.body
 FROM public.mobility_stage_g50_chat_threads t
 CROSS JOIN (VALUES('Hola Driver'),('Estoy esperando')) txt(body)
 WHERE t.service_id=(SELECT min(id) FROM public.mobility_stage_g56b_fixture_source);
DO $baseline$
BEGIN
 IF (SELECT count(*) FROM public.mobility_stage_g50_chat_threads
  WHERE driver_id='56561200-0000-4656-8656-000000000002'
   AND state='ACTIVE')<>205
 THEN RAISE EXCEPTION 'G56B failed to seed unbounded inbox'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.mobility_stage_g56_driver_inbox_revisions
  WHERE driver_id='56561200-0000-4656-8656-000000000002'
  AND revision>=207)
 THEN RAISE EXCEPTION 'G56B unread/insert triggers missed revision'; END IF;
END $baseline$;

-- An unrelated Driver and a Passenger cannot mint a Driver-specific ticket.
DO $denials$
DECLARE got boolean:=false; stamp bigint:=
 floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g56_inbox_mint_owner_qa(
  '56561200-0000-4656-8656-000000000001',
  '56561200-0000-4656-8656-000000000102',stamp);
 EXCEPTION WHEN SQLSTATE 'G5611' OR SQLSTATE 'G5613' THEN got:=true; END;
 IF NOT got THEN RAISE EXCEPTION 'G56B passenger ticket accepted'; END IF;
END $denials$;

SELECT public.mobility_stage_g56_inbox_mint_owner_qa(
 '56561200-0000-4656-8656-000000000002',
 '56561200-0000-4656-8656-000000000102',
 floor(extract(epoch FROM clock_timestamp())*1000)::bigint)->>'ticket' AS one_ticket \gset
SET LOCAL ROLE mobility_g56_driver_gateway_ci;
SELECT public.mobility_stage_g56_driver_inbox_qa(
 :'one_ticket'::uuid,NULL,NULL,NULL,100) AS page_one \gset
RESET ROLE;
SELECT pg_catalog.set_config('qore.g56b_one', :'page_one',false);
SELECT pg_catalog.set_config('qore.g56b_ticket', :'one_ticket',false);
DO $first$
DECLARE p jsonb:=pg_catalog.current_setting('qore.g56b_one')::jsonb;
BEGIN
 IF pg_catalog.jsonb_array_length(p->'items')<>100
 OR p->>'hasMore'<>'true' OR p->'nextPosition'='null'::jsonb
 OR p->>'ownerId'<>'56561200-0000-4656-8656-000000000002'
 OR p->>'productionEnabled'<>'false'
 OR p->>'qaOnly'<>'true'
 OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p->'items') i
  WHERE i->>'counterpartRole'<>'passenger'
   OR i->>'assignmentVerified'<>'true'
   OR i->>'state'<>'ACTIVE'
   OR i ? 'body' OR i ? 'phone')
 THEN RAISE EXCEPTION 'G56B first page malformed or PII leak'; END IF;
END $first$;
DO $replay$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g56_driver_inbox_qa(
   pg_catalog.current_setting('qore.g56b_ticket')::uuid,NULL,NULL,NULL,100);
 EXCEPTION WHEN SQLSTATE 'G5615' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G56B reused one-use ticket'; END IF;
END $replay$;

SELECT public.mobility_stage_g56_inbox_mint_owner_qa(
 '56561200-0000-4656-8656-000000000002',
 '56561200-0000-4656-8656-000000000102',
 floor(extract(epoch FROM clock_timestamp())*1000)::bigint)->>'ticket' AS two_ticket \gset
SET LOCAL ROLE mobility_g56_driver_gateway_ci;
SELECT public.mobility_stage_g56_driver_inbox_qa(
 :'two_ticket'::uuid,
 (pg_catalog.current_setting('qore.g56b_one')::jsonb->>'revision')::bigint,
 (pg_catalog.current_setting('qore.g56b_one')::jsonb->'nextPosition'->>'updatedAt')::bigint,
 (pg_catalog.current_setting('qore.g56b_one')::jsonb->'nextPosition'->>'conversationId')::uuid,100)
 AS page_two \gset
RESET ROLE;
SELECT pg_catalog.set_config('qore.g56b_two', :'page_two',false);

SELECT public.mobility_stage_g56_inbox_mint_owner_qa(
 '56561200-0000-4656-8656-000000000002',
 '56561200-0000-4656-8656-000000000102',
 floor(extract(epoch FROM clock_timestamp())*1000)::bigint)->>'ticket' AS three_ticket \gset
SET LOCAL ROLE mobility_g56_driver_gateway_ci;
SELECT public.mobility_stage_g56_driver_inbox_qa(
 :'three_ticket'::uuid,
 (pg_catalog.current_setting('qore.g56b_two')::jsonb->>'revision')::bigint,
 (pg_catalog.current_setting('qore.g56b_two')::jsonb->'nextPosition'->>'updatedAt')::bigint,
 (pg_catalog.current_setting('qore.g56b_two')::jsonb->'nextPosition'->>'conversationId')::uuid,100)
 AS page_three \gset
RESET ROLE;
SELECT pg_catalog.set_config('qore.g56b_three', :'page_three',false);

DO $paging$
DECLARE a jsonb:=pg_catalog.current_setting('qore.g56b_one')::jsonb;
 b jsonb:=pg_catalog.current_setting('qore.g56b_two')::jsonb;
 c jsonb:=pg_catalog.current_setting('qore.g56b_three')::jsonb;
 count_unique integer;
BEGIN
 IF pg_catalog.jsonb_array_length(b->'items')<>100 OR b->>'hasMore'<>'true'
 OR pg_catalog.jsonb_array_length(c->'items')<>5 OR c->>'hasMore'<>'false'
 OR c->'nextPosition'<>'null'::jsonb
 THEN RAISE EXCEPTION 'G56B pagination lost records'; END IF;
 SELECT count(DISTINCT x->>'conversationId') INTO count_unique
 FROM pg_catalog.jsonb_array_elements(
  (a->'items')||(b->'items')||(c->'items')) x;
 IF count_unique<>205 THEN RAISE EXCEPTION 'G56B duplicate/missing page records'; END IF;
 IF (SELECT sum((x->>'unreadCount')::bigint)
  FROM pg_catalog.jsonb_array_elements(
  (a->'items')||(b->'items')||(c->'items')) x)<>2
 THEN RAISE EXCEPTION 'G56B unread count is not passenger-only'; END IF;
END $paging$;

-- A foreign Driver's inbox must be empty, even if it knows a valid UUID.
SELECT public.mobility_stage_g56_inbox_mint_owner_qa(
 '56561200-0000-4656-8656-000000000003',
 '56561200-0000-4656-8656-000000000103',
 floor(extract(epoch FROM clock_timestamp())*1000)::bigint)->>'ticket' AS foreign_ticket \gset
SET LOCAL ROLE mobility_g56_driver_gateway_ci;
SELECT public.mobility_stage_g56_driver_inbox_qa(
 :'foreign_ticket'::uuid,NULL,NULL,NULL,100) AS foreign_page \gset
RESET ROLE;
DO $foreign$
BEGIN
 IF pg_catalog.jsonb_array_length(
  pg_catalog.current_setting('qore.g56b_foreign')::jsonb->'items')<>0
 THEN RAISE EXCEPTION 'G56B leaked inbox to unrelated Driver'; END IF;
END $foreign$;
-- Source reassignment hides a conversation before OPEN rotates the thread.
UPDATE public.mobility_stage_g56b_fixture_source
 SET driver_id='56561200-0000-4656-8656-000000000003'
 WHERE id=(SELECT min(id) FROM public.mobility_stage_g56b_fixture_source);
SELECT public.mobility_stage_g56_inbox_mint_owner_qa(
 '56561200-0000-4656-8656-000000000002',
 '56561200-0000-4656-8656-000000000102',
 floor(extract(epoch FROM clock_timestamp())*1000)::bigint)->>'ticket' AS shifted_ticket \gset
SET LOCAL ROLE mobility_g56_driver_gateway_ci;
SELECT public.mobility_stage_g56_driver_inbox_qa(
 :'shifted_ticket'::uuid,NULL,NULL,NULL,100) AS shifted_page \gset
RESET ROLE;
SELECT pg_catalog.set_config('qore.g56b_shifted', :'shifted_page',false);
DO $shifted$
DECLARE v jsonb:=pg_catalog.current_setting('qore.g56b_shifted')::jsonb;
BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(v->'items') e
  WHERE e->>'serviceId'=(SELECT min(id)::text FROM public.mobility_stage_g56b_fixture_source))
 THEN RAISE EXCEPTION 'G56B leaked reassigned service'; END IF;
END $shifted$;

-- Appending a message increments the version and invalidates a prior cursor.
INSERT INTO public.mobility_stage_g50_chat_messages(
 conversation_id,sender_id,request_key,body)
SELECT t.conversation_id,t.passenger_id,pg_catalog.gen_random_uuid(),'Mensaje nuevo'
 FROM public.mobility_stage_g50_chat_threads t
 WHERE service_id=(SELECT max(id) FROM public.mobility_stage_g56b_fixture_source);
SELECT public.mobility_stage_g56_inbox_mint_owner_qa(
 '56561200-0000-4656-8656-000000000002',
 '56561200-0000-4656-8656-000000000102',
 floor(extract(epoch FROM clock_timestamp())*1000)::bigint)->>'ticket' AS stale_ticket \gset
SELECT pg_catalog.set_config('qore.g56b_stale_ticket', :'stale_ticket',false);
DO $stale$
DECLARE rejected boolean:=false; prior jsonb:=
 pg_catalog.current_setting('qore.g56b_one')::jsonb;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g56_driver_inbox_qa(
   pg_catalog.current_setting('qore.g56b_stale_ticket')::uuid,(prior->>'revision')::bigint,
   (prior->'nextPosition'->>'updatedAt')::bigint,
   (prior->'nextPosition'->>'conversationId')::uuid,100);
 EXCEPTION WHEN SQLSTATE 'G5619' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G56B accepted cursor after new message'; END IF;
END $stale$;
-- Revoked G42 grant blocks already-issued inbox tickets.
SELECT public.mobility_stage_g56_inbox_mint_owner_qa(
 '56561200-0000-4656-8656-000000000002',
 '56561200-0000-4656-8656-000000000102',
 floor(extract(epoch FROM clock_timestamp())*1000)::bigint)->>'ticket' AS revoked_ticket \gset
UPDATE public.mobility_stage_g42_provider_session_grants
 SET revoked_at=pg_catalog.clock_timestamp(),revision=revision+1
 WHERE user_id='56561200-0000-4656-8656-000000000002'
 AND session_id='56561200-0000-4656-8656-000000000102';
SELECT pg_catalog.set_config('qore.g56b_revoked_ticket', :'revoked_ticket',false);
DO $revocation$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  PERFORM public.mobility_stage_g56_driver_inbox_qa(
   pg_catalog.current_setting('qore.g56b_revoked_ticket')::uuid,NULL,NULL,NULL,100);
 EXCEPTION WHEN SQLSTATE 'G5611' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'G56B revoked session retained inbox'; END IF;
 RAISE NOTICE 'G56B PASS: 205 Driver chats/3 pages, unread, cross-user, stale, reassignment, revocation';
END $revocation$;
ROLLBACK;
