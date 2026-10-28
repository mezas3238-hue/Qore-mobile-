-- G69/A58 single-use Passenger sender-custody SQL exchange.
-- PostgreSQL16 disposable only; no deployed IdP/HTTPS or external proof mint.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g68_sender_custody_owner_qa(uuid,uuid,bigint,uuid)') IS NULL
 THEN RAISE EXCEPTION 'G69 requires disposable G68' USING ERRCODE='G6901'; END IF;
END $guard$;
BEGIN;
CREATE ROLE mobility_g69_definer_ci NOLOGIN NOINHERIT
 NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE mobility_g69_execute_ci NOLOGIN NOINHERIT
 NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT USAGE ON SCHEMA public TO mobility_g69_definer_ci,mobility_g69_execute_ci;
GRANT CREATE ON SCHEMA public TO mobility_g69_definer_ci;

CREATE TABLE public.mobility_stage_g69_sender_read_proofs (
 proof_hash bytea PRIMARY KEY CHECK(pg_catalog.octet_length(proof_hash)=32),
 sender_id uuid NOT NULL REFERENCES auth.users(id),
 session_id uuid NOT NULL,
 token_iat_ms bigint NOT NULL CHECK(token_iat_ms BETWEEN 1 AND 9999999999999),
 delivery_id uuid NOT NULL,
 issued_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 redeemed_at timestamptz,
 evidence_kind text NOT NULL DEFAULT 'QA_OWNER_VERIFIED_SESSION_NO_LIVE_IDP'
  CHECK(evidence_kind='QA_OWNER_VERIFIED_SESSION_NO_LIVE_IDP'),
 CHECK(expires_at>issued_at AND expires_at<=issued_at+interval '12 seconds'),
 CHECK(redeemed_at IS NULL OR redeemed_at>=issued_at)
);
CREATE INDEX mobility_stage_g69_sender_proof_expiry
 ON public.mobility_stage_g69_sender_read_proofs(expires_at);
ALTER TABLE public.mobility_stage_g69_sender_read_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g69_sender_read_proofs OWNER TO mobility_g69_definer_ci;
REVOKE ALL ON public.mobility_stage_g69_sender_read_proofs
 FROM PUBLIC,anon,authenticated,service_role,
 mobility_g48_gateway_ci,mobility_g49_chat_gateway_ci,
 mobility_g56_driver_gateway_ci,mobility_g60c_execute_ci,
 mobility_g60c_definer_ci,mobility_g69_execute_ci;
-- The only member able to read or mutate proof rows is its dedicated definer.
-- Owner seeds synthetic rows in CI; there is deliberately NO mint API/route.
GRANT EXECUTE ON FUNCTION
 public.mobility_stage_g68_sender_custody_owner_qa(uuid,uuid,bigint,uuid)
 TO mobility_g69_definer_ci;

CREATE FUNCTION public.mobility_stage_g69_sender_exchange_qa(_proof uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE STRICT
 SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 p public.mobility_stage_g69_sender_read_proofs%ROWTYPE;
 dto jsonb;
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G69 exchange is CI ONLY' USING ERRCODE='G6901'; END IF;
 SELECT * INTO p
 FROM public.mobility_stage_g69_sender_read_proofs
 WHERE proof_hash=pg_catalog.sha256(
  pg_catalog.convert_to(_proof::text,'UTF8'))
 FOR UPDATE;
 IF NOT FOUND OR p.redeemed_at IS NOT NULL
 OR p.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G69 missing, expired or spent proof'
  USING ERRCODE='G6902'; END IF;
 -- G68 checks G42 session WITH LOCK, exclusively Passenger role,
 -- delivery_id AND sender_id SQL predicates, and G67 verified proof.
 dto:=public.mobility_stage_g68_sender_custody_owner_qa(
  p.sender_id,p.session_id,p.token_iat_ms,p.delivery_id);
 IF dto IS NULL OR pg_catalog.jsonb_typeof(dto)<>'object'
 OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(dto))<>11
 OR dto->>'deliveryId' IS DISTINCT FROM p.delivery_id::text
 OR dto->>'ownerId' IS DISTINCT FROM p.sender_id::text
 OR dto->>'mode' IS DISTINCT FROM 'STAGING_DEMO_ONLY'
 OR dto->>'qaOnly' IS DISTINCT FROM 'true'
 OR dto->>'productionEnabled' IS DISTINCT FROM 'false'
 OR dto->>'liveDeliveriesEnabled' IS DISTINCT FROM 'false'
 OR dto->>'state' NOT IN
 ('requested','accepted','picked_up','delivered','disputed','returned','cancelled')
 OR dto ?| ARRAY['proofRef','courierId','vehicleId','phone','gps','content_sha256']
 THEN RAISE EXCEPTION 'G69 untrusted private sender DTO'
  USING ERRCODE='G6903'; END IF;
 UPDATE public.mobility_stage_g69_sender_read_proofs
 SET redeemed_at=pg_catalog.clock_timestamp()
 WHERE proof_hash=p.proof_hash AND redeemed_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'G69 replay denied' USING ERRCODE='G6902'; END IF;
 RETURN dto;
END $fn$;
ALTER FUNCTION public.mobility_stage_g69_sender_exchange_qa(uuid)
 OWNER TO mobility_g69_definer_ci;
REVOKE CREATE ON SCHEMA public FROM mobility_g69_definer_ci;
REVOKE ALL ON FUNCTION public.mobility_stage_g69_sender_exchange_qa(uuid)
 FROM PUBLIC,anon,authenticated,service_role,
 mobility_g48_gateway_ci,mobility_g49_chat_gateway_ci,
 mobility_g56_driver_gateway_ci,mobility_g60c_execute_ci,
 mobility_g60c_definer_ci,mobility_g69_definer_ci;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g69_sender_exchange_qa(uuid)
 TO mobility_g69_execute_ci;
COMMIT;
