-- QORE 242: persistent STAGING STRUCTURE ONLY; no CI guards/functions/fixtures.
-- Reviewed from: G8_SAFETY_OPERATIONS_POSTGRES_CI_ONLY.sql.
-- Data API deny by default: only Commerce staff self-membership is read-only.
-- KYC/municipality/G42 provider, courier proof, PSP and external sessions NO_GO.
DO $staging$
BEGIN
 IF to_regclass('public.mobility_stage_payment_intents') IS NULL OR to_regclass('public.mobility_stage_safety_incidents') IS NOT NULL OR
 (SELECT count(*) FROM auth.users)<>0
 THEN RAISE EXCEPTION 'g242_incidents_and_suspensions_structure: requires isolated empty QORE STAGING prerequisites'; END IF;
END $staging$;

CREATE TYPE public.mobility_stage_safety_subject AS ENUM
 ('RIDE','DELIVERY','MERCHANT_ORDER');

CREATE TYPE public.mobility_stage_incident_category AS ENUM
 ('SOS','SAFETY','LOSS','DISPUTE','FRAUD','QUALITY');

CREATE TYPE public.mobility_stage_incident_severity AS ENUM
 ('LOW','MEDIUM','HIGH','CRITICAL');

CREATE TYPE public.mobility_stage_incident_status AS ENUM
 ('open','triaged','investigating','resolved','dismissed');

CREATE TYPE public.mobility_stage_suspension_scope AS ENUM
 ('DRIVER','BUYER','MERCHANT_STAFF');

CREATE TABLE public.mobility_stage_safety_incidents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 subject_kind public.mobility_stage_safety_subject NOT NULL,
 subject_id uuid NOT NULL,
 category public.mobility_stage_incident_category NOT NULL,
 severity public.mobility_stage_incident_severity NOT NULL,
 status public.mobility_stage_incident_status NOT NULL DEFAULT 'open',
 assigned_admin_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 changed_at timestamptz NOT NULL DEFAULT now(),
 CHECK((category='SOS' AND severity='CRITICAL') OR category<>'SOS')
);

CREATE TABLE public.mobility_stage_safety_incident_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 incident_id uuid NOT NULL REFERENCES public.mobility_stage_safety_incidents(id)
  ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK(action IN
  ('report','triage','investigate','resolve','dismiss')),
 reason_code text NOT NULL CHECK(reason_code ~ '^[A-Z][A-Z0-9_]{2,39}$'),
 next_status public.mobility_stage_incident_status NOT NULL,
 incident_revision bigint NOT NULL CHECK(incident_revision>0),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(incident_id,incident_revision)
);

CREATE TABLE public.mobility_stage_operational_suspensions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 subject_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 scope public.mobility_stage_suspension_scope NOT NULL,
 reason_code text NOT NULL CHECK(reason_code ~ '^[A-Z][A-Z0-9_]{2,39}$'),
 active boolean NOT NULL DEFAULT true,
 applied_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 applied_at timestamptz NOT NULL DEFAULT now(),
 lifted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 lifted_at timestamptz,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 CHECK((active=true AND lifted_by IS NULL AND lifted_at IS NULL) OR
       (active=false AND lifted_by IS NOT NULL AND lifted_at IS NOT NULL))
);

CREATE UNIQUE INDEX mobility_stage_one_active_suspension
 ON public.mobility_stage_operational_suspensions(subject_user_id,scope)
 WHERE active=true;

CREATE TABLE public.mobility_stage_suspension_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 suspension_id uuid NOT NULL
  REFERENCES public.mobility_stage_operational_suspensions(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK(action IN ('apply','lift')),
 reason_code text NOT NULL CHECK(reason_code ~ '^[A-Z][A-Z0-9_]{2,39}$'),
 suspension_revision bigint NOT NULL CHECK(suspension_revision>0),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(suspension_id,suspension_revision)
);

ALTER TABLE public.mobility_stage_safety_incidents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_safety_incidents FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_safety_incident_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_safety_incident_events FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_operational_suspensions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_operational_suspensions FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.mobility_stage_suspension_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_suspension_events FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_safety_incidents TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_safety_incident_events TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.mobility_stage_operational_suspensions TO service_role;
GRANT SELECT,INSERT ON public.mobility_stage_suspension_events TO service_role;

CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_safety_incidents
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_safety_incident_events
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_operational_suspensions
 FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_read_denied_until_external_auth ON public.mobility_stage_suspension_events
 FOR SELECT TO authenticated USING (false);
