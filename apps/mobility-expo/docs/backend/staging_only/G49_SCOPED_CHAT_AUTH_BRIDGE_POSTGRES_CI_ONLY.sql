-- G49 / A35: least-privilege chat DB delegation, PostgreSQL 16 QA-only.
-- Never deploy this synthetic OWNER mint or treat raw user UUID as verified JWT.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g53_passenger_send_owner_qa(text,uuid,uuid,uuid,uuid,bigint,uuid,text)') IS NULL
 OR to_regprocedure('public.mobility_stage_g52_history_owner_qa(uuid,uuid,uuid,bigint,bigint,bigint,integer)') IS NULL
 THEN RAISE EXCEPTION 'G49 requires disposable G42/G50/G52/G53'; END IF;
END $guard$;
BEGIN;
CREATE ROLE mobility_g49_chat_gateway_ci NOLOGIN NOINHERIT NOSUPERUSER
 NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT USAGE ON SCHEMA public TO mobility_g49_chat_gateway_ci;
CREATE TABLE public.mobility_stage_g49_chat_tickets(
 ticket_hash bytea PRIMARY KEY CHECK(octet_length(ticket_hash)=32),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 session_id uuid NOT NULL,
 token_iat_ms bigint NOT NULL CHECK(token_iat_ms BETWEEN 0 AND 9999999999999),
 operation text NOT NULL CHECK(operation IN('CHAT_OPEN','CHAT_HISTORY','CHAT_SEND')),
 service_kind text NOT NULL CHECK(service_kind IN('RIDE','DELIVERY','MERCHANT_ORDER')),
 service_id uuid NOT NULL,
 conversation_id uuid,
 issued_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 evidence_kind text NOT NULL DEFAULT 'QA_SYNTHETIC_OWNER_ATTESTATION_ONLY'
   CHECK(evidence_kind='QA_SYNTHETIC_OWNER_ATTESTATION_ONLY'),
 CHECK((operation='CHAT_OPEN' AND conversation_id IS NULL)
    OR (operation IN('CHAT_HISTORY','CHAT_SEND') AND conversation_id IS NOT NULL)),
 CHECK(consumed_at IS NULL OR consumed_at>=issued_at)
);
CREATE INDEX mobility_stage_g49_expiry ON public.mobility_stage_g49_chat_tickets(expires_at);
ALTER TABLE public.mobility_stage_g49_chat_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g49_chat_tickets
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci,
 mobility_g49_chat_gateway_ci;
-- Mint NEVER granted to delegated role. Only isolated owner-injected trusted
-- QA process may call it. Full provider-pinned identity ingestion still pending.
CREATE FUNCTION public.mobility_stage_g49_mint_owner_qa(
 _actor uuid,_session uuid,_iat bigint,_operation text,
 _kind text,_service uuid,_conversation uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE t public.mobility_stage_g50_chat_threads%ROWTYPE;
 src record; ticket uuid; issued timestamptz; until timestamptz;
BEGIN
 IF _actor IS NULL OR _session IS NULL OR _iat IS NULL
 OR _operation IS NULL OR _operation NOT IN('CHAT_OPEN','CHAT_HISTORY','CHAT_SEND')
 OR _kind IS NULL OR _kind NOT IN('RIDE','DELIVERY','MERCHANT_ORDER')
 OR _service IS NULL OR
 (_operation='CHAT_OPEN' AND _conversation IS NOT NULL)
 OR (_operation<>'CHAT_OPEN' AND _conversation IS NULL)
 OR NOT public.mobility_stage_g42_lock_session(_actor,_session,_iat)
 THEN RAISE EXCEPTION 'G49 invalid session/scope'
  USING ERRCODE='G4901'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_actor)<>1 OR
 NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor
   AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G49 Passenger role required' USING ERRCODE='G4903'; END IF;
 IF _operation='CHAT_OPEN' THEN
  SELECT * INTO src FROM public.mobility_stage_g50_source(_kind,_service);
  IF NOT FOUND OR src.passenger_id IS DISTINCT FROM _actor
   OR NOT src.can_send OR src.driver_id IS NULL
  THEN RAISE EXCEPTION 'G49 current service assignment required'
   USING ERRCODE='G4904'; END IF;
 ELSE
  t:=public.mobility_stage_g50_authorize(
   _conversation,_actor,_session,_iat,_operation='CHAT_SEND');
  IF t.passenger_id IS DISTINCT FROM _actor OR
   t.service_kind IS DISTINCT FROM _kind OR
   t.service_id IS DISTINCT FROM _service
  THEN RAISE EXCEPTION 'G49 wrong service or role' USING ERRCODE='G4904'; END IF;
  -- Cliente B history demands canSend:true; terminal conversations do not
  -- receive even history-scoped capabilities in this QA profile.
  SELECT * INTO src FROM public.mobility_stage_g50_source(_kind,_service);
  IF NOT FOUND OR NOT src.can_send OR
   src.passenger_id IS DISTINCT FROM t.passenger_id OR
   src.driver_id IS DISTINCT FROM t.driver_id
  THEN RAISE EXCEPTION 'G49 terminal/rotated assignment' USING ERRCODE='G4904'; END IF;
 END IF;
 ticket:=pg_catalog.gen_random_uuid();
 issued:=pg_catalog.clock_timestamp();
 until:=issued+interval '20 seconds';
 INSERT INTO public.mobility_stage_g49_chat_tickets(
  ticket_hash,actor_id,session_id,token_iat_ms,operation,
  service_kind,service_id,conversation_id,issued_at,expires_at)
 VALUES(pg_catalog.sha256(pg_catalog.convert_to(ticket::text,'UTF8')),
  _actor,_session,_iat,_operation,_kind,_service,_conversation,issued,until);
 RETURN pg_catalog.jsonb_build_object(
  'ticket',ticket,'operation',_operation,
  'expiresAtMs',floor(extract(epoch from until)*1000)::bigint,
  'productionEnabled',false,'qaOnly',true);
END $fn$;
CREATE FUNCTION public.mobility_stage_g49_consume_qa(
 _ticket uuid,_operation text
) RETURNS public.mobility_stage_g49_chat_tickets
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE t public.mobility_stage_g49_chat_tickets%ROWTYPE;
 thread public.mobility_stage_g50_chat_threads%ROWTYPE;
 src record;
BEGIN
 IF _ticket IS NULL OR _operation IS NULL OR
 _operation NOT IN('CHAT_OPEN','CHAT_HISTORY','CHAT_SEND')
 THEN RAISE EXCEPTION 'G49 missing ticket/purpose' USING ERRCODE='G4902'; END IF;
 SELECT * INTO t FROM public.mobility_stage_g49_chat_tickets
 WHERE ticket_hash=pg_catalog.sha256(pg_catalog.convert_to(_ticket::text,'UTF8'))
 FOR UPDATE;
 IF NOT FOUND OR t.operation IS DISTINCT FROM _operation
 THEN RAISE EXCEPTION 'G49 forged or wrong-purpose ticket' USING ERRCODE='G4902'; END IF;
 IF t.consumed_at IS NOT NULL OR t.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G49 expired/consumed ticket' USING ERRCODE='G4905'; END IF;
 IF NOT public.mobility_stage_g42_lock_session(t.actor_id,t.session_id,t.token_iat_ms)
 THEN RAISE EXCEPTION 'G49 revoked session' USING ERRCODE='G4901'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=t.actor_id)<>1 OR
 NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=t.actor_id
  AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G49 role no longer authorized' USING ERRCODE='G4903'; END IF;
 IF _operation='CHAT_OPEN' THEN
  SELECT * INTO src FROM public.mobility_stage_g50_source(t.service_kind,t.service_id);
  IF NOT FOUND OR src.passenger_id IS DISTINCT FROM t.actor_id
   OR NOT src.can_send OR src.driver_id IS NULL
  THEN RAISE EXCEPTION 'G49 assignment revoked' USING ERRCODE='G4904'; END IF;
 ELSE
  thread:=public.mobility_stage_g50_authorize(
   t.conversation_id,t.actor_id,t.session_id,t.token_iat_ms,
   _operation='CHAT_SEND');
  IF thread.passenger_id IS DISTINCT FROM t.actor_id OR
   thread.service_kind IS DISTINCT FROM t.service_kind OR
   thread.service_id IS DISTINCT FROM t.service_id
  THEN RAISE EXCEPTION 'G49 resource out of scope' USING ERRCODE='G4904'; END IF;
  SELECT * INTO src FROM public.mobility_stage_g50_source(t.service_kind,t.service_id);
  IF NOT FOUND OR NOT src.can_send OR src.passenger_id IS DISTINCT FROM thread.passenger_id
   OR src.driver_id IS DISTINCT FROM thread.driver_id
  THEN RAISE EXCEPTION 'G49 terminal/rotated conversation' USING ERRCODE='G4904'; END IF;
 END IF;
 UPDATE public.mobility_stage_g49_chat_tickets SET consumed_at=pg_catalog.clock_timestamp()
 WHERE ticket_hash=t.ticket_hash;
 RETURN t;
END $fn$;
CREATE FUNCTION public.mobility_stage_g49_open_qa(_ticket uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE proof public.mobility_stage_g49_chat_tickets%ROWTYPE;
BEGIN
 proof:=public.mobility_stage_g49_consume_qa(_ticket,'CHAT_OPEN');
 RETURN public.mobility_stage_g50_open_owner_qa(
  proof.service_kind,proof.service_id,proof.actor_id,proof.session_id,proof.token_iat_ms);
END $fn$;
CREATE FUNCTION public.mobility_stage_g49_history_qa(
 _ticket uuid,_expected_revision bigint,_before_seq bigint,_limit integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE proof public.mobility_stage_g49_chat_tickets%ROWTYPE;
BEGIN
 IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 100
 THEN RAISE EXCEPTION 'G49 invalid page' USING ERRCODE='G4902'; END IF;
 proof:=public.mobility_stage_g49_consume_qa(_ticket,'CHAT_HISTORY');
 RETURN public.mobility_stage_g52_history_owner_qa(
  proof.conversation_id,proof.actor_id,proof.session_id,proof.token_iat_ms,
  _expected_revision,_before_seq,_limit);
END $fn$;
CREATE FUNCTION public.mobility_stage_g49_send_qa(
 _ticket uuid,_request uuid,_body text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE proof public.mobility_stage_g49_chat_tickets%ROWTYPE;
BEGIN
 IF _request IS NULL OR _body IS NULL
 THEN RAISE EXCEPTION 'G49 invalid send' USING ERRCODE='G4902'; END IF;
 proof:=public.mobility_stage_g49_consume_qa(_ticket,'CHAT_SEND');
 RETURN public.mobility_stage_g53_passenger_send_owner_qa(
  proof.service_kind,proof.service_id,proof.conversation_id,
  proof.actor_id,proof.session_id,proof.token_iat_ms,_request,_body);
END $fn$;
REVOKE ALL ON FUNCTION
 public.mobility_stage_g49_mint_owner_qa(uuid,uuid,bigint,text,text,uuid,uuid),
 public.mobility_stage_g49_consume_qa(uuid,text),
 public.mobility_stage_g49_open_qa(uuid),
 public.mobility_stage_g49_history_qa(uuid,bigint,bigint,integer),
 public.mobility_stage_g49_send_qa(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci,
 mobility_g49_chat_gateway_ci;
GRANT EXECUTE ON FUNCTION
 public.mobility_stage_g49_open_qa(uuid),
 public.mobility_stage_g49_history_qa(uuid,bigint,bigint,integer),
 public.mobility_stage_g49_send_qa(uuid,uuid,text)
 TO mobility_g49_chat_gateway_ci;
COMMIT;
