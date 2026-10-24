-- G67 / A56 — immutable synthetic delivery evidence, verified within G5 COMMIT.
-- PostgreSQL16 qore_disposable_chain ONLY; NEVER run on remote databases.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR to_regprocedure('public.mobility_stage_delivery_transition(uuid,uuid,text,uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g37_state_integrity()') IS NULL
 THEN RAISE EXCEPTION 'G67 refuses non-disposable/incomplete chain'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_g67_delivery_proofs (
 proof_ref uuid PRIMARY KEY,
 delivery_id uuid NOT NULL UNIQUE REFERENCES public.mobility_stage_deliveries(id) ON DELETE RESTRICT,
 courier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 session_id uuid NOT NULL,
 token_iat_ms bigint NOT NULL CHECK(token_iat_ms BETWEEN 0 AND 9999999999999),
 content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[a-f0-9]{64}$'),
 mime text NOT NULL CHECK(mime IN ('image/jpeg','image/png','application/pdf')),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
 provider_kind text NOT NULL CHECK(provider_kind='QA_SERVER_ATTESTED_NO_CONTENT'),
 attested_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 consumed_at timestamptz,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 CHECK (expires_at>attested_at AND expires_at<=attested_at+interval '15 minutes'),
 CHECK (consumed_at IS NULL OR revoked_at IS NULL),
 CHECK (revoked_at IS NULL OR revoked_at>=attested_at),
 CHECK (consumed_at IS NULL OR consumed_at>=attested_at)
);
CREATE INDEX mobility_stage_g67_courier_lookup
 ON public.mobility_stage_g67_delivery_proofs(courier_id,delivery_id);
ALTER TABLE public.mobility_stage_g67_delivery_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g67_delivery_proofs
 FROM PUBLIC,anon,authenticated,service_role;
-- No direct writes, SELECT, DELETE or EXECUTE for client, public gateway or service role.
CREATE FUNCTION public.mobility_stage_g67_register_proof_owner_qa(
 _delivery uuid,_courier uuid,_session uuid,_iat_ms bigint,_proof uuid,
 _sha256 text,_mime text,_bytes bigint,_expires_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE d public.mobility_stage_deliveries%ROWTYPE;
BEGIN
 IF _proof IS NULL OR _delivery IS NULL OR _courier IS NULL OR _session IS NULL
 OR _iat_ms IS NULL OR _sha256 !~ '^[a-f0-9]{64}$'
 OR _mime NOT IN ('image/jpeg','image/png','application/pdf')
 OR _bytes NOT BETWEEN 1 AND 10485760
 OR _expires_at<=pg_catalog.clock_timestamp()
 OR _expires_at>pg_catalog.clock_timestamp()+interval '15 minutes'
 THEN RAISE EXCEPTION 'G67 invalid server-only synthetic attestation'
  USING ERRCODE='G6701'; END IF;
 IF NOT public.mobility_stage_g42_lock_session(_courier,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G67 session revoked' USING ERRCODE='G6702'; END IF;
 SELECT * INTO d FROM public.mobility_stage_deliveries
 WHERE id=_delivery FOR UPDATE;
 IF NOT FOUND OR d.status<>'picked_up' OR d.courier_id<>_courier
 OR d.proof_ref IS NOT NULL
 THEN RAISE EXCEPTION 'G67 no current courier custody'
  USING ERRCODE='G6703'; END IF;
 INSERT INTO public.mobility_stage_g67_delivery_proofs(
  proof_ref,delivery_id,courier_id,session_id,token_iat_ms,
  content_sha256,mime,size_bytes,provider_kind,expires_at)
 VALUES(_proof,_delivery,_courier,_session,_iat_ms,
  _sha256,_mime,_bytes,'QA_SERVER_ATTESTED_NO_CONTENT',_expires_at);
 RETURN _proof;
END $body$;
CREATE FUNCTION public.mobility_stage_g67_revoke_proof_owner_qa(
 _proof uuid,_delivery uuid
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE changed integer;
BEGIN
 -- Never revoke a proof that has already committed a delivery.
 UPDATE public.mobility_stage_g67_delivery_proofs
 SET revoked_at=pg_catalog.clock_timestamp(),revision=revision+1
 WHERE proof_ref=_proof AND delivery_id=_delivery
  AND revoked_at IS NULL AND consumed_at IS NULL;
 GET DIAGNOSTICS changed=ROW_COUNT;
 RETURN changed=1;
END $body$;
CREATE FUNCTION public.mobility_stage_g67_proof_verified_owner_qa(
 _delivery uuid,_courier uuid,_proof uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $body$
 SELECT COALESCE(EXISTS(
 SELECT 1 FROM public.mobility_stage_g67_delivery_proofs p
 JOIN public.mobility_stage_deliveries d
 ON d.id=p.delivery_id AND d.courier_id=p.courier_id
 WHERE p.delivery_id=_delivery AND p.courier_id=_courier
 AND p.proof_ref=_proof AND p.revoked_at IS NULL
 AND ((p.consumed_at IS NULL
 AND p.expires_at>pg_catalog.clock_timestamp()
 AND d.status='picked_up') OR
 (p.consumed_at IS NOT NULL AND d.proof_ref=_proof AND
 d.status IN ('delivered','disputed','returned')))
 ),false)
$body$;

-- CRITICAL: fired by EVERY G5 UPDATE picked_up -> delivered, including legacy
-- service_role RPC. Thus preflight outside SQL CANNOT forge a proof UUID.
-- The row is already held FOR UPDATE by G5; lock proof FOR UPDATE and
-- session G42 in the SAME transaction; any event INSERT failure rolls back.
CREATE FUNCTION public.mobility_stage_g67_enforce_delivery_proof()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $body$
DECLARE p public.mobility_stage_g67_delivery_proofs%ROWTYPE;
BEGIN
 IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME<>'mobility_stage_deliveries'
 OR TG_OP<>'UPDATE'
 THEN RAISE EXCEPTION 'G67 trigger origin denied' USING ERRCODE='G6704'; END IF;
 IF OLD.status='picked_up' AND NEW.status='delivered' THEN
  IF NEW.proof_ref IS NULL OR NEW.courier_id IS DISTINCT FROM OLD.courier_id
  THEN RAISE EXCEPTION 'G67 missing or changed courier proof'
   USING ERRCODE='G6704'; END IF;
  SELECT * INTO p FROM public.mobility_stage_g67_delivery_proofs
  WHERE proof_ref=NEW.proof_ref FOR UPDATE;
  IF NOT FOUND OR p.delivery_id<>OLD.id OR p.courier_id<>OLD.courier_id
   OR p.revoked_at IS NOT NULL OR p.consumed_at IS NOT NULL
   OR p.expires_at<=pg_catalog.clock_timestamp()
   OR p.provider_kind<>'QA_SERVER_ATTESTED_NO_CONTENT'
  THEN RAISE EXCEPTION 'G67 unverified or expired delivery proof'
   USING ERRCODE='G6704'; END IF;
  IF NOT public.mobility_stage_g42_lock_session(
   p.courier_id,p.session_id,p.token_iat_ms)
  THEN RAISE EXCEPTION 'G67 proof session revoked'
   USING ERRCODE='G6702'; END IF;
  UPDATE public.mobility_stage_g67_delivery_proofs
   SET consumed_at=pg_catalog.clock_timestamp(),revision=revision+1
   WHERE proof_ref=p.proof_ref AND consumed_at IS NULL AND revoked_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'G67 proof reuse denied'
   USING ERRCODE='G6704'; END IF;
 END IF;
 RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION public.mobility_stage_g67_register_proof_owner_qa(
 uuid,uuid,uuid,bigint,uuid,text,text,bigint,timestamptz)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g67_revoke_proof_owner_qa(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g67_proof_verified_owner_qa(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g67_enforce_delivery_proof()
 FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER mobility_stage_g67_proof_at_commit
 BEFORE UPDATE OF status,proof_ref ON public.mobility_stage_deliveries
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g67_enforce_delivery_proof();
COMMIT;
