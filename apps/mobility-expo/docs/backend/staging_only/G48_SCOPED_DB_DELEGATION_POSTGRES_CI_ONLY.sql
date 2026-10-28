-- QORE G48/A29 — ONLY disposable PostgreSQL: delegated one-use DB operation
-- capabilities for narrowly scoped Driver reads and Buyer catalog QA.
-- NOT an Auth provider bridge, identity issuer, remote API or LIVE migration.
-- No service_role rights; a NONLOGIN role can execute only these read wrappers.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR to_regprocedure('public.mobility_stage_g47_probe_lease_qa(uuid,uuid,bigint,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g44_buyer_catalog_page(uuid,uuid,bigint,uuid,bigint,uuid,integer)') IS NULL
 OR to_regclass('public.mobility_stage_driver_documents') IS NULL
 THEN RAISE EXCEPTION 'G48 refuses non-disposable or incomplete G42/G44/G47 chain'; END IF;
END $guard$;
BEGIN;
CREATE ROLE mobility_g48_gateway_ci NOLOGIN NOINHERIT NOSUPERUSER
 NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT USAGE ON SCHEMA public TO mobility_g48_gateway_ci;

CREATE TABLE public.mobility_stage_g48_delegation_proofs (
 ticket_hash bytea PRIMARY KEY CHECK(octet_length(ticket_hash)=32),
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 session_id uuid NOT NULL,
 token_iat_ms bigint NOT NULL CHECK(token_iat_ms BETWEEN 0 AND 9999999999999),
 purpose text NOT NULL CHECK(purpose IN
  ('DRIVER_STATUS','DRIVER_LEASE_PROBE','BUYER_CATALOG_PAGE')),
 resource_id uuid NOT NULL,
 issued_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 evidence_kind text NOT NULL DEFAULT 'QA_SYNTHETIC_OWNER_ATTESTATION_ONLY'
  CHECK(evidence_kind='QA_SYNTHETIC_OWNER_ATTESTATION_ONLY'),
 CHECK(consumed_at IS NULL OR consumed_at>=issued_at)
);
CREATE INDEX mobility_stage_g48_expired_ticket_gc
 ON public.mobility_stage_g48_delegation_proofs(expires_at);
CREATE TABLE public.mobility_stage_g48_ticket_audit (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 ticket_hash bytea NOT NULL REFERENCES public.mobility_stage_g48_delegation_proofs(ticket_hash),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 action text NOT NULL CHECK(action IN('MINTED','CONSUMED')),
 purpose text NOT NULL CHECK(purpose IN
  ('DRIVER_STATUS','DRIVER_LEASE_PROBE','BUYER_CATALOG_PAGE')),
 recorded_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 UNIQUE(ticket_hash,action)
);
ALTER TABLE public.mobility_stage_g48_delegation_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g48_ticket_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g48_delegation_proofs,
 public.mobility_stage_g48_ticket_audit
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci;

CREATE FUNCTION public.mobility_stage_g48_ticket_audit_immutable()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 RAISE EXCEPTION 'G48 immutable ticket audit' USING ERRCODE='G4807';
END $fn$;
CREATE TRIGGER g48_no_ticket_audit_mutations BEFORE UPDATE OR DELETE
 ON public.mobility_stage_g48_ticket_audit FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g48_ticket_audit_immutable();

-- OWNER-ONLY synthetic attestation mint. Its UUID arguments NEVER come from
-- public HTTP. A real JWT verification + provider session authority is not
-- wired to this module. The non-login gateway role cannot mint proofs.
CREATE FUNCTION public.mobility_stage_g48_mint_owner_attested_qa(
 _actor uuid,_session uuid,_iat_ms bigint,_purpose text,_resource uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE ticket uuid:=pg_catalog.gen_random_uuid(); digest bytea;
 good boolean:=false; expires timestamptz;
BEGIN
 IF _actor IS NULL OR _session IS NULL OR _iat_ms IS NULL
 OR _resource IS NULL OR _purpose IS NULL
 OR _purpose NOT IN('DRIVER_STATUS','DRIVER_LEASE_PROBE','BUYER_CATALOG_PAGE')
 OR NOT public.mobility_stage_g42_lock_session(_actor,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G48 unverified owner attestation session'
  USING ERRCODE='G4801'; END IF;
 IF _purpose IN('DRIVER_STATUS','DRIVER_LEASE_PROBE') THEN
  good:=(SELECT count(*) FROM public.user_roles r WHERE r.user_id=_actor)=1
   AND EXISTS(SELECT 1 FROM public.user_roles r
    WHERE r.user_id=_actor AND r.role='driver'::public.app_role);
  IF _purpose='DRIVER_STATUS' THEN good:=good AND _resource=_actor;
  ELSE
   good:=good AND EXISTS(SELECT 1 FROM public.mobility_stage_g47_access_leases l
     WHERE l.id=_resource AND l.actor_id=_actor
       AND l.session_id=_session AND l.purpose='DRIVER_SELF_VIEW'
       AND l.revoked_at IS NULL AND l.expires_at>pg_catalog.clock_timestamp());
  END IF;
 ELSIF _purpose='BUYER_CATALOG_PAGE' THEN
  good:=(SELECT count(*) FROM public.user_roles r WHERE r.user_id=_actor)=1
   AND EXISTS(SELECT 1 FROM public.user_roles r
    WHERE r.user_id=_actor AND r.role='passenger'::public.app_role);
 END IF;
 IF NOT good THEN RAISE EXCEPTION 'G48 role or resource out of scope'
  USING ERRCODE='G4803'; END IF;
 digest:=pg_catalog.sha256(pg_catalog.convert_to(ticket::text,'UTF8'));
 expires:=pg_catalog.clock_timestamp()+interval '30 seconds';
 INSERT INTO public.mobility_stage_g48_delegation_proofs(
  ticket_hash,actor_id,session_id,token_iat_ms,purpose,resource_id,expires_at
 ) VALUES(digest,_actor,_session,_iat_ms,_purpose,_resource,expires);
 INSERT INTO public.mobility_stage_g48_ticket_audit(
   ticket_hash,actor_id,action,purpose
 ) VALUES(digest,_actor,'MINTED',_purpose);
 RETURN pg_catalog.jsonb_build_object('ticket',ticket,
  'expiresAtMs',floor(extract(epoch FROM expires)*1000)::bigint,
  'purpose',_purpose,'delegationKind','QA_OWNER_ONLY_NOT_JWT_BOUND',
  'productionEnabled',false);
END $fn$;

-- Fully private shared checker. The caller submits only an opaque ticket,
-- NEVER actor/user/session/role. Proof is single-use and bound to G42 session
-- row in the SAME DB transaction as the protected read.
CREATE FUNCTION public.mobility_stage_g48_consume_ticket_qa(
 _ticket uuid,_purpose text
) RETURNS public.mobility_stage_g48_delegation_proofs
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE proof public.mobility_stage_g48_delegation_proofs%ROWTYPE;
 valid_role boolean:=false;
BEGIN
 IF _ticket IS NULL OR _purpose NOT IN
 ('DRIVER_STATUS','DRIVER_LEASE_PROBE','BUYER_CATALOG_PAGE')
 THEN RAISE EXCEPTION 'G48 invalid scoped proof' USING ERRCODE='G4801'; END IF;
 SELECT * INTO proof FROM public.mobility_stage_g48_delegation_proofs
 WHERE ticket_hash=pg_catalog.sha256(pg_catalog.convert_to(_ticket::text,'UTF8'))
 FOR UPDATE;
 IF NOT FOUND OR proof.purpose<>_purpose
 THEN RAISE EXCEPTION 'G48 wrong purpose or forged proof' USING ERRCODE='G4803'; END IF;
 IF proof.consumed_at IS NOT NULL OR proof.expires_at<=pg_catalog.clock_timestamp()
 THEN RAISE EXCEPTION 'G48 consumed or expired proof' USING ERRCODE='G4804'; END IF;
 IF NOT public.mobility_stage_g42_lock_session(proof.actor_id,proof.session_id,
    proof.token_iat_ms)
 THEN RAISE EXCEPTION 'G48 provider session revoked at transaction'
  USING ERRCODE='G4801'; END IF;
 IF _purpose IN('DRIVER_STATUS','DRIVER_LEASE_PROBE') THEN
  valid_role:=(SELECT count(*) FROM public.user_roles r
    WHERE r.user_id=proof.actor_id)=1
   AND EXISTS(SELECT 1 FROM public.user_roles r
    WHERE r.user_id=proof.actor_id AND r.role='driver'::public.app_role);
  IF _purpose='DRIVER_STATUS' THEN
   valid_role:=valid_role AND proof.resource_id=proof.actor_id;
  ELSE
   valid_role:=valid_role AND EXISTS(
    SELECT 1 FROM public.mobility_stage_g47_access_leases l
    WHERE l.id=proof.resource_id AND l.actor_id=proof.actor_id
     AND l.session_id=proof.session_id AND l.purpose='DRIVER_SELF_VIEW'
     AND l.revoked_at IS NULL AND l.expires_at>pg_catalog.clock_timestamp());
  END IF;
 ELSE
  valid_role:=(SELECT count(*) FROM public.user_roles r
    WHERE r.user_id=proof.actor_id)=1
   AND EXISTS(SELECT 1 FROM public.user_roles r
    WHERE r.user_id=proof.actor_id AND r.role='passenger'::public.app_role);
 END IF;
 IF NOT valid_role THEN RAISE EXCEPTION 'G48 role/resource revoked'
  USING ERRCODE='G4803'; END IF;
 UPDATE public.mobility_stage_g48_delegation_proofs
 SET consumed_at=pg_catalog.clock_timestamp()
 WHERE ticket_hash=proof.ticket_hash;
 INSERT INTO public.mobility_stage_g48_ticket_audit(
  ticket_hash,actor_id,action,purpose
 ) VALUES(proof.ticket_hash,proof.actor_id,'CONSUMED',_purpose);
 RETURN proof;
END $fn$;

CREATE FUNCTION public.mobility_stage_g48_driver_status_qa(_ticket uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE proof public.mobility_stage_g48_delegation_proofs%ROWTYPE;
 statuses jsonb;
BEGIN
 proof:=public.mobility_stage_g48_consume_ticket_qa(_ticket,'DRIVER_STATUS');
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'kind',kind,'status',status,
  'submittedAt',submitted_at,'reviewedAt',reviewed_at)), '[]'::jsonb)
 INTO statuses FROM public.mobility_stage_read_driver_document_status(proof.actor_id);
 RETURN pg_catalog.jsonb_build_object(
  'items',statuses,'source','QA_G48_DRIVER_STATUS_ONLY',
  'documentBytesAvailable',false,'signedUrlAvailable',false,
  'productionEnabled',false);
END $fn$;

CREATE FUNCTION public.mobility_stage_g48_driver_lease_probe_qa(_ticket uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE proof public.mobility_stage_g48_delegation_proofs%ROWTYPE;
 result jsonb;
BEGIN
 proof:=public.mobility_stage_g48_consume_ticket_qa(_ticket,'DRIVER_LEASE_PROBE');
 result:=public.mobility_stage_g47_probe_lease_qa(
  proof.actor_id,proof.session_id,proof.token_iat_ms,proof.resource_id);
 IF result IS NULL OR result->>'signedUrlAvailable'<>'false'
 OR result->>'documentBytesAvailable'<>'false'
 OR result->>'productionEnabled'<>'false'
 THEN RAISE EXCEPTION 'G48 unsafe G47 result' USING ERRCODE='G4803'; END IF;
 RETURN result;
END $fn$;

CREATE FUNCTION public.mobility_stage_g48_buyer_catalog_page_qa(
 _ticket uuid,_expected_revision bigint,_after uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE proof public.mobility_stage_g48_delegation_proofs%ROWTYPE;
 result jsonb;
BEGIN
 IF (_after IS NOT NULL AND _expected_revision IS NULL)
 OR (_expected_revision IS NOT NULL AND _expected_revision<1)
 THEN RAISE EXCEPTION 'G48 catalog version required after first page'
  USING ERRCODE='G4803'; END IF;
 proof:=public.mobility_stage_g48_consume_ticket_qa(
  _ticket,'BUYER_CATALOG_PAGE');
 result:=public.mobility_stage_g44_buyer_catalog_page(
  proof.actor_id,proof.session_id,proof.token_iat_ms,
  proof.resource_id,_expected_revision,_after,100);
 IF result IS NULL OR result->>'orderEnabled'<>'false'
 OR result->>'eligibleByPolicy'<>'false'
 THEN RAISE EXCEPTION 'G48 unsafe G44 result' USING ERRCODE='G4803'; END IF;
 RETURN result || pg_catalog.jsonb_build_object(
  'source','QA_G48_SCOPED_CATALOG_ONLY','productionEnabled',false);
END $fn$;

REVOKE ALL ON FUNCTION public.mobility_stage_g48_ticket_audit_immutable()
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci;
REVOKE ALL ON FUNCTION public.mobility_stage_g48_mint_owner_attested_qa(
 uuid,uuid,bigint,text,uuid)
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci;
REVOKE ALL ON FUNCTION public.mobility_stage_g48_consume_ticket_qa(uuid,text)
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci;
REVOKE ALL ON FUNCTION public.mobility_stage_g48_driver_status_qa(uuid)
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci;
REVOKE ALL ON FUNCTION public.mobility_stage_g48_driver_lease_probe_qa(uuid)
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci;
REVOKE ALL ON FUNCTION public.mobility_stage_g48_buyer_catalog_page_qa(
 uuid,bigint,uuid)
 FROM PUBLIC,anon,authenticated,service_role,mobility_g48_gateway_ci;

-- ONLY narrow execute. This role can neither log in, mint/consume tickets
-- independently, read proof tables, nor call the legacy G6/G9/G17 RPCs.
GRANT EXECUTE ON FUNCTION public.mobility_stage_g48_driver_status_qa(uuid)
 TO mobility_g48_gateway_ci;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g48_driver_lease_probe_qa(uuid)
 TO mobility_g48_gateway_ci;
GRANT EXECUTE ON FUNCTION public.mobility_stage_g48_buyer_catalog_page_qa(
 uuid,bigint,uuid) TO mobility_g48_gateway_ci;
COMMIT;
