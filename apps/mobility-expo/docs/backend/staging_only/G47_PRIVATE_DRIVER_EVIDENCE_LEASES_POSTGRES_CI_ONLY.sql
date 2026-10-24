-- QORE G47/A28: private KYC evidence access leases and immutable audit.
-- PostgreSQL 16 disposable CI ONLY: metadata/synthetic HEAD attestations, no
-- uploaded bytes, genuine signed URLs, external Storage credentials or LIVE.
-- Requires G17 doc registry, G42 session row-lock and G46 commerce lockdown.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 OR to_regprocedure('public.mobility_stage_g42_lock_session(uuid,uuid,bigint)') IS NULL
 OR to_regclass('public.mobility_stage_driver_documents') IS NULL
 OR to_regclass('public.mobility_stage_merchant_management_events') IS NULL
 THEN RAISE EXCEPTION 'G47 refuses non-disposable or incomplete private Storage chain'; END IF;
END $guard$;
BEGIN;

-- Historical G17 INVOKER operations accept caller-supplied driver and admin IDs
-- and permit service_role to write metadata/reviews. Remove that privileged
-- shortcut BEFORE any real provider-signed Auth/RLS interface is considered.
REVOKE ALL ON public.mobility_stage_driver_documents,
 public.mobility_stage_driver_document_reviews
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_register_driver_document(
 uuid,uuid,public.mobility_stage_driver_document_kind,text,text,integer,text)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_review_driver_document(
 uuid,uuid,boolean,text,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_read_driver_document_status(uuid)
 FROM PUBLIC,anon,authenticated,service_role;

-- Non-sensitive storage HEAD metadata; the base G17 key is checked internally,
-- but never sent back to a driver, reviewer or browser.
CREATE TABLE public.mobility_stage_g47_attested_objects (
 document_id uuid PRIMARY KEY
  REFERENCES public.mobility_stage_driver_documents(id) ON DELETE RESTRICT,
 driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 sha256_hex text NOT NULL CHECK(sha256_hex ~ '^[0-9a-f]{64}$'),
 mime_type text NOT NULL CHECK(mime_type IN('image/jpeg','image/png')),
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 5242880),
 evidence_source text NOT NULL DEFAULT 'QA_SYNTHETIC_STORAGE_HEAD_ONLY'
  CHECK(evidence_source='QA_SYNTHETIC_STORAGE_HEAD_ONLY'),
 attested_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 quarantined_at timestamptz,
 CHECK(quarantined_at IS NULL OR quarantined_at>=attested_at)
);
CREATE TABLE public.mobility_stage_g47_access_leases (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 document_id uuid NOT NULL REFERENCES public.mobility_stage_driver_documents(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 session_id uuid NOT NULL,
 purpose text NOT NULL CHECK(purpose IN('DRIVER_SELF_VIEW','ADMIN_MANUAL_REVIEW')),
 issued_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 revoked_reason text CHECK(revoked_reason IN
  ('EXPIRED','REVIEW_CLOSED','OBJECT_QUARANTINED','SESSION_REVOKED')),
 CHECK(revoked_at IS NULL OR revoked_at>=issued_at),
 CHECK((revoked_at IS NULL AND revoked_reason IS NULL)
   OR (revoked_at IS NOT NULL AND revoked_reason IS NOT NULL))
);
CREATE INDEX mobility_stage_g47_lease_actor_active
 ON public.mobility_stage_g47_access_leases(actor_id,session_id,expires_at DESC)
 WHERE revoked_at IS NULL;
CREATE INDEX mobility_stage_g47_lease_document_active
 ON public.mobility_stage_g47_access_leases(document_id,expires_at DESC)
 WHERE revoked_at IS NULL;

CREATE TABLE public.mobility_stage_g47_access_audit (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 lease_id uuid NOT NULL REFERENCES public.mobility_stage_g47_access_leases(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 action text NOT NULL CHECK(action IN('ISSUED','REVOKED')),
 event_reason text NOT NULL CHECK(event_reason IN
  ('DRIVER_SELF_VIEW','ADMIN_MANUAL_REVIEW','EXPIRED',
   'REVIEW_CLOSED','OBJECT_QUARANTINED','SESSION_REVOKED')),
 recorded_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 UNIQUE(lease_id,action)
);
CREATE INDEX mobility_stage_g47_audit_history
 ON public.mobility_stage_g47_access_audit(lease_id,recorded_at DESC,id DESC);

ALTER TABLE public.mobility_stage_g47_attested_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g47_access_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_g47_access_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_g47_attested_objects,
 public.mobility_stage_g47_access_leases,
 public.mobility_stage_g47_access_audit
 FROM PUBLIC,anon,authenticated,service_role;

-- Append-only audit; even the DB owner cannot mutate/delete a previous event
-- through a normal SQL statement. Maintenance/DDL is separate and prohibited.
CREATE FUNCTION public.mobility_stage_g47_audit_no_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 RAISE EXCEPTION 'G47 immutable document access audit' USING ERRCODE='G4707';
END $fn$;
CREATE TRIGGER g47_immutable_access_audit BEFORE UPDATE OR DELETE
 ON public.mobility_stage_g47_access_audit
 FOR EACH ROW EXECUTE FUNCTION public.mobility_stage_g47_audit_no_mutation();

CREATE FUNCTION public.mobility_stage_g47_attest_object_qa(
 _document uuid,_driver uuid,_sha text,_mime text,_size integer
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE d public.mobility_stage_driver_documents%ROWTYPE;
BEGIN
 SELECT * INTO d FROM public.mobility_stage_driver_documents
 WHERE id=_document FOR SHARE;
 IF NOT FOUND OR d.driver_id IS DISTINCT FROM _driver
 OR d.sha256_hex IS DISTINCT FROM _sha
 OR d.mime_type IS DISTINCT FROM _mime
 OR d.byte_size IS DISTINCT FROM _size
 OR d.storage_bucket<>'mobility-staging-driver-evidence'
 OR d.object_key !~ ('^'||_driver::text||'/licencia-[A-Za-z0-9_-]{12,80}[.](jpg|jpeg|png)$')
 OR d.kind<>'licencia'::public.mobility_stage_driver_document_kind
 OR NOT EXISTS(SELECT 1 FROM public.user_roles
  WHERE user_id=_driver AND role='driver'::public.app_role)
 OR (SELECT count(*) FROM public.user_roles WHERE user_id=_driver)<>1
 THEN RAISE EXCEPTION 'G47 storage HEAD mismatch or unsupported evidence'
  USING ERRCODE='G4703'; END IF;
 INSERT INTO public.mobility_stage_g47_attested_objects(
  document_id,driver_id,sha256_hex,mime_type,byte_size
 ) VALUES(d.id,_driver,_sha,_mime,_size)
 ON CONFLICT(document_id) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM public.mobility_stage_g47_attested_objects a
    WHERE a.document_id=_document AND a.driver_id=_driver
    AND a.sha256_hex=_sha AND a.mime_type=_mime AND a.byte_size=_size
    AND a.quarantined_at IS NULL)
 THEN RAISE EXCEPTION 'G47 evidence quarantine or observation conflict'
  USING ERRCODE='G4703'; END IF;
 RETURN true;
END $fn$;

CREATE FUNCTION public.mobility_stage_g47_issue_lease_qa(
 _actor uuid,_session uuid,_iat_ms bigint,_document uuid,
 _request_key uuid,_purpose text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE d public.mobility_stage_driver_documents%ROWTYPE;
 prior public.mobility_stage_g47_access_leases%ROWTYPE;
 out_lease uuid; expire timestamptz; allowed boolean:=false;
BEGIN
 IF _actor IS NULL OR _session IS NULL OR _iat_ms IS NULL
 OR _document IS NULL OR _request_key IS NULL
 OR _purpose NOT IN('DRIVER_SELF_VIEW','ADMIN_MANUAL_REVIEW')
 OR NOT public.mobility_stage_g42_lock_session(_actor,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G47 unverified access session' USING ERRCODE='G4701'; END IF;
 -- One requestKey is always one immutable decision.
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(_request_key::text,4701));
 SELECT * INTO prior FROM public.mobility_stage_g47_access_leases
 WHERE request_key=_request_key;
 IF FOUND THEN
  IF prior.actor_id<>_actor OR prior.session_id<>_session
   OR prior.document_id<>_document OR prior.purpose<>_purpose
  THEN RAISE EXCEPTION 'G47 conflicting lease request key'
   USING ERRCODE='G4709'; END IF;
  -- Replays NEVER resurrect expired/revoked leases.
  IF prior.revoked_at IS NOT NULL
   OR prior.expires_at<=pg_catalog.clock_timestamp()
  THEN RAISE EXCEPTION 'G47 expired or revoked lease' USING ERRCODE='G4704'; END IF;
  out_lease:=prior.id;expire:=prior.expires_at;
 ELSE
  SELECT * INTO d FROM public.mobility_stage_driver_documents
   WHERE id=_document FOR SHARE;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'G47 document not found' USING ERRCODE='G4703'; END IF;
  IF _purpose='DRIVER_SELF_VIEW' THEN
   allowed:=d.driver_id=_actor AND EXISTS(
    SELECT 1 FROM public.user_roles r WHERE r.user_id=_actor
     AND r.role='driver'::public.app_role)
    AND (SELECT count(*) FROM public.user_roles r WHERE r.user_id=_actor)=1;
  ELSE
   allowed:=d.driver_id<>_actor AND d.status='pending'
    AND EXISTS(SELECT 1 FROM public.user_roles r
      WHERE r.user_id=_actor AND r.role='admin'::public.app_role)
    AND (SELECT count(*) FROM public.user_roles r WHERE r.user_id=_actor)=1;
  END IF;
  IF NOT allowed OR NOT EXISTS(
    SELECT 1 FROM public.mobility_stage_g47_attested_objects a
    WHERE a.document_id=d.id AND a.driver_id=d.driver_id
    AND a.sha256_hex=d.sha256_hex AND a.mime_type=d.mime_type
    AND a.byte_size=d.byte_size AND a.quarantined_at IS NULL)
  THEN RAISE EXCEPTION 'G47 unauthorized or unattested private document'
   USING ERRCODE='G4703'; END IF;
  expire:=pg_catalog.clock_timestamp()+interval '60 seconds';
  INSERT INTO public.mobility_stage_g47_access_leases(
   request_key,document_id,actor_id,session_id,purpose,expires_at
  ) VALUES(_request_key,_document,_actor,_session,_purpose,expire)
  RETURNING id INTO out_lease;
  INSERT INTO public.mobility_stage_g47_access_audit(
   lease_id,actor_id,action,event_reason
  ) VALUES(out_lease,_actor,'ISSUED',_purpose);
 END IF;
 RETURN pg_catalog.jsonb_build_object(
  'leaseId',out_lease,'expiresAtMs',
  floor(extract(epoch FROM expire)*1000)::bigint,
  'accessMode','QA_PRIVATE_METADATA_ONLY',
  'signedUrlAvailable',false,'storageConnected',false,
  'documentBytesAvailable',false,'productionEnabled',false);
END $fn$;

CREATE FUNCTION public.mobility_stage_g47_probe_lease_qa(
 _actor uuid,_session uuid,_iat_ms bigint,_lease uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE active boolean:=false;
BEGIN
 IF _actor IS NULL OR _session IS NULL OR _iat_ms IS NULL OR _lease IS NULL
 OR NOT public.mobility_stage_g42_lock_session(_actor,_session,_iat_ms)
 THEN RAISE EXCEPTION 'G47 session revoked before lease access'
  USING ERRCODE='G4701'; END IF;
 SELECT EXISTS(
  SELECT 1 FROM public.mobility_stage_g47_access_leases l
  JOIN public.mobility_stage_driver_documents d ON d.id=l.document_id
  JOIN public.mobility_stage_g47_attested_objects a ON a.document_id=d.id
  WHERE l.id=_lease AND l.actor_id=_actor AND l.session_id=_session
  AND l.revoked_at IS NULL AND l.expires_at>pg_catalog.clock_timestamp()
  AND a.quarantined_at IS NULL
  AND a.driver_id=d.driver_id AND a.sha256_hex=d.sha256_hex
  AND a.mime_type=d.mime_type AND a.byte_size=d.byte_size
  AND ((l.purpose='DRIVER_SELF_VIEW' AND d.driver_id=_actor
     AND EXISTS(SELECT 1 FROM public.user_roles r
      WHERE r.user_id=_actor AND r.role='driver'::public.app_role)
     AND (SELECT count(*) FROM public.user_roles r WHERE r.user_id=_actor)=1)
    OR (l.purpose='ADMIN_MANUAL_REVIEW' AND d.driver_id<>_actor
     AND d.status='pending'
     AND EXISTS(SELECT 1 FROM public.user_roles r
       WHERE r.user_id=_actor AND r.role='admin'::public.app_role)
     AND (SELECT count(*) FROM public.user_roles r WHERE r.user_id=_actor)=1))
 ) INTO active;
 RETURN pg_catalog.jsonb_build_object('leaseActive',active,
  'signedUrlAvailable',false,'documentBytesAvailable',false,
  'productionEnabled',false);
END $fn$;

-- Simulates provider revocation, object quarantine, or review closure.
-- No client/granted service can call this; owner of disposable DB only.
CREATE FUNCTION public.mobility_stage_g47_revoke_lease_qa(
 _lease uuid,_reason text
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE l public.mobility_stage_g47_access_leases%ROWTYPE;
BEGIN
 IF _lease IS NULL OR _reason NOT IN('EXPIRED','REVIEW_CLOSED',
    'OBJECT_QUARANTINED','SESSION_REVOKED')
 THEN RAISE EXCEPTION 'G47 invalid revocation' USING ERRCODE='G4701'; END IF;
 SELECT * INTO l FROM public.mobility_stage_g47_access_leases
 WHERE id=_lease FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'G47 unknown lease' USING ERRCODE='G4703'; END IF;
 IF l.revoked_at IS NOT NULL THEN
  IF l.revoked_reason<>_reason THEN
   RAISE EXCEPTION 'G47 conflicting revocation' USING ERRCODE='G4709'; END IF;
  RETURN true;
 END IF;
 UPDATE public.mobility_stage_g47_access_leases
 SET revoked_at=pg_catalog.clock_timestamp(),revoked_reason=_reason
 WHERE id=_lease;
 INSERT INTO public.mobility_stage_g47_access_audit(
  lease_id,actor_id,action,event_reason)
 VALUES(l.id,l.actor_id,'REVOKED',_reason);
 RETURN true;
END $fn$;

REVOKE ALL ON FUNCTION public.mobility_stage_g47_audit_no_mutation()
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g47_attest_object_qa(
 uuid,uuid,text,text,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g47_issue_lease_qa(
 uuid,uuid,bigint,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g47_probe_lease_qa(
 uuid,uuid,bigint,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mobility_stage_g47_revoke_lease_qa(
 uuid,text) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
