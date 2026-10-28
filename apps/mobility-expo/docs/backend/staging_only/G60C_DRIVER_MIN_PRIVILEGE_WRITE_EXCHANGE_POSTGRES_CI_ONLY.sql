-- QORE G60C / A50: single-use SQL Driver SEND/RECONCILE exchange.
-- QA on disposable PostgreSQL16 only. NOT product deployment or JWT issuer.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g56_mint_owner_qa(uuid,uuid,bigint,text,text,uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g56_send_qa(uuid,uuid,text)') IS NULL
 OR to_regprocedure('public.mobility_stage_g59b_reconcile_driver_owner_qa(text,uuid,uuid,uuid,uuid,bigint,uuid,text)') IS NULL
 THEN RAISE EXCEPTION 'G60C needs disposable G42/G56/G59B SQL chain'; END IF;
END $guard$;
BEGIN;
CREATE ROLE mobility_g60c_definer_ci NOLOGIN NOINHERIT
 NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE mobility_g60c_execute_ci NOLOGIN NOINHERIT
 NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT USAGE ON SCHEMA public TO mobility_g60c_definer_ci,mobility_g60c_execute_ci;
GRANT CREATE ON SCHEMA public TO mobility_g60c_definer_ci;
CREATE TABLE public.mobility_stage_g60c_driver_proofs(
 proof_hash bytea PRIMARY KEY CHECK(octet_length(proof_hash)=32),
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 session_id uuid NOT NULL,
 token_iat_ms bigint NOT NULL CHECK(token_iat_ms>0),
 operation text NOT NULL CHECK(operation IN('DRIVER_SEND','DRIVER_RECONCILE')),
 service_kind text NOT NULL CHECK(service_kind IN('RIDE','DELIVERY','MERCHANT_ORDER')),
 service_id uuid NOT NULL,
 conversation_id uuid NOT NULL,
 request_key uuid NOT NULL,
 message_body text NOT NULL CHECK(char_length(message_body) BETWEEN 1 AND 500
  AND octet_length(message_body)<=2000 AND btrim(message_body)=message_body),
 issued_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 redeemed_at timestamptz,
 evidence_kind text NOT NULL DEFAULT 'QA_OWNER_ATTESTED_NO_LIVE_IDP'
  CHECK(evidence_kind='QA_OWNER_ATTESTED_NO_LIVE_IDP'),
 CHECK(expires_at>issued_at AND expires_at<=issued_at+interval '12 seconds'),
 CHECK(redeemed_at IS NULL OR redeemed_at>=issued_at)
);
CREATE INDEX mobility_stage_g60c_proof_gc
 ON public.mobility_stage_g60c_driver_proofs(expires_at);
ALTER TABLE public.mobility_stage_g60c_driver_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g60c_driver_proofs OWNER TO mobility_g60c_definer_ci;
REVOKE ALL ON public.mobility_stage_g60c_driver_proofs
 FROM PUBLIC,anon,authenticated,service_role,
 mobility_g48_gateway_ci,mobility_g49_chat_gateway_ci,
 mobility_g56_driver_gateway_ci,mobility_g58f_exchange_ci,
 mobility_g58f_definer_ci,mobility_g60c_execute_ci;
-- Only the dedicated NOLOGIN definer can use owner-only QA operations;
-- external caller has EXECUTE solely on proof exchange, never raw SQL methods.
GRANT EXECUTE ON FUNCTION
 public.mobility_stage_g42_lock_session(uuid,uuid,bigint),
 public.mobility_stage_g56_mint_owner_qa(uuid,uuid,bigint,text,text,uuid,uuid),
 public.mobility_stage_g56_send_qa(uuid,uuid,text),
 public.mobility_stage_g59b_reconcile_driver_owner_qa(
 text,uuid,uuid,uuid,uuid,bigint,uuid,text)
 TO mobility_g60c_definer_ci;

CREATE FUNCTION public.mobility_stage_g60c_driver_exchange_qa(
 _proof uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE STRICT
 SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE p public.mobility_stage_g60c_driver_proofs%ROWTYPE;
 minted jsonb; output jsonb;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G60C DISABLED outside disposable QA'
 USING ERRCODE='G6011'; END IF;
 SELECT * INTO p FROM public.mobility_stage_g60c_driver_proofs
 WHERE proof_hash=pg_catalog.sha256(
  pg_catalog.convert_to(_proof::text,'UTF8')) FOR UPDATE;
 IF NOT FOUND OR p.redeemed_at IS NOT NULL OR
  p.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G60C missing, expired or spent proof'
 USING ERRCODE='G6012'; END IF;
 -- Session lock lasts until COMMIT; second transaction revocation waits.
 IF NOT public.mobility_stage_g42_lock_session(
    p.driver_id,p.session_id,p.token_iat_ms)
 THEN RAISE EXCEPTION 'G60C expired or revoked session'
 USING ERRCODE='G6013'; END IF;
 IF p.operation='DRIVER_SEND' THEN
  -- G56 owner-only mint revalidates Driver exclusive role/current assignment.
  minted:=public.mobility_stage_g56_mint_owner_qa(
   p.driver_id,p.session_id,p.token_iat_ms,'DRIVER_SEND',
   p.service_kind,p.service_id,p.conversation_id);
  IF minted IS NULL OR minted->>'operation'<>'DRIVER_SEND'
   OR minted->>'qaOnly'<>'true' OR minted->>'productionEnabled'<>'false'
   OR minted->>'ticket' IS NULL
  THEN RAISE EXCEPTION 'G60C invalid delegated Driver ticket'
   USING ERRCODE='G6014'; END IF;
  output:=public.mobility_stage_g56_send_qa(
   (minted->>'ticket')::uuid,p.request_key,p.message_body);
  IF output IS NULL OR output->>'serverStored' IS DISTINCT FROM 'true'
   OR output->>'senderRole' IS DISTINCT FROM 'driver'
   OR output->>'conversationId' IS DISTINCT FROM p.conversation_id::text
   OR output->>'serviceId' IS DISTINCT FROM p.service_id::text
   OR output->>'requestKey' IS DISTINCT FROM p.request_key::text
   OR output->>'body' IS DISTINCT FROM p.message_body
  THEN RAISE EXCEPTION 'G60C untrusted persisted Driver ACK'
   USING ERRCODE='G6014'; END IF;
 ELSIF p.operation='DRIVER_RECONCILE' THEN
  -- Reconcile is a READ of authoritative persisted receipt, no SEND.
  output:=public.mobility_stage_g59b_reconcile_driver_owner_qa(
   p.service_kind,p.service_id,p.conversation_id,
   p.driver_id,p.session_id,p.token_iat_ms,p.request_key,p.message_body);
  IF output IS NULL OR output->>'productionEnabled' IS DISTINCT FROM 'false'
   OR output->>'qaOnly' IS DISTINCT FROM 'true'
   OR output->>'retrySafe' IS DISTINCT FROM 'false'
   OR output->>'state' NOT IN('COMMITTED','NOT_YET_OBSERVED')
  THEN RAISE EXCEPTION 'G60C untrusted reconciliation'
   USING ERRCODE='G6014'; END IF;
 ELSE
  RAISE EXCEPTION 'G60C unsupported operation'
  USING ERRCODE='G6014';
 END IF;
 UPDATE public.mobility_stage_g60c_driver_proofs
 SET redeemed_at=pg_catalog.clock_timestamp() WHERE proof_hash=p.proof_hash;
 RETURN output;
END $fn$;

ALTER FUNCTION public.mobility_stage_g60c_driver_exchange_qa(uuid)
 OWNER TO mobility_g60c_definer_ci;
REVOKE CREATE ON SCHEMA public FROM mobility_g60c_definer_ci;
REVOKE ALL ON FUNCTION public.mobility_stage_g60c_driver_exchange_qa(uuid)
 FROM PUBLIC,anon,authenticated,service_role,
 mobility_g48_gateway_ci,mobility_g49_chat_gateway_ci,
 mobility_g56_driver_gateway_ci,mobility_g58f_exchange_ci,
 mobility_g58f_definer_ci,mobility_g60c_definer_ci;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g60c_driver_exchange_qa(uuid)
 TO mobility_g60c_execute_ci;
COMMIT;
