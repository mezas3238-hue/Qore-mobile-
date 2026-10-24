-- G57B / A40 — ordered Passenger-message acknowledgements for DRIVER.
-- All resources disposable PostgreSQL16 QA, NOT a production migration.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g57_mark_visible_ordered_qa(uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g56_history_qa(uuid,bigint,bigint,integer)') IS NULL
 OR to_regprocedure('public.mobility_stage_g51_mark_read_owner_qa(uuid,uuid,uuid,bigint,bigint)') IS NULL
 THEN RAISE EXCEPTION 'G57B requires disposable G57/G56/G52/G51'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g57b_driver_read_tickets(
 ticket_hash bytea PRIMARY KEY CHECK(octet_length(ticket_hash)=32),
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 session_id uuid NOT NULL,
 token_iat_ms bigint NOT NULL CHECK(token_iat_ms>=0),
 conversation_id uuid NOT NULL REFERENCES public.mobility_stage_g50_chat_threads(conversation_id),
 issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 evidence_kind text NOT NULL DEFAULT 'QA_DRIVER_ORDERED_READ_AUTH_ONLY'
 CHECK(evidence_kind='QA_DRIVER_ORDERED_READ_AUTH_ONLY')
);
CREATE INDEX mobility_stage_g57b_ticket_expiry ON public.mobility_stage_g57b_driver_read_tickets(expires_at);
ALTER TABLE public.mobility_stage_g57b_driver_read_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g57b_driver_read_tickets
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci,
 mobility_g49_chat_gateway_ci,mobility_g56_driver_gateway_ci;

CREATE TABLE public.mobility_stage_g57b_driver_markers(
 marker_hash bytea PRIMARY KEY CHECK(octet_length(marker_hash)=32),
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 session_id uuid NOT NULL,
 token_iat_ms bigint NOT NULL CHECK(token_iat_ms>=0),
 conversation_id uuid NOT NULL REFERENCES public.mobility_stage_g50_chat_threads(conversation_id),
 message_id uuid NOT NULL REFERENCES public.mobility_stage_g50_chat_messages(message_id),
 message_seq bigint NOT NULL CHECK(message_seq>0),
 message_revision bigint NOT NULL CHECK(message_revision>=2),
 history_revision bigint NOT NULL CHECK(history_revision>=2),
 issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 evidence_kind text NOT NULL DEFAULT 'QA_G56_DRIVER_PAGE_PASSENGER_MESSAGES_ONLY'
 CHECK(evidence_kind='QA_G56_DRIVER_PAGE_PASSENGER_MESSAGES_ONLY')
);
CREATE INDEX mobility_stage_g57b_marker_expiry ON public.mobility_stage_g57b_driver_markers(expires_at);
ALTER TABLE public.mobility_stage_g57b_driver_markers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g57b_driver_markers
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci,
 mobility_g49_chat_gateway_ci,mobility_g56_driver_gateway_ci;

-- Owner-minted synthetic proof. Driver must remain assigned at mint AND
-- consumption; no role/access claims accepted from the client.
CREATE FUNCTION public.mobility_stage_g57b_mint_read_owner_qa(
 _driver uuid,_session uuid,_iat bigint,_conversation uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE t public.mobility_stage_g50_chat_threads%ROWTYPE;
 src record; token uuid; issued timestamptz; due timestamptz;
BEGIN
 IF _driver IS NULL OR _session IS NULL OR _iat IS NULL OR _conversation IS NULL
 OR NOT public.mobility_stage_g42_lock_session(_driver,_session,_iat)
 THEN RAISE EXCEPTION 'G57B revoked Driver session' USING ERRCODE='G5711'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_driver)<>1 OR
 NOT EXISTS(SELECT 1 FROM public.user_roles
  WHERE user_id=_driver AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'G57B Driver-only read' USING ERRCODE='G5713'; END IF;
 t:=public.mobility_stage_g50_authorize(
  _conversation,_driver,_session,_iat,false);
 IF t.driver_id IS DISTINCT FROM _driver
 THEN RAISE EXCEPTION 'G57B wrong Driver' USING ERRCODE='G5713'; END IF;
 SELECT * INTO src FROM public.mobility_stage_g50_source(t.service_kind,t.service_id);
 IF NOT FOUND OR NOT src.can_send OR
 src.driver_id IS DISTINCT FROM t.driver_id OR
 src.passenger_id IS DISTINCT FROM t.passenger_id
 THEN RAISE EXCEPTION 'G57B stale service assignment' USING ERRCODE='G5714'; END IF;
 token:=pg_catalog.gen_random_uuid();
 issued:=pg_catalog.clock_timestamp();
 due:=issued+interval '20 seconds';
 INSERT INTO public.mobility_stage_g57b_driver_read_tickets(
 ticket_hash,driver_id,session_id,token_iat_ms,conversation_id,issued_at,expires_at)
 VALUES(pg_catalog.sha256(pg_catalog.convert_to(token::text,'UTF8')),
 _driver,_session,_iat,_conversation,issued,due);
 RETURN pg_catalog.jsonb_build_object('ticket',token,
 'operation','DRIVER_MARK_VISIBLE','expiresAtMs',
 floor(extract(epoch FROM due)*1000)::bigint,'qaOnly',true,'productionEnabled',false);
END $fn$;

-- The Driver G56_HISTORY ticket is consumed in SQL and is scoped by real
-- actor/session/assignment. Marker is created ONLY for a Passenger message
-- within the actual G56 Driver history page.
CREATE FUNCTION public.mobility_stage_g57b_driver_history_markers_qa(
 _history_ticket uuid,_revision bigint,_before bigint,_limit integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE cap public.mobility_stage_g56_driver_tickets%ROWTYPE;
 pg jsonb; message jsonb; msg record; marker uuid; issued timestamptz; due timestamptz;
 markers jsonb:='[]'::jsonb;
BEGIN
 IF _history_ticket IS NULL OR _limit IS NULL OR _limit NOT BETWEEN 1 AND 100
 THEN RAISE EXCEPTION 'G57B invalid history page' USING ERRCODE='G5712'; END IF;
 SELECT * INTO cap FROM public.mobility_stage_g56_driver_tickets
 WHERE ticket_hash=pg_catalog.sha256(pg_catalog.convert_to(_history_ticket::text,'UTF8'))
 FOR UPDATE;
 IF NOT FOUND OR cap.operation<>'DRIVER_HISTORY' OR cap.conversation_id IS NULL
 THEN RAISE EXCEPTION 'G57B bad history ticket' USING ERRCODE='G5712'; END IF;
 pg:=public.mobility_stage_g56_history_qa(_history_ticket,_revision,_before,_limit);
 IF pg->>'conversationId' IS DISTINCT FROM cap.conversation_id::text
 OR pg->>'ownerId' IS DISTINCT FROM cap.driver_id::text
 OR pg->>'serviceKind' IS DISTINCT FROM cap.service_kind
 OR pg->>'serviceId' IS DISTINCT FROM cap.service_id::text
 OR pg->>'counterpartRole'<>'passenger'
 OR pg->>'assignmentVerified'<>'true' OR pg->>'state'<>'ACTIVE'
 OR pg->>'canSend'<>'true' OR pg->>'qaOnly'<>'true'
 OR pg->>'productionEnabled'<>'false'
 THEN RAISE EXCEPTION 'G57B untrusted Driver page' USING ERRCODE='G5713'; END IF;
 FOR message IN SELECT value FROM pg_catalog.jsonb_array_elements(pg->'messages') LOOP
  IF message->>'senderRole'='passenger' THEN
   SELECT m.seq,m.sender_id,v.revision INTO msg
   FROM public.mobility_stage_g50_chat_messages m
   JOIN public.mobility_stage_g52_message_versions v
    ON v.message_id=m.message_id AND v.conversation_id=m.conversation_id
   JOIN public.mobility_stage_g50_chat_threads t
    ON t.conversation_id=m.conversation_id
   WHERE m.message_id=(message->>'messageId')::uuid
    AND m.conversation_id=cap.conversation_id
    AND m.sender_id=t.passenger_id AND t.driver_id=cap.driver_id;
   IF NOT FOUND OR msg.revision IS DISTINCT FROM (message->>'revision')::bigint
   OR msg.revision>(pg->>'revision')::bigint
   THEN RAISE EXCEPTION 'G57B forged incoming marker' USING ERRCODE='G5713'; END IF;
   marker:=pg_catalog.gen_random_uuid();
   issued:=pg_catalog.clock_timestamp();
   due:=issued+interval '60 seconds';
   INSERT INTO public.mobility_stage_g57b_driver_markers(
    marker_hash,driver_id,session_id,token_iat_ms,conversation_id,
    message_id,message_seq,message_revision,history_revision,issued_at,expires_at)
   VALUES(pg_catalog.sha256(pg_catalog.convert_to(marker::text,'UTF8')),
    cap.driver_id,cap.session_id,cap.token_iat_ms,cap.conversation_id,
    (message->>'messageId')::uuid,msg.seq,msg.revision,
    (pg->>'revision')::bigint,issued,due);
   markers:=markers||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'marker',marker,'messageId',message->>'messageId',
    'expiresAtMs',floor(extract(epoch FROM due)*1000)::bigint));
  ELSIF message->>'senderRole'<>'driver' THEN
   RAISE EXCEPTION 'G57B unexpected sender in Driver page' USING ERRCODE='G5713';
  END IF;
 END LOOP;
 RETURN pg_catalog.jsonb_build_object('page',pg,'readMarkers',markers,
 'qaOnly',true,'productionEnabled',false);
END $fn$;

CREATE FUNCTION public.mobility_stage_g57b_driver_mark_visible_qa(
 _read_ticket uuid,_marker uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE cap public.mobility_stage_g57b_driver_read_tickets%ROWTYPE;
 proof public.mobility_stage_g57b_driver_markers%ROWTYPE;
 thread public.mobility_stage_g50_chat_threads%ROWTYPE;
 src record; actual record; previous bigint; earliest bigint; stored jsonb;
BEGIN
 IF _read_ticket IS NULL OR _marker IS NULL
 THEN RAISE EXCEPTION 'G57B missing ticket/marker' USING ERRCODE='G5712'; END IF;
 SELECT * INTO cap FROM public.mobility_stage_g57b_driver_read_tickets
 WHERE ticket_hash=pg_catalog.sha256(pg_catalog.convert_to(_read_ticket::text,'UTF8'))
 FOR UPDATE;
 IF NOT FOUND
 THEN RAISE EXCEPTION 'G57B unknown ticket' USING ERRCODE='G5712'; END IF;
 IF cap.consumed_at IS NOT NULL OR cap.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G57B replay or expired ticket' USING ERRCODE='G5715'; END IF;
 IF NOT public.mobility_stage_g42_lock_session(
  cap.driver_id,cap.session_id,cap.token_iat_ms)
 THEN RAISE EXCEPTION 'G57B revoked session' USING ERRCODE='G5711'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=cap.driver_id)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
  WHERE user_id=cap.driver_id AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'G57B lost Driver role' USING ERRCODE='G5713'; END IF;
 thread:=public.mobility_stage_g50_authorize(
  cap.conversation_id,cap.driver_id,cap.session_id,cap.token_iat_ms,false);
 IF thread.driver_id IS DISTINCT FROM cap.driver_id
 THEN RAISE EXCEPTION 'G57B foreign thread' USING ERRCODE='G5713'; END IF;
 SELECT * INTO src FROM public.mobility_stage_g50_source(
   thread.service_kind,thread.service_id);
 IF NOT FOUND OR NOT src.can_send
 OR src.passenger_id IS DISTINCT FROM thread.passenger_id
 OR src.driver_id IS DISTINCT FROM thread.driver_id
 THEN RAISE EXCEPTION 'G57B rotated assignment' USING ERRCODE='G5714'; END IF;
 SELECT * INTO proof FROM public.mobility_stage_g57b_driver_markers
 WHERE marker_hash=pg_catalog.sha256(pg_catalog.convert_to(_marker::text,'UTF8'))
 FOR UPDATE;
 IF NOT FOUND OR proof.driver_id IS DISTINCT FROM cap.driver_id
 OR proof.session_id IS DISTINCT FROM cap.session_id
 OR proof.token_iat_ms IS DISTINCT FROM cap.token_iat_ms
 OR proof.conversation_id IS DISTINCT FROM cap.conversation_id
 THEN RAISE EXCEPTION 'G57B foreign marker' USING ERRCODE='G5713'; END IF;
 IF proof.consumed_at IS NOT NULL OR proof.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G57B replay/expired marker' USING ERRCODE='G5715'; END IF;
 SELECT m.seq,m.sender_id,v.revision INTO actual
 FROM public.mobility_stage_g50_chat_messages m
 JOIN public.mobility_stage_g52_message_versions v
  ON v.message_id=m.message_id AND v.conversation_id=m.conversation_id
 WHERE m.message_id=proof.message_id AND m.conversation_id=thread.conversation_id;
 IF NOT FOUND OR actual.seq IS DISTINCT FROM proof.message_seq
 OR actual.sender_id IS DISTINCT FROM thread.passenger_id
 OR actual.revision IS DISTINCT FROM proof.message_revision
 THEN RAISE EXCEPTION 'G57B unsupported marker message' USING ERRCODE='G5713'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  'g57b/read/'||cap.driver_id::text||'/'||cap.conversation_id::text,0));
 SELECT through_seq INTO previous FROM public.mobility_stage_g51_chat_reads
 WHERE conversation_id=cap.conversation_id AND actor_id=cap.driver_id FOR UPDATE;
 SELECT m.seq INTO earliest FROM public.mobility_stage_g50_chat_messages m
 WHERE m.conversation_id=cap.conversation_id
 AND m.sender_id=thread.passenger_id AND m.seq>COALESCE(previous,0)
 ORDER BY m.seq LIMIT 1;
 IF earliest IS NULL OR earliest>proof.message_seq
 THEN RAISE EXCEPTION 'G57B already read' USING ERRCODE='G5719'; END IF;
 IF earliest<>proof.message_seq
 THEN RAISE EXCEPTION 'G57B skipped earlier Passenger message' USING ERRCODE='G5718'; END IF;
 stored:=public.mobility_stage_g51_mark_read_owner_qa(
  cap.conversation_id,cap.driver_id,cap.session_id,cap.token_iat_ms,
  proof.message_seq);
 IF stored->>'conversationId' IS DISTINCT FROM cap.conversation_id::text
 OR (stored->>'readThrough')::bigint IS DISTINCT FROM proof.message_seq
 THEN RAISE EXCEPTION 'G57B unsafe persisted receipt' USING ERRCODE='G5713'; END IF;
 UPDATE public.mobility_stage_g57b_driver_read_tickets
 SET consumed_at=pg_catalog.clock_timestamp() WHERE ticket_hash=cap.ticket_hash;
 UPDATE public.mobility_stage_g57b_driver_markers
 SET consumed_at=pg_catalog.clock_timestamp() WHERE marker_hash=proof.marker_hash;
 RETURN pg_catalog.jsonb_build_object(
  'conversationId',cap.conversation_id,'messageId',proof.message_id,
  'readConfirmed',true,'qaOnly',true);
END $fn$;

REVOKE ALL ON FUNCTION
 public.mobility_stage_g57b_mint_read_owner_qa(uuid,uuid,bigint,uuid),
 public.mobility_stage_g57b_driver_history_markers_qa(uuid,bigint,bigint,integer),
 public.mobility_stage_g57b_driver_mark_visible_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci,
 mobility_g49_chat_gateway_ci,mobility_g56_driver_gateway_ci;
GRANT EXECUTE ON FUNCTION
 public.mobility_stage_g57b_driver_history_markers_qa(uuid,bigint,bigint,integer),
 public.mobility_stage_g57b_driver_mark_visible_qa(uuid,uuid)
 TO mobility_g56_driver_gateway_ci;
COMMIT;
