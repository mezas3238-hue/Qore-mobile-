-- QORE 243: persistent STAGING STRUCTURE ONLY; no CI guards/functions/fixtures.
-- Reviewed from: G17_PRIVATE_DRIVER_DOCUMENTS_POSTGRES_CI_ONLY.sql, G18_DRIVER_ROLE_ENROLLMENT_POSTGRES_CI_ONLY.sql.
-- Data API deny by default: only Commerce staff self-membership is read-only.
-- KYC/municipality/G42 provider, courier proof, PSP and external sessions NO_GO.
DO $staging$
BEGIN
 IF to_regclass('public.mobility_driver_compliance') IS NULL OR to_regclass('public.mobility_stage_driver_documents') IS NOT NULL OR
 (SELECT count(*) FROM auth.users)<>0
 THEN RAISE EXCEPTION 'g243_driver_document_review_enrollment_structure: requires isolated empty QORE STAGING prerequisites'; END IF;
END $staging$;

CREATE TYPE public.mobility_stage_driver_document_kind AS ENUM (
 'licencia','identidad_frente','identidad_dorso','cedula_verde',
 'seguro','inspeccion','habilitacion','rostro_selfie');

CREATE TYPE public.mobility_stage_driver_document_status AS ENUM (
 'pending','approved','rejected');

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

CREATE TABLE public.mobility_stage_driver_enrollments (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 driver_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
 consent_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 status text NOT NULL DEFAULT 'pending_compliance'
  CHECK(status='pending_compliance')
);

ALTER TABLE public.mobility_stage_driver_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_driver_documents FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_driver_document_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_driver_document_reviews FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_driver_enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_driver_enrollments FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT,INSERT ON public.mobility_stage_driver_documents TO service_role;
GRANT UPDATE (status,reviewer_id,reviewed_at)
 ON public.mobility_stage_driver_documents TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_driver_document_reviews TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_driver_enrollments TO service_role;

CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_driver_documents
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_driver_document_reviews
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_driver_enrollments
 FOR SELECT TO authenticated USING (false);
