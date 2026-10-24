-- G58F / A46: QA-only issuer exchange, not a JWT trust provider or production migration.
-- PostgreSQL16 disposable only. No network, secrets, real identities, or public issuance.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR to_regprocedure('public.mobility_stage_g49_mint_owner_qa(uuid,uuid,bigint,text,text,uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g54_mint_owner_qa(uuid,uuid,bigint,text,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g56_mint_owner_qa(uuid,uuid,bigint,text,text,uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g56_inbox_mint_owner_qa(uuid,uuid,bigint)') IS NULL
 OR to_regprocedure('public.mobility_stage_g57b_mint_read_owner_qa(uuid,uuid,bigint,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G58F requires disposable full chat chain';
 END IF;
END $guard$;
BEGIN;
CREATE ROLE mobility_g58f_definer_ci NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE mobility_g58f_exchange_ci NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT USAGE ON SCHEMA public TO mobility_g58f_definer_ci, mobility_g58f_exchange_ci;
-- The DB superuser fixture, never a public RPC, may INSERT short-lived
-- independently attested data. This has NO real provider cryptographic evidence.
-- SQL consumes only an opaque random token; actor, role, iat and scope CANNOT
-- be supplied on the delegated exchange call.
CREATE TABLE public.mobility_stage_g58f_owner_attestations (
 proof_hash bytea PRIMARY KEY CHECK(pg_catalog.octet_length(proof_hash)=32),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 session_id uuid NOT NULL,
 token_iat_ms bigint NOT NULL CHECK(token_iat_ms BETWEEN 1 AND 9999999999999),
 operation text NOT NULL CHECK(operation IN
  ('CHAT_OPEN','CHAT_HISTORY','CHAT_READ','DRIVER_INBOX','DRIVER_HISTORY','DRIVER_MARK_VISIBLE')),
 service_kind text,
 service_id uuid,
 conversation_id uuid,
 issued_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 redeemed_at timestamptz,
 evidence_kind text NOT NULL DEFAULT 'QA_OWNER_ASSERTED_NO_PROVIDER'
  CHECK(evidence_kind='QA_OWNER_ASSERTED_NO_PROVIDER'),
 CHECK(expires_at>issued_at AND expires_at<=issued_at+interval '15 seconds'),
 CHECK(redeemed_at IS NULL OR redeemed_at>=issued_at),
 CHECK(
  (operation='CHAT_OPEN' AND service_kind IN ('RIDE','DELIVERY','MERCHANT_ORDER')
   AND service_id IS NOT NULL AND conversation_id IS NULL)
  OR (operation IN ('CHAT_HISTORY','DRIVER_HISTORY')
   AND service_kind IN ('RIDE','DELIVERY','MERCHANT_ORDER')
   AND service_id IS NOT NULL AND conversation_id IS NOT NULL)
  OR (operation IN ('CHAT_READ','DRIVER_MARK_VISIBLE')
   AND service_kind IS NULL AND service_id IS NULL AND conversation_id IS NOT NULL)
  OR (operation='DRIVER_INBOX'
   AND service_kind IS NULL AND service_id IS NULL AND conversation_id IS NULL)
 )
);
CREATE INDEX mobility_stage_g58f_attestation_gc
 ON public.mobility_stage_g58f_owner_attestations(expires_at);
ALTER TABLE public.mobility_stage_g58f_owner_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g58f_owner_attestations OWNER TO mobility_g58f_definer_ci;
REVOKE ALL ON public.mobility_stage_g58f_owner_attestations
 FROM PUBLIC,anon,authenticated,service_role,
 mobility_g48_gateway_ci,mobility_g49_chat_gateway_ci,
 mobility_g56_driver_gateway_ci,mobility_g58f_exchange_ci;
-- Only these existing, owner-only methods can be delegated to the isolated
-- G58F definer. The exchange caller DOES NOT inherit any of those rights.
GRANT EXECUTE ON FUNCTION
 public.mobility_stage_g42_lock_session(uuid,uuid,bigint),
 public.mobility_stage_g49_mint_owner_qa(uuid,uuid,bigint,text,text,uuid,uuid),
 public.mobility_stage_g54_mint_owner_qa(uuid,uuid,bigint,text,uuid),
 public.mobility_stage_g56_mint_owner_qa(uuid,uuid,bigint,text,text,uuid,uuid),
 public.mobility_stage_g56_inbox_mint_owner_qa(uuid,uuid,bigint),
 public.mobility_stage_g57b_mint_read_owner_qa(uuid,uuid,bigint,uuid)
 TO mobility_g58f_definer_ci;
CREATE FUNCTION public.mobility_stage_g58f_exchange_attestation_qa(
 _proof uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
 SET search_path=''
AS $fn$
DECLARE a public.mobility_stage_g58f_owner_attestations%ROWTYPE;
 issued jsonb;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G58F DISABLED outside disposable QA' USING ERRCODE='G5801'; END IF;
 SELECT * INTO a FROM public.mobility_stage_g58f_owner_attestations
 WHERE proof_hash=pg_catalog.sha256(pg_catalog.convert_to(_proof::text,'UTF8'))
 FOR UPDATE;
 IF NOT FOUND OR a.redeemed_at IS NOT NULL OR
  a.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G58F absent, spent or expired attestation' USING ERRCODE='G5802'; END IF;
 -- The G42 share-lock lasts through COMMIT. A competing revoke UPDATE waits.
 -- A token from a previous session/iat cannot mint after revocation.
 IF NOT public.mobility_stage_g42_lock_session(
    a.actor_id,a.session_id,a.token_iat_ms)
 THEN RAISE EXCEPTION 'G58F revoked or invalid provider session' USING ERRCODE='G5803'; END IF;
 CASE a.operation
  WHEN 'CHAT_OPEN','CHAT_HISTORY' THEN
   issued:=public.mobility_stage_g49_mint_owner_qa(
    a.actor_id,a.session_id,a.token_iat_ms,a.operation,
    a.service_kind,a.service_id,a.conversation_id);
  WHEN 'CHAT_READ' THEN
   issued:=public.mobility_stage_g54_mint_owner_qa(
    a.actor_id,a.session_id,a.token_iat_ms,'CHAT_READ',a.conversation_id);
  WHEN 'DRIVER_INBOX' THEN
   issued:=public.mobility_stage_g56_inbox_mint_owner_qa(
    a.actor_id,a.session_id,a.token_iat_ms);
  WHEN 'DRIVER_HISTORY' THEN
   issued:=public.mobility_stage_g56_mint_owner_qa(
    a.actor_id,a.session_id,a.token_iat_ms,'DRIVER_HISTORY',
    a.service_kind,a.service_id,a.conversation_id);
  WHEN 'DRIVER_MARK_VISIBLE' THEN
   issued:=public.mobility_stage_g57b_mint_read_owner_qa(
    a.actor_id,a.session_id,a.token_iat_ms,a.conversation_id);
  ELSE RAISE EXCEPTION 'G58F unsupported operation' USING ERRCODE='G5804';
 END CASE;
 IF issued IS NULL OR issued->>'operation' IS DISTINCT FROM a.operation
 OR issued->>'qaOnly' IS DISTINCT FROM 'true'
 OR issued->>'productionEnabled' IS DISTINCT FROM 'false'
 OR issued->>'ticket' IS NULL
 THEN RAISE EXCEPTION 'G58F underlying ticket not QA safe' USING ERRCODE='G5804'; END IF;
 UPDATE public.mobility_stage_g58f_owner_attestations
 SET redeemed_at=pg_catalog.clock_timestamp() WHERE proof_hash=a.proof_hash;
 RETURN issued;
END $fn$;
-- IMPORTANT: dedicated function OWNER is a restricted NOLOGIN role, NOT qore_ci.
ALTER FUNCTION public.mobility_stage_g58f_exchange_attestation_qa(uuid)
 OWNER TO mobility_g58f_definer_ci;
REVOKE ALL ON FUNCTION public.mobility_stage_g58f_exchange_attestation_qa(uuid)
 FROM PUBLIC,anon,authenticated,service_role,
 mobility_g48_gateway_ci,mobility_g49_chat_gateway_ci,
 mobility_g56_driver_gateway_ci,mobility_g58f_definer_ci;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g58f_exchange_attestation_qa(uuid)
 TO mobility_g58f_exchange_ci;
COMMIT;
