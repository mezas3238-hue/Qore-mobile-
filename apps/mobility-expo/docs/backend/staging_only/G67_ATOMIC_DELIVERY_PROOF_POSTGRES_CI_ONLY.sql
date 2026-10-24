-- QORE G67 / A56: authoritative synthetic proof registry for cargo delivery.
-- PostgreSQL 16 disposable CI ONLY. Never apply to remote STAGING or production.
-- No bytes, photographs, users, KYC or live storage. Only database OWNER may mint/revoke.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regclass('public.mobility_stage_deliveries') IS NULL
 OR to_regclass('public.mobility_stage_delivery_events') IS NULL
 OR to_regprocedure('public.mobility_stage_delivery_transition(uuid,uuid,text,uuid,uuid)') IS NULL
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 THEN RAISE EXCEPTION 'G67 refuses non-disposable/incomplete chain'; END IF;
END $guard$;
BEGIN;

CREATE TABLE public.mobility_stage_g67_delivery_proofs (
 proof_ref uuid PRIMARY KEY,
 delivery_id uuid NOT NULL REFERENCES public.mobility_stage_deliveries(id) ON DELETE RESTRICT,
 courier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 evidence_kind text NOT NULL CHECK(evidence_kind IN ('PHOTO','SIGNATURE')),
 content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[a-f0-9]{64}$'),
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 5242880),
 mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png')),
 reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'verified'
  CHECK(status IN ('verified','revoked','consumed')),
 revoked_at timestamptz,
 consumed_at timestamptz,
 consumed_revision bigint,
 CHECK(expires_at>issued_at AND expires_at<=issued_at+interval '15 minutes'),
 CHECK((status='verified' AND revoked_at IS NULL AND consumed_at IS NULL AND consumed_revision IS NULL)
    OR (status='revoked' AND revoked_at IS NOT NULL AND consumed_at IS NULL AND consumed_revision IS NULL)
    OR (status='consumed' AND revoked_at IS NULL AND consumed_at IS NOT NULL AND consumed_revision>0)),
 CHECK(reviewer_id<>courier_id),
 UNIQUE(proof_ref,delivery_id,courier_id)
);
CREATE INDEX mobility_stage_g67_delivery_proofs_by_delivery
 ON public.mobility_stage_g67_delivery_proofs(delivery_id);
CREATE TABLE public.mobility_stage_g67_delivery_proof_audit (
 audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 proof_ref uuid NOT NULL REFERENCES public.mobility_stage_g67_delivery_proofs(proof_ref) ON DELETE RESTRICT,
 event text NOT NULL CHECK(event IN ('REGISTER','REVOKE','CONSUME')),
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 delivery_revision bigint,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.mobility_stage_g67_delivery_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g67_delivery_proofs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g67_delivery_proof_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g67_delivery_proof_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g67_delivery_proofs,public.mobility_stage_g67_delivery_proof_audit
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE public.mobility_stage_g67_delivery_proof_audit_audit_id_seq
 FROM PUBLIC,anon,authenticated,service_role;

-- Only the trusted DB owner/test harness calls this registrar, never the phone,
-- service_role, Gateway or a bearer-token client. Synthetic metadata is not real proof.
CREATE FUNCTION public.mobility_stage_g67_register_proof_qa(
 _ref uuid,_delivery uuid,_courier uuid,_kind text,_sha text,
 _size integer,_mime text,_reviewer uuid,_expiry timestamptz
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE d public.mobility_stage_deliveries%ROWTYPE; issued timestamptz;
BEGIN
 issued:=clock_timestamp();
 SELECT * INTO d FROM public.mobility_stage_deliveries WHERE id=_delivery FOR UPDATE;
 IF NOT FOUND OR d.status<>'picked_up' OR d.courier_id IS DISTINCT FROM _courier
 OR d.sender_id=_reviewer OR _reviewer=_courier OR _ref IS NULL
 OR _kind NOT IN ('PHOTO','SIGNATURE') OR _sha !~ '^[a-f0-9]{64}$'
 OR _size NOT BETWEEN 1 AND 5242880 OR _mime NOT IN ('image/jpeg','image/png')
 OR _expiry IS NULL OR _expiry<=issued+interval '1 second'
 OR _expiry>issued+interval '15 minutes'
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
   WHERE user_id=_reviewer AND role='admin'::public.app_role)
 THEN RAISE EXCEPTION 'G67 untrusted or mismatched independent proof' USING ERRCODE='G6701'; END IF;
 INSERT INTO public.mobility_stage_g67_delivery_proofs
  (proof_ref,delivery_id,courier_id,evidence_kind,content_sha256,
   byte_size,mime_type,reviewer_id,issued_at,expires_at)
 VALUES(_ref,_delivery,_courier,_kind,_sha,_size,_mime,_reviewer,issued,_expiry);
 INSERT INTO public.mobility_stage_g67_delivery_proof_audit(proof_ref,event,actor_id)
 VALUES(_ref,'REGISTER',_reviewer);
 RETURN _ref;
END $fn$;

CREATE FUNCTION public.mobility_stage_g67_revoke_proof_qa(
 _ref uuid,_reviewer uuid
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE p public.mobility_stage_g67_delivery_proofs%ROWTYPE;
BEGIN
 SELECT * INTO p FROM public.mobility_stage_g67_delivery_proofs
 WHERE proof_ref=_ref FOR UPDATE;
 IF NOT FOUND OR p.status<>'verified' OR p.reviewer_id<>_reviewer
 THEN RAISE EXCEPTION 'G67 proof not revocable' USING ERRCODE='G6702'; END IF;
 UPDATE public.mobility_stage_g67_delivery_proofs
 SET status='revoked',revoked_at=clock_timestamp() WHERE proof_ref=_ref;
 INSERT INTO public.mobility_stage_g67_delivery_proof_audit(proof_ref,event,actor_id)
 VALUES(_ref,'REVOKE',_reviewer);
 RETURN true;
END $fn$;

-- Existing G5 delivery_transition() updates the delivery row and inserts the
-- event in ONE transaction. This trigger holds a proof row lock and consumes
-- it *during that UPDATE*, not in an earlier HTTP verifier (no TOCTOU).
-- Failed G5 receipt INSERT, forced rollback, revoked/expired/reused proof => all
-- rows roll back together. No extra EXECUTE grants or RPC overrides.
CREATE FUNCTION public.mobility_stage_g67_proof_atomic_guard()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE p public.mobility_stage_g67_delivery_proofs%ROWTYPE; at_time timestamptz;
BEGIN
 IF OLD.status='picked_up' AND NEW.status='delivered' THEN
  at_time:=clock_timestamp();
  SELECT * INTO p FROM public.mobility_stage_g67_delivery_proofs
   WHERE proof_ref=NEW.proof_ref FOR UPDATE;
  IF NOT FOUND OR p.delivery_id<>NEW.id
   OR p.courier_id IS DISTINCT FROM NEW.courier_id OR p.status<>'verified'
   OR p.expires_at<=at_time OR p.issued_at>at_time
   OR p.reviewer_id=NEW.sender_id OR p.reviewer_id=NEW.courier_id
   OR NOT EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id=p.reviewer_id AND role='admin'::public.app_role)
  THEN RAISE EXCEPTION 'G67 proof absent, invalid, expired or consumed'
    USING ERRCODE='G6703'; END IF;
  UPDATE public.mobility_stage_g67_delivery_proofs SET status='consumed',
   consumed_at=at_time,consumed_revision=NEW.revision WHERE proof_ref=p.proof_ref;
  INSERT INTO public.mobility_stage_g67_delivery_proof_audit
   (proof_ref,event,actor_id,delivery_revision)
  VALUES(p.proof_ref,'CONSUME',NEW.courier_id,NEW.revision);
 END IF;
 RETURN NEW;
END $fn$;

CREATE TRIGGER mobility_stage_g67_atomic_proof
 BEFORE UPDATE ON public.mobility_stage_deliveries FOR EACH ROW
 EXECUTE FUNCTION public.mobility_stage_g67_proof_atomic_guard();

-- At transaction end require the matching immutable G5 event receipt.
-- A direct UPDATE by an otherwise privileged DB role is not a delivery receipt.
CREATE FUNCTION public.mobility_stage_g67_committed_event_guard()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM public.mobility_stage_delivery_events e
  JOIN public.mobility_stage_g67_delivery_proofs p
   ON p.proof_ref=e.proof_ref
  WHERE e.delivery_id=NEW.id AND e.actor_id=NEW.courier_id
   AND e.action='deliver' AND e.next_status='delivered'
   AND e.delivery_revision=NEW.revision AND e.proof_ref=NEW.proof_ref
   AND p.status='consumed' AND p.consumed_revision=NEW.revision
 ) THEN RAISE EXCEPTION 'G67 deliver requires matching committed event'
  USING ERRCODE='G6704'; END IF;
 RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER mobility_stage_g67_delivery_event
 AFTER UPDATE ON public.mobility_stage_deliveries
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 WHEN (OLD.status='picked_up' AND NEW.status='delivered')
 EXECUTE FUNCTION public.mobility_stage_g67_committed_event_guard();

REVOKE ALL ON FUNCTION public.mobility_stage_g67_register_proof_qa(
 uuid,uuid,uuid,text,text,integer,text,uuid,timestamptz),
 public.mobility_stage_g67_revoke_proof_qa(uuid,uuid),
 public.mobility_stage_g67_proof_atomic_guard(),
 public.mobility_stage_g67_committed_event_guard()
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
