-- G17 — Private DRIVER documentation registry and immutable review audit.
-- PostgreSQL 16 DISPOSABLE CI ONLY. No document bytes, no uploads, no LIVE.
-- Requires G1 (roles) and G2 (driver compliance types), after G16 QA fixtures.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G17 refuses non-disposable PostgreSQL'; END IF;
END $guard$;
BEGIN;
CREATE TYPE public.mobility_stage_driver_document_kind AS ENUM (
 'licencia','identidad_frente','identidad_dorso','cedula_verde',
 'seguro','inspeccion','habilitacion','rostro_selfie');
CREATE TYPE public.mobility_stage_driver_document_status AS ENUM (
 'pending','approved','rejected');

-- This registry stores only synthetic/private STORAGE REFERENCES, never bytes.
-- A trusted server must observe/verify a stored object BEFORE calling the RPC.
-- Storage permits only approved owner-scoped kinds. A trusted server must
-- observe private object bytes and scan before calling this reference RPC.
CREATE TABLE public.mobility_stage_driver_documents (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 kind public.mobility_stage_driver_document_kind NOT NULL,
 storage_bucket text NOT NULL DEFAULT 'mobility-staging-driver-evidence'
  CHECK(storage_bucket='mobility-staging-driver-evidence'),
 object_key text NOT NULL
  CHECK(char_length(object_key) BETWEEN 52 AND 180),
 mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png')),
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 5242880),
 sha256_hex text NOT NULL CHECK(sha256_hex ~ '^[0-9a-f]{64}$'),
 status public.mobility_stage_driver_document_status NOT NULL DEFAULT 'pending',
 submitted_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 reviewed_at timestamptz,
 reviewer_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 UNIQUE(storage_bucket,object_key),
 CHECK(
   (status='pending' AND reviewed_at IS NULL AND reviewer_id IS NULL)
   OR (status IN ('approved','rejected') AND reviewed_at IS NOT NULL
      AND reviewer_id IS NOT NULL AND reviewer_id<>driver_id)
 )
);
CREATE INDEX mobility_stage_driver_docs_owner_idx
 ON public.mobility_stage_driver_documents(driver_id,kind,submitted_at DESC);
ALTER TABLE public.mobility_stage_driver_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_driver_documents
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.mobility_stage_driver_documents TO service_role;
-- The review RPC changes only review status and audit identity/time. Never
-- allow service-role updates to owner, object path, hash, byte size or kind.
GRANT UPDATE (status,reviewer_id,reviewed_at)
 ON public.mobility_stage_driver_documents TO service_role;

-- Immutable single decision per evidence record. No update/delete privileges.
CREATE TABLE public.mobility_stage_driver_document_reviews (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 document_id uuid NOT NULL UNIQUE
  REFERENCES public.mobility_stage_driver_documents(id) ON DELETE RESTRICT,
 reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 status public.mobility_stage_driver_document_status NOT NULL
  CHECK(status IN ('approved','rejected')),
 reason_code text NOT NULL
  CHECK(reason_code ~ '^[A-Z_]{3,40}$'),
 reviewed_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
ALTER TABLE public.mobility_stage_driver_document_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_driver_document_reviews
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.mobility_stage_driver_document_reviews TO service_role;

-- An uploaded object reference must come from verified private Storage metadata.
-- The caller's phone NEVER supplies the hash, byte count or MIME as authority.
CREATE FUNCTION public.mobility_stage_register_driver_document(
 _driver_id uuid,_request_key uuid,
 _kind public.mobility_stage_driver_document_kind,
 _object_key text,_mime_type text,_byte_size integer,_sha256_hex text
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER
 SET search_path=''
AS $fn$
DECLARE existing public.mobility_stage_driver_documents%ROWTYPE;
 result_id uuid;
BEGIN
 IF _driver_id IS NULL OR _request_key IS NULL OR _kind IS NULL
  OR _object_key IS NULL OR _mime_type IS NULL OR _byte_size IS NULL
  OR _sha256_hex IS NULL OR
  _object_key !~ ('^'||_driver_id::text||'/'||_kind::text||
    '-[A-Za-z0-9_-]{12,80}[.](jpg|jpeg|png)$')
  OR _mime_type NOT IN ('image/jpeg','image/png')
  OR _byte_size NOT BETWEEN 1 AND 5242880
  OR _sha256_hex !~ '^[0-9a-f]{64}$'
  OR (_mime_type='image/png' AND _object_key !~ '[.]png$')
  OR (_mime_type='image/jpeg' AND _object_key !~ '[.](jpg|jpeg)$')
 THEN RAISE EXCEPTION 'Invalid private document observation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles r
     WHERE r.user_id=_driver_id AND r.role='driver'::public.app_role)
  OR (SELECT count(*) FROM public.user_roles r WHERE r.user_id=_driver_id)<>1
 THEN RAISE EXCEPTION 'Exactly one verified Driver role required'; END IF;
 INSERT INTO public.mobility_stage_driver_documents
  (driver_id,request_key,kind,object_key,mime_type,byte_size,sha256_hex)
 VALUES(_driver_id,_request_key,_kind,_object_key,_mime_type,_byte_size,_sha256_hex)
 ON CONFLICT (request_key) DO NOTHING RETURNING id INTO result_id;
 IF result_id IS NOT NULL THEN RETURN result_id; END IF;
 SELECT * INTO existing FROM public.mobility_stage_driver_documents
 WHERE request_key=_request_key;
 IF NOT FOUND OR existing.driver_id<>_driver_id OR existing.kind<>_kind
   OR existing.object_key<>_object_key OR existing.mime_type<>_mime_type
   OR existing.byte_size<>_byte_size OR existing.sha256_hex<>_sha256_hex
 THEN RAISE EXCEPTION 'Document idempotency key conflict'; END IF;
 RETURN existing.id;
END $fn$;

CREATE FUNCTION public.mobility_stage_review_driver_document(
 _document_id uuid,_reviewer_id uuid,_approve boolean,
 _reason_code text,_request_key uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER
 SET search_path=''
AS $fn$
DECLARE d public.mobility_stage_driver_documents%ROWTYPE;
 old public.mobility_stage_driver_document_reviews%ROWTYPE;
 decision_id uuid;
 new_status public.mobility_stage_driver_document_status;
BEGIN
 IF _document_id IS NULL OR _reviewer_id IS NULL OR _approve IS NULL
  OR _request_key IS NULL OR _reason_code IS NULL
  OR _reason_code !~ '^[A-Z_]{3,40}$'
 THEN RAISE EXCEPTION 'Invalid document review request'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE
   r.user_id=_reviewer_id AND r.role='admin'::public.app_role)
 OR (SELECT count(*) FROM public.user_roles r WHERE r.user_id=_reviewer_id)<>1
 THEN RAISE EXCEPTION 'Verified exclusive administrator role required'; END IF;
 SELECT * INTO d FROM public.mobility_stage_driver_documents
  WHERE id=_document_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Private document not found'; END IF;
 IF d.driver_id=_reviewer_id THEN RAISE EXCEPTION 'Self-review forbidden'; END IF;
 new_status:=CASE WHEN _approve THEN 'approved'
  ELSE 'rejected' END;
 SELECT * INTO old FROM public.mobility_stage_driver_document_reviews
  WHERE request_key=_request_key;
 IF FOUND THEN
  IF old.document_id<>_document_id OR old.reviewer_id<>_reviewer_id
    OR old.status<>new_status OR old.reason_code<>_reason_code
  THEN RAISE EXCEPTION 'Review idempotency conflict'; END IF;
  RETURN old.id;
 END IF;
 IF d.status<>'pending' THEN RAISE EXCEPTION 'Document already reviewed'; END IF;
 UPDATE public.mobility_stage_driver_documents
 SET status=new_status,reviewer_id=_reviewer_id,
     reviewed_at=pg_catalog.clock_timestamp()
 WHERE id=_document_id AND status='pending';
 INSERT INTO public.mobility_stage_driver_document_reviews
  (request_key,document_id,reviewer_id,status,reason_code)
 VALUES(_request_key,_document_id,_reviewer_id,new_status,_reason_code)
 RETURNING id INTO decision_id;
 RETURN decision_id;
END $fn$;

-- Sanitized owner status: no path, hash, MIME, name, ID scan or admin identity.
-- Only the most recent evidence per kind appears, even when rejected.
CREATE FUNCTION public.mobility_stage_read_driver_document_status(_driver_id uuid)
 RETURNS TABLE(kind text,status text,submitted_at timestamptz,
               reviewed_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $fn$
BEGIN
 IF _driver_id IS NULL OR
 NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE
  r.user_id=_driver_id AND r.role='driver'::public.app_role)
 OR (SELECT count(*) FROM public.user_roles r WHERE r.user_id=_driver_id)<>1
 THEN RAISE EXCEPTION 'Verified exclusive Driver role required'; END IF;
 RETURN QUERY
 SELECT x.kind::text,x.status::text,x.submitted_at,x.reviewed_at FROM (
  SELECT DISTINCT ON (d.kind) d.kind,d.status,d.submitted_at,d.reviewed_at
  FROM public.mobility_stage_driver_documents d WHERE d.driver_id=_driver_id
  ORDER BY d.kind,d.submitted_at DESC,d.id DESC
 ) x ORDER BY x.kind LIMIT 8;
END $fn$;

REVOKE ALL ON FUNCTION public.mobility_stage_register_driver_document(
 uuid,uuid,public.mobility_stage_driver_document_kind,text,text,integer,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_review_driver_document(
 uuid,uuid,boolean,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobility_stage_read_driver_document_status(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_register_driver_document(
 uuid,uuid,public.mobility_stage_driver_document_kind,text,text,integer,text)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_review_driver_document(
 uuid,uuid,boolean,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mobility_stage_read_driver_document_status(uuid)
 TO service_role;
COMMIT;
