-- G57 A39: contiguous Passenger acknowledgements of SERVER-ISSUED message markers.
-- Disposable PostgreSQL16 QA only; NO LIVE, no URL, no service_role RPC.
-- "visible" must be a separate explicit UI action; HTTP GET NEVER marks read.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g49_history_qa(uuid,bigint,bigint,integer)') IS NULL
 OR to_regprocedure('public.mobility_stage_g54_consume_qa(uuid,text)') IS NULL
 OR to_regprocedure('public.mobility_stage_g55_mark_viewed_qa(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G57 requires disposable G49/G50/G51/G52/G54/G55'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g57_visible_markers(
 marker_hash bytea PRIMARY KEY CHECK(octet_length(marker_hash)=32),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
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
 evidence_kind text NOT NULL DEFAULT 'QA_G52_AUTHORIZED_PAGE_PER_DRIVER_MESSAGE'
  CHECK(evidence_kind='QA_G52_AUTHORIZED_PAGE_PER_DRIVER_MESSAGE'),
 CHECK(consumed_at IS NULL OR consumed_at>=issued_at)
);
CREATE INDEX mobility_stage_g57_marker_expiry ON public.mobility_stage_g57_visible_markers(expires_at);
ALTER TABLE public.mobility_stage_g57_visible_markers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g57_visible_markers FROM
 PUBLIC,anon,authenticated,service_role,
 mobility_g48_gateway_ci,mobility_g49_chat_gateway_ci,mobility_g56_driver_gateway_ci;

-- Mint one opaque marker per incoming DRIVER message actually in the
-- independently authorized G52 history page. A newer message in a page
-- MUST NOT automatically mark all older unread incoming messages read.
CREATE FUNCTION public.mobility_stage_g57_history_markers_qa(
 _history_ticket uuid,_expected_revision bigint,_before_seq bigint,_limit integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE cap public.mobility_stage_g49_chat_tickets%ROWTYPE;
 pg jsonb; message jsonb; src record; marker uuid;
 issued timestamptz; due timestamptz; markers jsonb:='[]'::jsonb;
BEGIN
 IF _history_ticket IS NULL OR _limit IS NULL OR _limit NOT BETWEEN 1 AND 100
 THEN RAISE EXCEPTION 'G57 invalid history request' USING ERRCODE='G5702'; END IF;
 SELECT * INTO cap FROM public.mobility_stage_g49_chat_tickets
 WHERE ticket_hash=pg_catalog.sha256(pg_catalog.convert_to(_history_ticket::text,'UTF8'))
 FOR UPDATE;
 IF NOT FOUND OR cap.operation<>'CHAT_HISTORY' OR cap.conversation_id IS NULL
 THEN RAISE EXCEPTION 'G57 invalid history capability' USING ERRCODE='G5702'; END IF;
 -- The delegated G49 execution rechecks G42, Passenger, assignment and G52
 -- thread revision INSIDE the transaction. Never trust actor from mobile.
 pg:=public.mobility_stage_g49_history_qa(
   _history_ticket,_expected_revision,_before_seq,_limit);
 IF pg->>'ownerId' IS DISTINCT FROM cap.actor_id::text
 OR pg->>'conversationId' IS DISTINCT FROM cap.conversation_id::text
 OR pg->>'serviceId' IS DISTINCT FROM cap.service_id::text
 OR pg->>'serviceKind' IS DISTINCT FROM cap.service_kind
 OR pg->>'counterpartRole'<>'driver'
 OR pg->>'assignmentVerified'<>'true'
 OR pg->>'state'<>'ACTIVE'
 OR pg->>'canSend'<>'true'
 OR pg->>'qaOnly'<>'true'
 OR pg->>'productionEnabled'<>'false'
 THEN RAISE EXCEPTION 'G57 untrusted authorized page' USING ERRCODE='G5703'; END IF;
 FOR message IN SELECT value FROM pg_catalog.jsonb_array_elements(pg->'messages') LOOP
  IF message->>'senderRole'='driver' THEN
   SELECT m.seq,m.sender_id,v.revision INTO src
   FROM public.mobility_stage_g50_chat_messages m
   JOIN public.mobility_stage_g52_message_versions v
    ON v.message_id=m.message_id AND v.conversation_id=m.conversation_id
   JOIN public.mobility_stage_g50_chat_threads t
    ON t.conversation_id=m.conversation_id
   WHERE m.conversation_id=cap.conversation_id
    AND m.message_id=(message->>'messageId')::uuid
    AND m.sender_id=t.driver_id AND t.passenger_id=cap.actor_id;
   IF NOT FOUND OR src.revision IS DISTINCT FROM (message->>'revision')::bigint
   OR src.revision>(pg->>'revision')::bigint
   THEN RAISE EXCEPTION 'G57 marker not from authorized message'
    USING ERRCODE='G5703'; END IF;
   marker:=pg_catalog.gen_random_uuid();
   issued:=pg_catalog.clock_timestamp();
   due:=issued+interval '60 seconds';
   INSERT INTO public.mobility_stage_g57_visible_markers(
     marker_hash,actor_id,session_id,token_iat_ms,conversation_id,
     message_id,message_seq,message_revision,history_revision,
     issued_at,expires_at)
   VALUES(pg_catalog.sha256(pg_catalog.convert_to(marker::text,'UTF8')),
     cap.actor_id,cap.session_id,cap.token_iat_ms,cap.conversation_id,
     (message->>'messageId')::uuid,src.seq,src.revision,
     (pg->>'revision')::bigint,issued,due);
   markers:=markers||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
     'marker',marker,'messageId',message->>'messageId',
     'expiresAtMs',floor(extract(epoch FROM due)*1000)::bigint));
  ELSIF message->>'senderRole'<>'passenger' THEN
   RAISE EXCEPTION 'G57 unknown sender role in authorized page' USING ERRCODE='G5703';
  END IF;
 END LOOP;
 RETURN pg_catalog.jsonb_build_object(
  'page',pg,'readMarkers',markers,'qaOnly',true,'productionEnabled',false);
END $fn$;

-- Backend enforces FIRST unread incoming DRIVER message. Even a valid G57
-- marker on a newer message cannot skip over an earlier one. Concurrent
-- confirmations for the same actor/thread serialize BEFORE the watermark.
CREATE FUNCTION public.mobility_stage_g57_mark_visible_ordered_qa(
 _read_ticket uuid,_marker uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE cap public.mobility_stage_g54_chat_receipt_tickets%ROWTYPE;
 proof public.mobility_stage_g57_visible_markers%ROWTYPE;
 thread public.mobility_stage_g50_chat_threads%ROWTYPE;
 actual record; previous bigint; earliest bigint; updated jsonb;
BEGIN
 IF _read_ticket IS NULL OR _marker IS NULL
 THEN RAISE EXCEPTION 'G57 missing ticket/marker' USING ERRCODE='G5702'; END IF;
 cap:=public.mobility_stage_g54_consume_qa(_read_ticket,'CHAT_READ');
 SELECT * INTO proof FROM public.mobility_stage_g57_visible_markers
 WHERE marker_hash=pg_catalog.sha256(pg_catalog.convert_to(_marker::text,'UTF8'))
 FOR UPDATE;
 IF NOT FOUND OR proof.actor_id IS DISTINCT FROM cap.actor_id
 OR proof.session_id IS DISTINCT FROM cap.session_id
 OR proof.token_iat_ms IS DISTINCT FROM cap.token_iat_ms
 OR proof.conversation_id IS DISTINCT FROM cap.conversation_id
 THEN RAISE EXCEPTION 'G57 foreign or mismatched marker' USING ERRCODE='G5703'; END IF;
 IF proof.consumed_at IS NOT NULL OR proof.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G57 consumed/expired marker' USING ERRCODE='G5705'; END IF;
 -- G54 already acquired the actual service source lock and held G42
 -- session grant lock until transaction commit.
 thread:=public.mobility_stage_g50_authorize(
   cap.conversation_id,cap.actor_id,cap.session_id,cap.token_iat_ms,false);
 IF thread.passenger_id IS DISTINCT FROM cap.actor_id
 THEN RAISE EXCEPTION 'G57 not the Passenger viewer' USING ERRCODE='G5703'; END IF;
 SELECT m.seq,m.sender_id,v.revision INTO actual
 FROM public.mobility_stage_g50_chat_messages m
 JOIN public.mobility_stage_g52_message_versions v
  ON v.message_id=m.message_id AND v.conversation_id=m.conversation_id
 WHERE m.message_id=proof.message_id AND m.conversation_id=thread.conversation_id;
 IF NOT FOUND OR actual.seq IS DISTINCT FROM proof.message_seq
 OR actual.sender_id IS DISTINCT FROM thread.driver_id
 OR actual.revision IS DISTINCT FROM proof.message_revision
 THEN RAISE EXCEPTION 'G57 untrusted marker message' USING ERRCODE='G5703'; END IF;
 -- Advisory transaction lock serializes even when there is no reads row.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
   'g57/read/'||cap.actor_id::text||'/'||cap.conversation_id::text,0));
 SELECT rr.through_seq INTO previous FROM public.mobility_stage_g51_chat_reads rr
 WHERE rr.conversation_id=cap.conversation_id AND rr.actor_id=cap.actor_id
 FOR UPDATE;
 SELECT m.seq INTO earliest FROM public.mobility_stage_g50_chat_messages m
 WHERE m.conversation_id=cap.conversation_id
  AND m.sender_id=thread.driver_id AND m.seq>COALESCE(previous,0)
 ORDER BY m.seq LIMIT 1;
 IF earliest IS NULL OR earliest>proof.message_seq
 THEN RAISE EXCEPTION 'G57 already read or wrong marker order' USING ERRCODE='G5709'; END IF;
 IF earliest<>proof.message_seq
 THEN RAISE EXCEPTION 'G57 skipped earlier unread Driver message' USING ERRCODE='G5708'; END IF;
 updated:=public.mobility_stage_g51_mark_read_owner_qa(
  cap.conversation_id,cap.actor_id,cap.session_id,cap.token_iat_ms,
  proof.message_seq);
 IF updated->>'conversationId' IS DISTINCT FROM cap.conversation_id::text
 OR (updated->>'readThrough')::bigint IS DISTINCT FROM proof.message_seq
 THEN RAISE EXCEPTION 'G57 unsafe read receipt' USING ERRCODE='G5703'; END IF;
 UPDATE public.mobility_stage_g57_visible_markers
 SET consumed_at=pg_catalog.clock_timestamp() WHERE marker_hash=proof.marker_hash;
 RETURN pg_catalog.jsonb_build_object(
  'conversationId',cap.conversation_id,'messageId',proof.message_id,
  'readConfirmed',true,'qaOnly',true);
END $fn$;

REVOKE ALL ON FUNCTION
 public.mobility_stage_g57_history_markers_qa(uuid,bigint,bigint,integer),
 public.mobility_stage_g57_mark_visible_ordered_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci,
 mobility_g49_chat_gateway_ci,mobility_g56_driver_gateway_ci;
GRANT EXECUTE ON FUNCTION
 public.mobility_stage_g57_history_markers_qa(uuid,bigint,bigint,integer),
 public.mobility_stage_g57_mark_visible_ordered_qa(uuid,uuid)
 TO mobility_g49_chat_gateway_ci;
-- IMPORTANT: Deprecate the old G55 non-contiguous read-confirmation RPC.
-- All future delegated calls MUST use G57's ordered receipt. Older CI tests
-- execute before this G57 migration in a disposable database only.
REVOKE EXECUTE ON FUNCTION public.mobility_stage_g55_mark_viewed_qa(uuid,uuid)
 FROM mobility_g49_chat_gateway_ci;
COMMIT;
