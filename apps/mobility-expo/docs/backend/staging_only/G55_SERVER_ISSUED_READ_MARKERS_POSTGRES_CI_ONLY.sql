-- G55 A37 — read marker is minted ONLY after authorized G52 history page.
-- PostgreSQL 16 disposable QA: no LIVE Auth, no HTTP, no arbitrary seq from mobile.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g49_history_qa(uuid,bigint,bigint,integer)') IS NULL
 OR to_regprocedure('public.mobility_stage_g54_consume_qa(uuid,text)') IS NULL
 OR to_regprocedure('public.mobility_stage_g51_mark_read_owner_qa(uuid,uuid,uuid,bigint,bigint)') IS NULL
 THEN RAISE EXCEPTION 'G55 requires disposable G42/G49/G50/G51/G52/G54';
 END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g55_read_markers (
 marker_hash bytea PRIMARY KEY CHECK(octet_length(marker_hash)=32),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 session_id uuid NOT NULL,
 token_iat_ms bigint NOT NULL CHECK(token_iat_ms BETWEEN 0 AND 9999999999999),
 conversation_id uuid NOT NULL REFERENCES public.mobility_stage_g50_chat_threads(conversation_id),
 message_id uuid NOT NULL REFERENCES public.mobility_stage_g50_chat_messages(message_id),
 message_seq bigint NOT NULL CHECK(message_seq>0),
 history_revision bigint NOT NULL CHECK(history_revision>=2),
 issued_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 evidence_kind text NOT NULL DEFAULT 'QA_AUTHORIZED_G52_HISTORY_ONLY'
 CHECK(evidence_kind='QA_AUTHORIZED_G52_HISTORY_ONLY'),
 CHECK(consumed_at IS NULL OR consumed_at>=issued_at)
);
CREATE INDEX mobility_stage_g55_markers_expire
 ON public.mobility_stage_g55_read_markers(expires_at);
ALTER TABLE public.mobility_stage_g55_read_markers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g55_read_markers
 FROM PUBLIC,anon,authenticated,service_role,
 mobility_g48_gateway_ci,mobility_g49_chat_gateway_ci;

-- One G49 CHAT_HISTORY ticket produces *exact* G52 SQL page and an OPTIONAL
-- short-lived opaque marker for the newest DRIVER message in that page.
-- G52's strict Cliente B DTO is unchanged; a future transport will separate
-- the page from its read marker, and enable it only after actual UI visibility.
CREATE FUNCTION public.mobility_stage_g55_history_marker_qa(
 _history_ticket uuid,_expected_revision bigint,_before_seq bigint,_limit integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE proof public.mobility_stage_g49_chat_tickets%ROWTYPE;
 page jsonb; candidate uuid; item_revision bigint; message_row record;
 marker uuid; issued timestamptz; expires timestamptz;
 marker_dto jsonb:='null'::jsonb;
BEGIN
 IF _history_ticket IS NULL OR _limit IS NULL OR _limit NOT BETWEEN 1 AND 100
 THEN RAISE EXCEPTION 'G55 invalid history marker page' USING ERRCODE='G5502'; END IF;
 SELECT * INTO proof FROM public.mobility_stage_g49_chat_tickets
 WHERE ticket_hash=pg_catalog.sha256(pg_catalog.convert_to(_history_ticket::text,'UTF8'))
 FOR UPDATE;
 IF NOT FOUND OR proof.operation<>'CHAT_HISTORY' OR proof.conversation_id IS NULL
 THEN RAISE EXCEPTION 'G55 not a chat history capability' USING ERRCODE='G5502'; END IF;
 -- Consumes G49 ticket and checks live G42+Passenger+assignment in same TX.
 page:=public.mobility_stage_g49_history_qa(
   _history_ticket,_expected_revision,_before_seq,_limit);
 IF page->>'conversationId' IS DISTINCT FROM proof.conversation_id::text
 OR page->>'ownerId' IS DISTINCT FROM proof.actor_id::text
 OR page->>'serviceId' IS DISTINCT FROM proof.service_id::text
 OR page->>'serviceKind' IS DISTINCT FROM proof.service_kind
 OR page->>'qaOnly'<>'true'
 THEN RAISE EXCEPTION 'G55 untrusted source history' USING ERRCODE='G5503'; END IF;
 SELECT (e.body->>'messageId')::uuid,
    (e.body->>'revision')::bigint
 INTO candidate,item_revision
 FROM pg_catalog.jsonb_array_elements(page->'messages')
  WITH ORDINALITY AS e(body,ord)
 WHERE e.body->>'senderRole'='driver'
 ORDER BY e.ord LIMIT 1;
 IF candidate IS NOT NULL THEN
  SELECT m.seq,m.sender_id,v.revision INTO message_row
  FROM public.mobility_stage_g50_chat_messages m
  JOIN public.mobility_stage_g52_message_versions v
   ON v.message_id=m.message_id AND v.conversation_id=m.conversation_id
  JOIN public.mobility_stage_g50_chat_threads t
   ON t.conversation_id=m.conversation_id
  WHERE m.message_id=candidate
   AND m.conversation_id=proof.conversation_id
   AND m.sender_id=t.driver_id AND t.passenger_id=proof.actor_id;
  IF NOT FOUND OR message_row.revision IS DISTINCT FROM item_revision
  THEN RAISE EXCEPTION 'G55 history message not source backed'
   USING ERRCODE='G5503'; END IF;
  marker:=pg_catalog.gen_random_uuid();
  issued:=pg_catalog.clock_timestamp();
  expires:=issued+interval '60 seconds';
  INSERT INTO public.mobility_stage_g55_read_markers(
   marker_hash,actor_id,session_id,token_iat_ms,conversation_id,
   message_id,message_seq,history_revision,issued_at,expires_at)
  VALUES(pg_catalog.sha256(pg_catalog.convert_to(marker::text,'UTF8')),
   proof.actor_id,proof.session_id,proof.token_iat_ms,
   proof.conversation_id,candidate,message_row.seq,
   (page->>'revision')::bigint,issued,expires);
  marker_dto:=pg_catalog.jsonb_build_object(
   'marker',marker,'messageId',candidate,
   'expiresAtMs',floor(extract(epoch FROM expires)*1000)::bigint);
 END IF;
 RETURN pg_catalog.jsonb_build_object(
  'page',page,'readMarker',marker_dto,
  'qaOnly',true,'productionEnabled',false);
END $fn$;

-- Requires TWO independent capabilities: one marker issued inside a genuine
-- G52 page, plus a fresh G54 CHAT_READ ticket minted for the current verified
-- JWT provider session. Even a stolen marker alone is useless to the delegate.
CREATE FUNCTION public.mobility_stage_g55_mark_viewed_qa(
 _read_ticket uuid,_marker uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE caller public.mobility_stage_g54_chat_receipt_tickets%ROWTYPE;
 proof public.mobility_stage_g55_read_markers%ROWTYPE;
 msg record; recorded jsonb;
 previous bigint;
BEGIN
 IF _read_ticket IS NULL OR _marker IS NULL
 THEN RAISE EXCEPTION 'G55 missing read ticket/marker' USING ERRCODE='G5502'; END IF;
 caller:=public.mobility_stage_g54_consume_qa(_read_ticket,'CHAT_READ');
 SELECT * INTO proof FROM public.mobility_stage_g55_read_markers
 WHERE marker_hash=pg_catalog.sha256(pg_catalog.convert_to(_marker::text,'UTF8'))
 FOR UPDATE;
 IF NOT FOUND OR proof.actor_id IS DISTINCT FROM caller.actor_id
  OR proof.session_id IS DISTINCT FROM caller.session_id
  OR proof.token_iat_ms IS DISTINCT FROM caller.token_iat_ms
  OR proof.conversation_id IS DISTINCT FROM caller.conversation_id
 THEN RAISE EXCEPTION 'G55 marker not bound to authenticated viewer'
  USING ERRCODE='G5503'; END IF;
 IF proof.consumed_at IS NOT NULL OR proof.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G55 stale or replayed marker' USING ERRCODE='G5505'; END IF;
 SELECT m.seq,m.sender_id,v.revision INTO msg
 FROM public.mobility_stage_g50_chat_messages m
 JOIN public.mobility_stage_g52_message_versions v
  ON v.message_id=m.message_id AND v.conversation_id=m.conversation_id
 JOIN public.mobility_stage_g50_chat_threads t
  ON t.conversation_id=m.conversation_id
 WHERE m.message_id=proof.message_id
  AND m.conversation_id=proof.conversation_id
  AND m.seq=proof.message_seq AND m.sender_id=t.driver_id
  AND t.passenger_id=caller.actor_id;
 IF NOT FOUND OR msg.revision>proof.history_revision
 THEN RAISE EXCEPTION 'G55 marker message changed'
  USING ERRCODE='G5503'; END IF;
 -- Prior watermark must never move backwards. Lock row to prevent races.
 SELECT through_seq INTO previous
 FROM public.mobility_stage_g51_chat_reads
 WHERE conversation_id=caller.conversation_id AND actor_id=caller.actor_id
 FOR UPDATE;
 IF previous IS NOT NULL AND previous>=proof.message_seq THEN
  recorded:=pg_catalog.jsonb_build_object(
   'conversationId',caller.conversation_id,
   'readThrough',previous,'qaOnly',true);
 ELSE
  recorded:=public.mobility_stage_g51_mark_read_owner_qa(
   caller.conversation_id,caller.actor_id,
   caller.session_id,caller.token_iat_ms,proof.message_seq);
 END IF;
 UPDATE public.mobility_stage_g55_read_markers
 SET consumed_at=pg_catalog.clock_timestamp()
 WHERE marker_hash=proof.marker_hash;
 RETURN pg_catalog.jsonb_build_object(
  'conversationId',caller.conversation_id,
  'messageId',proof.message_id,
  'qaOnly',true,'readConfirmed',true,
  'readThrough',recorded->'readThrough');
END $fn$;

-- A G51 no-op replay should not manufacture inbox activity or bump revision.
DROP TRIGGER g51_read_activity ON public.mobility_stage_g51_chat_reads;
CREATE TRIGGER g51_read_insert AFTER INSERT
 ON public.mobility_stage_g51_chat_reads FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g51_log_activity();
CREATE TRIGGER g51_read_advance AFTER UPDATE OF through_seq
 ON public.mobility_stage_g51_chat_reads FOR EACH ROW
 WHEN (OLD.through_seq IS DISTINCT FROM NEW.through_seq)
 EXECUTE FUNCTION public.mobility_stage_g51_log_activity();

REVOKE ALL ON FUNCTION
 public.mobility_stage_g55_history_marker_qa(uuid,bigint,bigint,integer),
 public.mobility_stage_g55_mark_viewed_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role,
 mobility_g48_gateway_ci,mobility_g49_chat_gateway_ci;
GRANT EXECUTE ON FUNCTION
 public.mobility_stage_g55_history_marker_qa(uuid,bigint,bigint,integer),
 public.mobility_stage_g55_mark_viewed_qa(uuid,uuid)
 TO mobility_g49_chat_gateway_ci;
COMMIT;
