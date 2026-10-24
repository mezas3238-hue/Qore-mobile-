-- G51 / A32: Private chat inbox, unread receipts and monotonic activity.
-- Only PostgreSQL 16 qore_disposable_chain. No remote application or LIVE.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g50_authorize(uuid,uuid,uuid,bigint,boolean)') IS NULL
 THEN RAISE EXCEPTION 'G51 refuses non-disposable / missing G50'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g51_chat_activity(
 event_seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 conversation_id uuid NOT NULL REFERENCES public.mobility_stage_g50_chat_threads(conversation_id),
 happened_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
CREATE INDEX mobility_stage_g51_activity_lookup
 ON public.mobility_stage_g51_chat_activity(conversation_id,event_seq DESC);
CREATE TABLE public.mobility_stage_g51_chat_reads(
 conversation_id uuid NOT NULL REFERENCES public.mobility_stage_g50_chat_threads(conversation_id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 through_seq bigint NOT NULL CHECK(through_seq>=0),
 PRIMARY KEY(conversation_id,actor_id)
);
CREATE TABLE public.mobility_stage_g51_inbox_revisions(
 passenger_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 revision bigint NOT NULL CHECK(revision>=1)
);
ALTER TABLE public.mobility_stage_g51_inbox_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g51_inbox_revisions
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci;
CREATE INDEX mobility_stage_g51_unread_lookup ON
 public.mobility_stage_g50_chat_messages(conversation_id,sender_id,seq);
ALTER TABLE public.mobility_stage_g51_chat_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g51_chat_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g51_chat_activity,
 public.mobility_stage_g51_chat_reads
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci;

-- Trigger only records activity; no updates to G50 thread locks.
CREATE FUNCTION public.mobility_stage_g51_log_activity() RETURNS trigger
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE cid uuid; passenger uuid;
BEGIN
 IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME NOT IN(
  'mobility_stage_g50_chat_messages','mobility_stage_g50_chat_threads',
  'mobility_stage_g51_chat_reads')
 THEN RAISE EXCEPTION 'G51 forged activity source' USING ERRCODE='G5108'; END IF;
 cid:=NEW.conversation_id;
 INSERT INTO public.mobility_stage_g51_chat_activity(conversation_id)
 VALUES(cid);
 SELECT t.passenger_id INTO passenger
 FROM public.mobility_stage_g50_chat_threads t WHERE t.conversation_id=cid;
 IF passenger IS NULL
 THEN RAISE EXCEPTION 'G51 missing thread owner' USING ERRCODE='G5108'; END IF;
 INSERT INTO public.mobility_stage_g51_inbox_revisions(passenger_id,revision)
 VALUES(passenger,1) ON CONFLICT(passenger_id) DO UPDATE
 SET revision=public.mobility_stage_g51_inbox_revisions.revision+1;
 RETURN NEW;
END $fn$;
CREATE TRIGGER g51_thread_activity AFTER INSERT OR UPDATE OF state
 ON public.mobility_stage_g50_chat_threads FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g51_log_activity();
CREATE TRIGGER g51_message_activity AFTER INSERT
 ON public.mobility_stage_g50_chat_messages FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g51_log_activity();
CREATE TRIGGER g51_read_activity AFTER INSERT OR UPDATE OF through_seq
 ON public.mobility_stage_g51_chat_reads FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g51_log_activity();
-- Existing threads from earlier QA migrations gain an activity marker.
INSERT INTO public.mobility_stage_g51_chat_activity(conversation_id)
 SELECT conversation_id FROM public.mobility_stage_g50_chat_threads;
INSERT INTO public.mobility_stage_g51_inbox_revisions(passenger_id,revision)
 SELECT t.passenger_id,GREATEST(count(*)::bigint,1)
 FROM public.mobility_stage_g51_chat_activity a
 JOIN public.mobility_stage_g50_chat_threads t
  ON t.conversation_id=a.conversation_id
 GROUP BY t.passenger_id;

-- Owner-only QA read receipt. A malicious last_seen can never jump past a
-- committed message or force the recipient to mark messages for someone else.
CREATE FUNCTION public.mobility_stage_g51_mark_read_owner_qa(
 _conversation uuid,_actor uuid,_session uuid,_iat bigint,_through bigint
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE t public.mobility_stage_g50_chat_threads%ROWTYPE;
 maximum bigint; receipt bigint;
BEGIN
 IF _through IS NULL OR _through<0
 THEN RAISE EXCEPTION 'G51 invalid read watermark' USING ERRCODE='G5102'; END IF;
 t:=public.mobility_stage_g50_authorize(
  _conversation,_actor,_session,_iat,false);
 SELECT COALESCE(max(seq),0) INTO maximum
 FROM public.mobility_stage_g50_chat_messages WHERE conversation_id=_conversation;
 IF _through>maximum
 THEN RAISE EXCEPTION 'G51 cannot read future messages' USING ERRCODE='G5102'; END IF;
 INSERT INTO public.mobility_stage_g51_chat_reads(conversation_id,actor_id,through_seq)
 VALUES(_conversation,_actor,_through)
 ON CONFLICT(conversation_id,actor_id) DO UPDATE SET
 through_seq=GREATEST(public.mobility_stage_g51_chat_reads.through_seq,EXCLUDED.through_seq)
 RETURNING through_seq INTO receipt;
 RETURN pg_catalog.jsonb_build_object('conversationId',_conversation,
  'readThrough',receipt,'qaOnly',true);
END $fn$;

-- Caller must validate HMAC cursor before passing the keyset boundary.
-- PostgreSQL revalidates identity, G42 locked session, role, service source
-- and revision inside transaction; last page is not a total historical cap.
CREATE FUNCTION public.mobility_stage_g51_passenger_inbox_owner_qa(
 _actor uuid,_session uuid,_iat bigint,_expected_revision bigint DEFAULT NULL,
 _before_ms bigint DEFAULT NULL,_before_id uuid DEFAULT NULL,
 _limit integer DEFAULT 50
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE revision bigint; at_ms bigint;
 payload jsonb; n integer; next_ms bigint; next_id uuid;
BEGIN
 IF _actor IS NULL OR _session IS NULL OR _iat IS NULL OR
 _limit IS NULL OR _limit NOT BETWEEN 1 AND 100
 OR (_before_ms IS NULL)<>(_before_id IS NULL)
 OR (_before_ms IS NOT NULL AND (_before_ms<0 OR _expected_revision IS NULL))
 OR (_expected_revision IS NOT NULL AND _expected_revision<1)
 THEN RAISE EXCEPTION 'G51 invalid inbox pagination' USING ERRCODE='G5102'; END IF;
 IF NOT public.mobility_stage_g42_lock_session(_actor,_session,_iat)
 THEN RAISE EXCEPTION 'G51 session revoked' USING ERRCODE='G5101'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_actor)<>1 OR
 NOT EXISTS(SELECT 1 FROM public.user_roles
   WHERE user_id=_actor AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G51 Passenger-only inbox' USING ERRCODE='G5103'; END IF;
 -- Constant-time per-passenger revision; unrelated users never affect
 -- either this revision or the numeric item DTO (no global event sequence).
 SELECT COALESCE((SELECT r.revision
   FROM public.mobility_stage_g51_inbox_revisions r
   WHERE r.passenger_id=_actor),1) INTO revision;
 IF _expected_revision IS NOT NULL AND _expected_revision<>revision
 THEN RAISE EXCEPTION 'G51 inbox changed since cursor' USING ERRCODE='G5109'; END IF;
 at_ms:=floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint;

 -- Source access is rechecked for EVERY visible row; a prior thread
 -- participant must not see messages after a courier reassignment.
 WITH candidates AS(
  SELECT t.conversation_id,t.service_id,t.service_kind,
   a.event_seq AS activity_seq,
   floor(extract(epoch FROM a.happened_at)*1000)::bigint AS updated_ms,
   COALESCE((
    SELECT count(*)::bigint FROM public.mobility_stage_g50_chat_messages m
    WHERE m.conversation_id=t.conversation_id AND m.sender_id<>_actor
    AND m.seq>COALESCE((
     SELECT rr.through_seq FROM public.mobility_stage_g51_chat_reads rr
     WHERE rr.conversation_id=t.conversation_id AND rr.actor_id=_actor
    ),0)
   ),0) AS unread_count
  FROM public.mobility_stage_g50_chat_threads t
  JOIN LATERAL(
    SELECT event_seq,happened_at FROM public.mobility_stage_g51_chat_activity
    WHERE conversation_id=t.conversation_id
    ORDER BY event_seq DESC LIMIT 1
  ) a ON true
  JOIN LATERAL public.mobility_stage_g50_source(t.service_kind,t.service_id) src
   ON src.passenger_id=t.passenger_id AND src.driver_id=t.driver_id
    AND src.can_send
  WHERE t.passenger_id=_actor AND t.state='ACTIVE'
 ),
 filtered AS (
  SELECT * FROM candidates
  WHERE _before_ms IS NULL OR
   (updated_ms,conversation_id)<(_before_ms,_before_id)
  ORDER BY updated_ms DESC,conversation_id DESC LIMIT _limit+1
 ),
 visible AS (
  SELECT * FROM filtered ORDER BY updated_ms DESC,conversation_id DESC
  LIMIT _limit
 )
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'conversationId',conversation_id,'serviceId',service_id,
   'serviceKind',service_kind,'state','ACTIVE',
   'assignmentVerified',true,'counterpartRole','driver',
   'revision',revision,'unreadCount',unread_count,
   'updatedAt',updated_ms,'canSend',true)
   ORDER BY updated_ms DESC,conversation_id DESC),'[]'::jsonb),
  (SELECT count(*) FROM filtered),
  (SELECT updated_ms FROM visible
   ORDER BY updated_ms ASC,conversation_id ASC LIMIT 1),
  (SELECT conversation_id FROM visible
   ORDER BY updated_ms ASC,conversation_id ASC LIMIT 1)
 INTO payload,n,next_ms,next_id FROM visible;

 RETURN pg_catalog.jsonb_build_object(
  'ownerId',_actor,'generatedAt',at_ms,'expiresAt',at_ms+60000,
  'revision',revision,'items',payload,'hasMore',n>_limit,
  'nextPosition',CASE WHEN n>_limit THEN
     pg_catalog.jsonb_build_object('updatedAt',next_ms,'conversationId',next_id)
    ELSE NULL END,
  'productionEnabled',false,'qaOnly',true);
END $fn$;
REVOKE ALL ON FUNCTION
 public.mobility_stage_g51_log_activity(),
 public.mobility_stage_g51_mark_read_owner_qa(uuid,uuid,uuid,bigint,bigint),
 public.mobility_stage_g51_passenger_inbox_owner_qa(uuid,uuid,bigint,bigint,bigint,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci;
COMMIT;
