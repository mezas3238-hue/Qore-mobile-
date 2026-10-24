-- G56 A38 / phase 1: restricted Driver OPEN/HISTORY/SEND. PostgreSQL16 disposable QA ONLY.
-- Never install synthetic owner mint in hosted Supabase or expose it from mobile.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g49_open_qa(uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g52_history_owner_qa(uuid,uuid,uuid,bigint,bigint,bigint,integer)') IS NULL
 THEN RAISE EXCEPTION 'G56 requires disposable G42/G49/G50/G52/G53'; END IF;
END $guard$;
BEGIN;
CREATE ROLE mobility_g56_driver_gateway_ci NOLOGIN NOINHERIT NOSUPERUSER
 NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT USAGE ON SCHEMA public TO mobility_g56_driver_gateway_ci;
CREATE TABLE public.mobility_stage_g56_driver_tickets(
 ticket_hash bytea PRIMARY KEY CHECK(octet_length(ticket_hash)=32),
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 session_id uuid NOT NULL,
 token_iat_ms bigint NOT NULL CHECK(token_iat_ms>=0),
 operation text NOT NULL CHECK(operation IN ('DRIVER_OPEN','DRIVER_HISTORY','DRIVER_SEND')),
 service_kind text NOT NULL CHECK(service_kind IN ('RIDE','DELIVERY','MERCHANT_ORDER')),
 service_id uuid NOT NULL,
 conversation_id uuid,
 issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 evidence_kind text NOT NULL DEFAULT 'QA_SYNTHETIC_OWNER_ATTESTATION_ONLY'
  CHECK(evidence_kind='QA_SYNTHETIC_OWNER_ATTESTATION_ONLY'),
 CHECK((operation='DRIVER_OPEN' AND conversation_id IS NULL)
  OR (operation<>'DRIVER_OPEN' AND conversation_id IS NOT NULL))
);
CREATE INDEX mobility_stage_g56_ticket_expiry
 ON public.mobility_stage_g56_driver_tickets(expires_at);
ALTER TABLE public.mobility_stage_g56_driver_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g56_driver_tickets
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci,
 mobility_g49_chat_gateway_ci,mobility_g56_driver_gateway_ci;

CREATE FUNCTION public.mobility_stage_g56_mint_owner_qa(
 _driver uuid,_session uuid,_iat bigint,_operation text,
 _kind text,_service uuid,_conversation uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE t public.mobility_stage_g50_chat_threads%ROWTYPE;
 src record; ticket uuid; issued timestamptz; until timestamptz;
BEGIN
 IF _driver IS NULL OR _session IS NULL OR _iat IS NULL
 OR _operation IS NULL OR _operation NOT IN ('DRIVER_OPEN','DRIVER_HISTORY','DRIVER_SEND')
 OR _kind IS NULL OR _kind NOT IN ('RIDE','DELIVERY','MERCHANT_ORDER')
 OR _service IS NULL
 OR (_operation='DRIVER_OPEN' AND _conversation IS NOT NULL)
 OR (_operation<>'DRIVER_OPEN' AND _conversation IS NULL)
 OR NOT public.mobility_stage_g42_lock_session(_driver,_session,_iat)
 THEN RAISE EXCEPTION 'G56 invalid session or scope' USING ERRCODE='G5601'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_driver)<>1
 OR NOT EXISTS (SELECT 1 FROM public.user_roles
  WHERE user_id=_driver AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'G56 exclusive Driver required' USING ERRCODE='G5603'; END IF;
 IF _operation<>'DRIVER_OPEN' THEN
  t:=public.mobility_stage_g50_authorize(
   _conversation,_driver,_session,_iat,_operation='DRIVER_SEND');
  IF t.driver_id IS DISTINCT FROM _driver OR
   t.service_kind IS DISTINCT FROM _kind OR t.service_id IS DISTINCT FROM _service
  THEN RAISE EXCEPTION 'G56 wrong service/thread' USING ERRCODE='G5604'; END IF;
 END IF;
 SELECT * INTO src FROM public.mobility_stage_g50_source(_kind,_service);
 IF NOT FOUND OR src.driver_id IS DISTINCT FROM _driver
 OR src.passenger_id IS NULL OR NOT src.can_send
 OR (_operation<>'DRIVER_OPEN' AND src.passenger_id IS DISTINCT FROM t.passenger_id)
 THEN RAISE EXCEPTION 'G56 Driver not currently assigned' USING ERRCODE='G5604'; END IF;
 ticket:=pg_catalog.gen_random_uuid();
 issued:=pg_catalog.clock_timestamp(); until:=issued+interval '20 seconds';
 INSERT INTO public.mobility_stage_g56_driver_tickets(
  ticket_hash,driver_id,session_id,token_iat_ms,operation,
  service_kind,service_id,conversation_id,issued_at,expires_at)
 VALUES(pg_catalog.sha256(pg_catalog.convert_to(ticket::text,'UTF8')),
  _driver,_session,_iat,_operation,_kind,_service,_conversation,issued,until);
 RETURN pg_catalog.jsonb_build_object(
  'ticket',ticket,'operation',_operation,
  'expiresAtMs',floor(extract(epoch from until)*1000)::bigint,
  'productionEnabled',false,'qaOnly',true);
END $fn$;

CREATE FUNCTION public.mobility_stage_g56_consume_qa(
 _ticket uuid,_operation text
) RETURNS public.mobility_stage_g56_driver_tickets
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE proof public.mobility_stage_g56_driver_tickets%ROWTYPE;
 thread public.mobility_stage_g50_chat_threads%ROWTYPE;
 src record;
BEGIN
 IF _ticket IS NULL OR _operation IS NULL OR
 _operation NOT IN('DRIVER_OPEN','DRIVER_HISTORY','DRIVER_SEND')
 THEN RAISE EXCEPTION 'G56 missing ticket/purpose' USING ERRCODE='G5602'; END IF;
 SELECT * INTO proof FROM public.mobility_stage_g56_driver_tickets
 WHERE ticket_hash=pg_catalog.sha256(pg_catalog.convert_to(_ticket::text,'UTF8'))
 FOR UPDATE;
 IF NOT FOUND OR proof.operation IS DISTINCT FROM _operation
 THEN RAISE EXCEPTION 'G56 invalid capability' USING ERRCODE='G5602'; END IF;
 IF proof.consumed_at IS NOT NULL OR proof.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G56 consumed/expired' USING ERRCODE='G5605'; END IF;
 IF NOT public.mobility_stage_g42_lock_session(
  proof.driver_id,proof.session_id,proof.token_iat_ms)
 THEN RAISE EXCEPTION 'G56 session revoked' USING ERRCODE='G5601'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=proof.driver_id)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
  WHERE user_id=proof.driver_id AND role='driver'::public.app_role)
 THEN RAISE EXCEPTION 'G56 Driver role revoked' USING ERRCODE='G5603'; END IF;
 IF _operation<>'DRIVER_OPEN' THEN
  thread:=public.mobility_stage_g50_authorize(
   proof.conversation_id,proof.driver_id,proof.session_id,proof.token_iat_ms,
   _operation='DRIVER_SEND');
  IF thread.driver_id IS DISTINCT FROM proof.driver_id
  OR thread.service_kind IS DISTINCT FROM proof.service_kind
  OR thread.service_id IS DISTINCT FROM proof.service_id
  THEN RAISE EXCEPTION 'G56 conversation rotated' USING ERRCODE='G5604'; END IF;
 END IF;
 SELECT * INTO src FROM public.mobility_stage_g50_source(
  proof.service_kind,proof.service_id);
 IF NOT FOUND OR NOT src.can_send OR
 src.driver_id IS DISTINCT FROM proof.driver_id OR src.passenger_id IS NULL
 OR (_operation<>'DRIVER_OPEN' AND src.passenger_id IS DISTINCT FROM thread.passenger_id)
 THEN RAISE EXCEPTION 'G56 revoked Driver assignment' USING ERRCODE='G5604'; END IF;
 UPDATE public.mobility_stage_g56_driver_tickets
 SET consumed_at=pg_catalog.clock_timestamp() WHERE ticket_hash=proof.ticket_hash;
 RETURN proof;
END $fn$;

CREATE FUNCTION public.mobility_stage_g56_open_qa(_ticket uuid)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE p public.mobility_stage_g56_driver_tickets%ROWTYPE;
BEGIN
 p:=public.mobility_stage_g56_consume_qa(_ticket,'DRIVER_OPEN');
 RETURN public.mobility_stage_g50_open_owner_qa(
  p.service_kind,p.service_id,p.driver_id,p.session_id,p.token_iat_ms);
END $fn$;

-- Driver history: same strict message layout and keyset discipline as G52,
-- but distinct owner/counterpart roles; never call the Passenger G52 owner RPC.
CREATE FUNCTION public.mobility_stage_g56_history_qa(
 _ticket uuid,_revision bigint,_before bigint,_limit integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE p public.mobility_stage_g56_driver_tickets%ROWTYPE;
 t public.mobility_stage_g50_chat_threads%ROWTYPE;
 rev bigint; at_ms bigint; payload jsonb; n integer; last_seq bigint;
BEGIN
 IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 100
 OR (_revision IS NULL)<>(_before IS NULL)
 OR (_revision IS NOT NULL AND _revision<1)
 OR (_before IS NOT NULL AND _before<1)
 THEN RAISE EXCEPTION 'G56 invalid history page' USING ERRCODE='G5602'; END IF;
 p:=public.mobility_stage_g56_consume_qa(_ticket,'DRIVER_HISTORY');
 t:=public.mobility_stage_g50_authorize(
  p.conversation_id,p.driver_id,p.session_id,p.token_iat_ms,false);
 IF t.driver_id IS DISTINCT FROM p.driver_id
 THEN RAISE EXCEPTION 'G56 wrong Driver' USING ERRCODE='G5603'; END IF;
 SELECT revision INTO rev FROM public.mobility_stage_g52_thread_versions
 WHERE conversation_id=p.conversation_id FOR SHARE;
 IF rev IS NULL OR (_revision IS NOT NULL AND rev<>_revision)
 THEN RAISE EXCEPTION 'G56 stale revision' USING ERRCODE='G5609'; END IF;
 at_ms:=floor(extract(epoch FROM pg_catalog.clock_timestamp())*1000)::bigint;
 WITH eligible AS (
  SELECT m.seq,m.message_id,m.body,m.created_at,v.revision AS msg_rev,
   CASE WHEN m.sender_id=t.driver_id THEN 'driver'
    WHEN m.sender_id=t.passenger_id THEN 'passenger' ELSE NULL END sender_role
  FROM public.mobility_stage_g50_chat_messages m
  JOIN public.mobility_stage_g52_message_versions v
   ON v.message_id=m.message_id AND v.conversation_id=m.conversation_id
  WHERE m.conversation_id=p.conversation_id
   AND (_before IS NULL OR m.seq<_before)
  ORDER BY m.seq DESC LIMIT _limit+1
 ), visible AS(SELECT * FROM eligible ORDER BY seq DESC LIMIT _limit)
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'messageId',message_id,'senderRole',sender_role,'body',body,
  'createdAt',floor(extract(epoch FROM created_at)*1000)::bigint,
  'revision',msg_rev) ORDER BY seq DESC),'[]'::jsonb),
  (SELECT count(*) FROM eligible),(SELECT min(seq) FROM visible)
 INTO payload,n,last_seq FROM visible;
 RETURN pg_catalog.jsonb_build_object(
  'conversationId',t.conversation_id,'serviceId',t.service_id,
  'serviceKind',t.service_kind,'ownerId',p.driver_id,
  'counterpartRole','passenger','assignmentVerified',true,'state','ACTIVE',
  'revision',rev,'generatedAt',at_ms,'expiresAt',at_ms+60000,
  'messages',payload,'hasMore',n>_limit,
  'nextPosition',CASE WHEN n>_limit
   THEN pg_catalog.jsonb_build_object('beforeSeq',last_seq) ELSE NULL END,
  'canSend',true,'productionEnabled',false,'qaOnly',true);
END $fn$;

CREATE FUNCTION public.mobility_stage_g56_send_qa(
 _ticket uuid,_request uuid,_body text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE p public.mobility_stage_g56_driver_tickets%ROWTYPE;
 raw_receipt jsonb; saved record;
BEGIN
 IF _request IS NULL OR _body IS NULL
 THEN RAISE EXCEPTION 'G56 invalid send body' USING ERRCODE='G5602'; END IF;
 p:=public.mobility_stage_g56_consume_qa(_ticket,'DRIVER_SEND');
 raw_receipt:=public.mobility_stage_g50_send_owner_qa(
  p.conversation_id,p.driver_id,p.session_id,p.token_iat_ms,_request,_body);
 SELECT m.message_id,m.sender_id,m.request_key,m.body,m.created_at,
  v.revision AS msg_rev INTO saved
 FROM public.mobility_stage_g50_chat_messages m
 JOIN public.mobility_stage_g52_message_versions v
  ON v.message_id=m.message_id AND v.conversation_id=m.conversation_id
 WHERE m.message_id=(raw_receipt->>'messageId')::uuid
 AND m.conversation_id=p.conversation_id;
 IF NOT FOUND OR saved.sender_id IS DISTINCT FROM p.driver_id
 OR saved.request_key IS DISTINCT FROM _request OR saved.body IS DISTINCT FROM _body
 OR saved.msg_rev IS NULL
 THEN RAISE EXCEPTION 'G56 untrusted stored Driver message' USING ERRCODE='G5606'; END IF;
 RETURN pg_catalog.jsonb_build_object(
  'conversationId',p.conversation_id,'serviceId',p.service_id,
  'requestKey',saved.request_key,'messageId',saved.message_id,
  'senderRole','driver','body',saved.body,
  'createdAt',floor(extract(epoch FROM saved.created_at)*1000)::bigint,
  'revision',saved.msg_rev,'serverStored',true);
END $fn$;

REVOKE ALL ON FUNCTION
 public.mobility_stage_g56_mint_owner_qa(uuid,uuid,bigint,text,text,uuid,uuid),
 public.mobility_stage_g56_consume_qa(uuid,text),
 public.mobility_stage_g56_open_qa(uuid),
 public.mobility_stage_g56_history_qa(uuid,bigint,bigint,integer),
 public.mobility_stage_g56_send_qa(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci,
 mobility_g49_chat_gateway_ci,mobility_g56_driver_gateway_ci;
GRANT EXECUTE ON FUNCTION
 public.mobility_stage_g56_open_qa(uuid),
 public.mobility_stage_g56_history_qa(uuid,bigint,bigint,integer),
 public.mobility_stage_g56_send_qa(uuid,uuid,text)
 TO mobility_g56_driver_gateway_ci;
COMMIT;
