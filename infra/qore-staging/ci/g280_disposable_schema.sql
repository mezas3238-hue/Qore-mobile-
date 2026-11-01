-- G280 disposable PostgreSQL 16/17 only. Never install these CI fixtures
-- or synthetic approvals in Supabase, Railway or production.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA qore_stage_internal;
GRANT USAGE ON SCHEMA public,qore_stage_internal TO service_role;
CREATE TYPE public.app_role AS ENUM ('admin','driver','passenger');
CREATE TYPE public.mobility_stage_driver_document_kind AS ENUM
 ('licencia','identidad_frente','identidad_dorso','cedula_verde','seguro',
  'inspeccion','habilitacion','rostro_selfie');
CREATE TYPE public.mobility_stage_driver_document_status AS ENUM
 ('pending','approved','rejected');
CREATE TYPE public.mobility_review_status AS ENUM
 ('pending','approved','rejected','suspended');
CREATE TABLE public.user_roles(
 user_id uuid PRIMARY KEY,role public.app_role NOT NULL
);
CREATE TABLE public.mobility_stage_driver_documents(
 id uuid PRIMARY KEY,driver_id uuid NOT NULL,
 kind public.mobility_stage_driver_document_kind NOT NULL,
 status public.mobility_stage_driver_document_status NOT NULL,
 submitted_at timestamptz NOT NULL,reviewed_at timestamptz,
 reviewer_id uuid
);
CREATE TABLE public.mobility_stage_driver_document_reviews(
 document_id uuid NOT NULL,reviewer_id uuid NOT NULL,
 status public.mobility_stage_driver_document_status NOT NULL,
 reviewed_at timestamptz NOT NULL
);
CREATE TABLE public.mobility_driver_compliance(
 driver_id uuid PRIMARY KEY,
 license_valid_through date NOT NULL,
 license_verified_at timestamptz NOT NULL,
 license_verified_by uuid NOT NULL,
 driver_review_status public.mobility_review_status NOT NULL
);
CREATE TABLE public.mobility_stage_backoffice_roles(
 user_id uuid PRIMARY KEY,
 role text NOT NULL,status text NOT NULL,
 approved_by uuid
);
ALTER TABLE public.mobility_stage_driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_driver_document_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_driver_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_stage_backoffice_roles ENABLE ROW LEVEL SECURITY;
-- The independent two-actor roles below represent CI-only fake identities.
INSERT INTO public.user_roles(user_id,role) VALUES
 ('00000000-0000-4000-8000-000000000101','driver'),
 ('00000000-0000-4000-8000-000000000102','passenger'),
 ('00000000-0000-4000-8000-000000000103','driver');
