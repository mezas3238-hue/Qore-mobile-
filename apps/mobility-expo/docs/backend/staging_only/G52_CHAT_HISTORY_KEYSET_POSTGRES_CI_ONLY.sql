-- QORE Mobile G52 / A33: private chat message history, revisioned keyset.
-- PostgreSQL 16 disposable QA only. Never deploy or expose owner-only RPC.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g51_passenger_inbox_owner_qa(uuid,uuid,bigint,bigint,bigint,uuid,integer)') IS NULL
 OR to_regprocedure('public.mobility_stage_g50_authorize(uuid,uuid,uuid,bigint,boolean)') IS NULL
 THEN RAISE EXCEPTION 'G52 requires disposable G50/G51 chain'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g52_thread_versions(
 conversation_id uuid PRIMARY KEY REFERENCES public.mobility_stage_g50_chat_threads(conversation_id),
 revision bigint NOT NULL CHECK(revision>=1)
);
CREATE TABLE public.mobility_stage_g52_message_versions(
 message_id uuid PRIMARY KEY REFERENCES public.mobility_stage_g50_chat_messages(message_id),
 conversation_id uuid NOT NULL REFERENCES public.mobility_stage_g50_chat_threads(conversation_id),
 revision bigint NOT NULL CHECK(revision>=2),
 UNIQUE(conversation_id,revision)
);
CREATE INDEX mobility_stage_g52_msg_history ON
 public.mobility_stage_g50_chat_messages(conversation_id,seq DESC);
ALTER TABLE public.mobility_stage_g52_thread_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g52_message_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g52_thread_versions,
 public.mobility_stage_g52_message_versions
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci;
-- Existing legacy rows get stable per-thread revisions, not global seq.
INSERT INTO public.mobility_stage_g52_thread_versions(conversation_id,revision)
 SELECT t.conversation_id,1+count(m.message_id)
 FROM public.mobility_stage_g50_chat_threads t
 LEFT JOIN public.mobility_stage_g50_chat_messages m ON m.conversation_id=t.conversation_id
 GROUP BY t.conversation_id;
INSERT INTO public.mobility_stage_g52_message_versions(message_id,conversation_id,revision)
 SELECT message_id,conversation_id,
  1+row_number() OVER(PARTITION BY conversation_id ORDER BY seq)
 FROM public.mobility_stage_g50_chat_messages;

CREATE FUNCTION public.mobility_stage_g52_bump_on_thread() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 INSERT INTO public.mobility_stage_g52_thread_versions(conversation_id,revision)
 VALUES(NEW.conversation_id,1) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $fn$;
CREATE TRIGGER g52_thread_initialize AFTER INSERT
 ON public.mobility_stage_g50_chat_threads FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g52_bump_on_thread();

CREATE FUNCTION public.mobility_stage_g52_bump_on_message() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE new_revision bigint;
BEGIN
 INSERT INTO public.mobility_stage_g52_thread_versions(conversation_id,revision)
 VALUES(NEW.conversation_id,2)
 ON CONFLICT(conversation_id) DO UPDATE SET
 revision=public.mobility_stage_g52_thread_versions.revision+1
 RETURNING revision INTO new_revision;
 INSERT INTO public.mobility_stage_g52_message_versions(message_id,conversation_id,revision)
 VALUES(NEW.message_id,NEW.conversation_id,new_revision);
 RETURN NEW;
END $fn$;
CREATE TRIGGER g52_message_version AFTER INSERT
 ON public.mobility_stage_g50_chat_messages FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g52_bump_on_message();

CREATE FUNCTION public.mobility_stage_g52_history_owner_qa(
 _conversation uuid,_actor uuid,_session uuid,_iat bigint,
 _expected_revision bigint DEFAULT NULL,_before_seq bigint DEFAULT NULL,
 _limit integer DEFAULT 50
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path=''
AS $fn$
DECLARE t public.mobility_stage_g50_chat_threads%ROWTYPE;
 src record; revision bigint; at_ms bigint; payload jsonb;
 count_rows integer; last_seq bigint;
BEGIN
 IF _conversation IS NULL OR _actor IS NULL OR _session IS NULL OR _iat IS NULL
 OR _limit IS NULL OR _limit NOT BETWEEN 1 AND 100
 OR (_expected_revision IS NULL)<>(_before_seq IS NULL)
 OR (_expected_revision IS NOT NULL AND _expected_revision<1)
 OR (_before_seq IS NOT NULL AND _before_seq<1)
 THEN RAISE EXCEPTION 'G52 invalid history cursor' USING ERRCODE='G5202'; END IF;
 t:=public.mobility_stage_g50_authorize(
  _conversation,_actor,_session,_iat,false);
 IF _actor<>t.passenger_id
 THEN RAISE EXCEPTION 'G52 passenger-only history' USING ERRCODE='G5203'; END IF;
 -- The G50 participant check reads the current source with a row lock.
 -- Read-only terminal services are excluded because B expects canSend:true.
 SELECT * INTO src FROM public.mobility_stage_g50_source(t.service_kind,t.service_id);
 IF NOT FOUND OR src.passenger_id IS DISTINCT FROM t.passenger_id
 OR src.driver_id IS DISTINCT FROM t.driver_id OR NOT src.can_send
 THEN RAISE EXCEPTION 'G52 stale or terminal assignment' USING ERRCODE='G5204'; END IF;
 -- Hold this version row SHARE until SQL transaction commits. The
 -- message trigger UPDATE blocks concurrently, preventing read page races.
 SELECT v.revision INTO revision
 FROM public.mobility_stage_g52_thread_versions v
 WHERE v.conversation_id=_conversation FOR SHARE;
 IF revision IS NULL
 THEN RAISE EXCEPTION 'G52 unversioned thread' USING ERRCODE='G5205'; END IF;
 IF _expected_revision IS NOT NULL AND revision<>_expected_revision
 THEN RAISE EXCEPTION 'G52 history changed since cursor' USING ERRCODE='G5209'; END IF;
 at_ms:=floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint;
 WITH eligible AS(
  SELECT m.seq,m.message_id,m.body,m.created_at,v.revision AS message_revision,
   CASE WHEN m.sender_id=t.passenger_id THEN 'passenger'
    WHEN m.sender_id=t.driver_id THEN 'driver'
    ELSE NULL END AS sender_role
  FROM public.mobility_stage_g50_chat_messages m
  JOIN public.mobility_stage_g52_message_versions v ON v.message_id=m.message_id
   AND v.conversation_id=m.conversation_id
  WHERE m.conversation_id=_conversation
   AND (_before_seq IS NULL OR m.seq<_before_seq)
  ORDER BY m.seq DESC LIMIT _limit+1
 ), visible AS(
  SELECT * FROM eligible ORDER BY seq DESC LIMIT _limit
 )
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'messageId',message_id,'senderRole',sender_role,
    'body',body,'createdAt',
     floor(extract(epoch FROM created_at)*1000)::bigint,
    'revision',message_revision
   ) ORDER BY seq DESC),'[]'::jsonb),
  (SELECT count(*) FROM eligible),
  (SELECT min(seq) FROM visible)
 INTO payload,count_rows,last_seq FROM visible;
 RETURN pg_catalog.jsonb_build_object(
  'conversationId',t.conversation_id,'serviceId',t.service_id,
  'serviceKind',t.service_kind,'ownerId',_actor,
  'counterpartRole','driver','assignmentVerified',true,'state','ACTIVE',
  'revision',revision,'generatedAt',at_ms,'expiresAt',at_ms+60000,
  'messages',payload,'hasMore',count_rows>_limit,
  'nextPosition',CASE WHEN count_rows>_limit
   THEN pg_catalog.jsonb_build_object('beforeSeq',last_seq)
   ELSE NULL END,
  'canSend',true,'productionEnabled',false,'qaOnly',true);
END $fn$;
REVOKE ALL ON FUNCTION
 public.mobility_stage_g52_bump_on_thread(),
 public.mobility_stage_g52_bump_on_message(),
 public.mobility_stage_g52_history_owner_qa(uuid,uuid,uuid,bigint,bigint,bigint,integer)
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci;
COMMIT;
