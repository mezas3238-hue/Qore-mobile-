-- G54 / A36 - chat inbox and read receipts via NOLOGIN least-privilege role.
-- Disposable PostgreSQL 16 QA; not a live migration. No browser/SDK grants.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g49_open_qa(uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g51_passenger_inbox_owner_qa(uuid,uuid,bigint,bigint,bigint,uuid,integer)') IS NULL
 OR to_regprocedure('public.mobility_stage_g51_mark_read_owner_qa(uuid,uuid,uuid,bigint,bigint)') IS NULL
 THEN RAISE EXCEPTION 'G54 requires disposable G49/G51 chain'; END IF;
END $guard$;
BEGIN;
-- Dedicated capability store; do not weaken G49's CHAT_OPEN/HISTORY/SEND
-- check constraints or accidentally broaden its pre-existing wrapper surface.
CREATE TABLE public.mobility_stage_g54_chat_receipt_tickets(
 ticket_hash bytea PRIMARY KEY CHECK(octet_length(ticket_hash)=32),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 session_id uuid NOT NULL,
 token_iat_ms bigint NOT NULL CHECK(token_iat_ms BETWEEN 0 AND 9999999999999),
 operation text NOT NULL CHECK(operation IN('CHAT_INBOX','CHAT_READ')),
 conversation_id uuid,
 issued_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 evidence_kind text NOT NULL DEFAULT 'QA_SYNTHETIC_OWNER_ATTESTATION_ONLY'
  CHECK(evidence_kind='QA_SYNTHETIC_OWNER_ATTESTATION_ONLY'),
 CHECK((operation='CHAT_INBOX' AND conversation_id IS NULL)
 OR (operation='CHAT_READ' AND conversation_id IS NOT NULL)),
 CHECK(consumed_at IS NULL OR consumed_at>=issued_at)
);
CREATE INDEX mobility_stage_g54_ticket_expiry
 ON public.mobility_stage_g54_chat_receipt_tickets(expires_at);
ALTER TABLE public.mobility_stage_g54_chat_receipt_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g54_chat_receipt_tickets
 FROM PUBLIC,anon,authenticated,service_role,
 mobility_g48_gateway_ci,mobility_g49_chat_gateway_ci;

-- ONLY owner synthetic QA can mint. Never callable from client or delegated role.
CREATE FUNCTION public.mobility_stage_g54_mint_owner_qa(
 _actor uuid,_session uuid,_iat bigint,_operation text,_conversation uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE cid public.mobility_stage_g50_chat_threads%ROWTYPE;
 source_row record; ticket uuid; issued timestamptz; until timestamptz;
BEGIN
 IF _actor IS NULL OR _session IS NULL OR _iat IS NULL
 OR _operation IS NULL OR _operation NOT IN('CHAT_INBOX','CHAT_READ')
 OR (_operation='CHAT_INBOX' AND _conversation IS NOT NULL)
 OR (_operation='CHAT_READ' AND _conversation IS NULL)
 OR NOT public.mobility_stage_g42_lock_session(_actor,_session,_iat)
 THEN RAISE EXCEPTION 'G54 invalid session or scope' USING ERRCODE='G5401'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=_actor)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
   WHERE user_id=_actor AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G54 exclusive Passenger role required' USING ERRCODE='G5403'; END IF;
 IF _operation='CHAT_READ' THEN
  cid:=public.mobility_stage_g50_authorize(_conversation,_actor,_session,_iat,false);
  IF cid.passenger_id IS DISTINCT FROM _actor
  THEN RAISE EXCEPTION 'G54 foreign read receipt' USING ERRCODE='G5404'; END IF;
  SELECT * INTO source_row
   FROM public.mobility_stage_g50_source(cid.service_kind,cid.service_id);
  IF NOT FOUND OR NOT source_row.can_send OR
    source_row.passenger_id IS DISTINCT FROM cid.passenger_id OR
    source_row.driver_id IS DISTINCT FROM cid.driver_id
  THEN RAISE EXCEPTION 'G54 stale read receipt assignment' USING ERRCODE='G5404'; END IF;
 END IF;
 ticket:=pg_catalog.gen_random_uuid();
 issued:=pg_catalog.clock_timestamp();
 until:=issued+interval '20 seconds';
 INSERT INTO public.mobility_stage_g54_chat_receipt_tickets(
  ticket_hash,actor_id,session_id,token_iat_ms,operation,conversation_id,
  issued_at,expires_at)
 VALUES(pg_catalog.sha256(pg_catalog.convert_to(ticket::text,'UTF8')),
  _actor,_session,_iat,_operation,_conversation,issued,until);
 RETURN pg_catalog.jsonb_build_object('ticket',ticket,'operation',_operation,
  'expiresAtMs',floor(extract(epoch FROM until)*1000)::bigint,
  'productionEnabled',false,'qaOnly',true);
END $fn$;

CREATE FUNCTION public.mobility_stage_g54_consume_qa(
 _ticket uuid,_operation text
) RETURNS public.mobility_stage_g54_chat_receipt_tickets
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE proof public.mobility_stage_g54_chat_receipt_tickets%ROWTYPE;
 cid public.mobility_stage_g50_chat_threads%ROWTYPE; src record;
BEGIN
 IF _ticket IS NULL OR _operation IS NULL OR
 _operation NOT IN('CHAT_INBOX','CHAT_READ')
 THEN RAISE EXCEPTION 'G54 invalid capability' USING ERRCODE='G5402'; END IF;
 SELECT * INTO proof FROM public.mobility_stage_g54_chat_receipt_tickets
 WHERE ticket_hash=pg_catalog.sha256(pg_catalog.convert_to(_ticket::text,'UTF8'))
 FOR UPDATE;
 IF NOT FOUND OR proof.operation IS DISTINCT FROM _operation
 THEN RAISE EXCEPTION 'G54 forged/wrong-purpose capability' USING ERRCODE='G5402'; END IF;
 IF proof.consumed_at IS NOT NULL OR proof.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G54 consumed/expired capability' USING ERRCODE='G5405'; END IF;
 IF NOT public.mobility_stage_g42_lock_session(
   proof.actor_id,proof.session_id,proof.token_iat_ms)
 THEN RAISE EXCEPTION 'G54 revoked session' USING ERRCODE='G5401'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id=proof.actor_id)<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
   WHERE user_id=proof.actor_id AND role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'G54 Passenger role revoked' USING ERRCODE='G5403'; END IF;
 IF _operation='CHAT_READ' THEN
  cid:=public.mobility_stage_g50_authorize(
   proof.conversation_id,proof.actor_id,proof.session_id,proof.token_iat_ms,false);
  IF cid.passenger_id IS DISTINCT FROM proof.actor_id
  THEN RAISE EXCEPTION 'G54 read another actor' USING ERRCODE='G5404'; END IF;
  SELECT * INTO src FROM public.mobility_stage_g50_source(cid.service_kind,cid.service_id);
  IF NOT FOUND OR NOT src.can_send OR
   src.passenger_id IS DISTINCT FROM cid.passenger_id OR
   src.driver_id IS DISTINCT FROM cid.driver_id
  THEN RAISE EXCEPTION 'G54 terminal or rotated read' USING ERRCODE='G5404'; END IF;
 END IF;
 UPDATE public.mobility_stage_g54_chat_receipt_tickets
 SET consumed_at=pg_catalog.clock_timestamp()
 WHERE ticket_hash=proof.ticket_hash;
 RETURN proof;
END $fn$;

CREATE FUNCTION public.mobility_stage_g54_inbox_qa(
 _ticket uuid,_expected_revision bigint,_before_ms bigint,
 _before_id uuid,_limit integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE proof public.mobility_stage_g54_chat_receipt_tickets%ROWTYPE;
BEGIN
 IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 100
 OR (_before_ms IS NULL)<>(_before_id IS NULL)
 OR (_before_ms IS NOT NULL AND
  (_before_ms<0 OR _expected_revision IS NULL))
 OR (_expected_revision IS NOT NULL AND _expected_revision<1)
 THEN RAISE EXCEPTION 'G54 invalid inbox cursor' USING ERRCODE='G5402'; END IF;
 proof:=public.mobility_stage_g54_consume_qa(_ticket,'CHAT_INBOX');
 RETURN public.mobility_stage_g51_passenger_inbox_owner_qa(
  proof.actor_id,proof.session_id,proof.token_iat_ms,
  _expected_revision,_before_ms,_before_id,_limit);
END $fn$;

CREATE FUNCTION public.mobility_stage_g54_mark_read_qa(
 _ticket uuid,_through_seq bigint
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE proof public.mobility_stage_g54_chat_receipt_tickets%ROWTYPE;
BEGIN
 IF _through_seq IS NULL OR _through_seq<0
 THEN RAISE EXCEPTION 'G54 invalid read watermark' USING ERRCODE='G5402'; END IF;
 proof:=public.mobility_stage_g54_consume_qa(_ticket,'CHAT_READ');
 RETURN public.mobility_stage_g51_mark_read_owner_qa(
  proof.conversation_id,proof.actor_id,proof.session_id,
  proof.token_iat_ms,_through_seq);
END $fn$;
REVOKE ALL ON FUNCTION
 public.mobility_stage_g54_mint_owner_qa(uuid,uuid,bigint,text,uuid),
 public.mobility_stage_g54_consume_qa(uuid,text),
 public.mobility_stage_g54_inbox_qa(uuid,bigint,bigint,uuid,integer),
 public.mobility_stage_g54_mark_read_qa(uuid,bigint)
 FROM PUBLIC,anon,authenticated,service_role,
 mobility_g48_gateway_ci,mobility_g49_chat_gateway_ci;
GRANT EXECUTE ON FUNCTION
 public.mobility_stage_g54_inbox_qa(uuid,bigint,bigint,uuid,integer),
 public.mobility_stage_g54_mark_read_qa(uuid,bigint)
 TO mobility_g49_chat_gateway_ci;
COMMIT;
