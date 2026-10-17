-- QORE Mobility G2: staging ONLY, applicant draft -> PENDING inventory.
-- No certification, ride dispatch, admin role creation, money or approvals.
-- Requires G1 baseline and four G2 SQL staged contracts.
BEGIN;

CREATE TABLE public.mobility_vehicle_intake_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key uuid NOT NULL UNIQUE,
  application_id uuid NOT NULL UNIQUE
    REFERENCES public.mobility_vehicle_applications(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL UNIQUE
    REFERENCES public.mobility_vehicles(id) ON DELETE RESTRICT,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  staged_at timestamptz NOT NULL DEFAULT now(),
  CHECK (application_id<>vehicle_id)
);
ALTER TABLE public.mobility_vehicle_intake_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_vehicle_intake_audit FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.mobility_vehicle_intake_audit TO service_role;
-- No UPDATE or DELETE grant for service_role: prevent tampering with the audit.

CREATE FUNCTION public.mobility_stage_vehicle_pending(
  _application_id uuid, _reviewer_id uuid, _request_key uuid
) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = ''
AS $body$
DECLARE
  application public.mobility_vehicle_applications%ROWTYPE;
  prior public.mobility_vehicle_intake_audit%ROWTYPE;
  new_id uuid;
BEGIN
  IF _application_id IS NULL OR _reviewer_id IS NULL OR _request_key IS NULL
  THEN RAISE EXCEPTION 'Missing staging parameters'; END IF;

  -- The gateway MUST take _reviewer_id from independently verified Supabase Auth
  -- and check it again server-side. Only service_role may call this function.
  IF NOT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id=_reviewer_id AND role='admin'::public.app_role
  ) THEN RAISE EXCEPTION 'Administrator role required'; END IF;

  -- The intake table is intentionally SELECT/INSERT only for service_role.
  -- Row-level FOR UPDATE would force broader UPDATE privileges. Use a scoped
  -- transaction advisory lock; UNIQUE application_id/request_key remains the
  -- database backstop if any external writer bypasses this function.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('qore-mobility:stage:' || _application_id::text,0)
  );
  SELECT * INTO application FROM public.mobility_vehicle_applications
   WHERE id=_application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF application.driver_id=_reviewer_id
  THEN RAISE EXCEPTION 'Self-staging forbidden'; END IF;

  SELECT * INTO prior FROM public.mobility_vehicle_intake_audit
   WHERE request_key=_request_key;
  IF FOUND THEN
    IF prior.application_id<>_application_id OR prior.reviewer_id<>_reviewer_id
    THEN RAISE EXCEPTION 'Idempotency key belongs to another actor or application'; END IF;
    RETURN prior.vehicle_id;
  END IF;

  -- Avoid staging the same application twice with another idempotency key.
  IF EXISTS(SELECT 1 FROM public.mobility_vehicle_intake_audit
   WHERE application_id=_application_id)
  THEN RAISE EXCEPTION 'Application already materialized'; END IF;

  IF application.status<>'pending'::public.mobility_review_status
     OR application.evidence_unverified<>true
  THEN RAISE EXCEPTION 'Only pending unverified applications can be staged'; END IF;

  -- Copy *only* self-declared data; never copy/accept approval flags or evidence
  -- verification from the applicant. Vehicles ALWAYS begin in pending.
  INSERT INTO public.mobility_vehicles
    (driver_id,vehicle_kind,service_kind,country_code,municipality_code,
     plate_normalized,brand,model,manufacture_year,passenger_capacity,review_status)
  VALUES
    (application.driver_id,application.vehicle_kind,application.service_kind,
     application.country_code,application.municipality_code,
     application.plate_normalized,application.brand,application.model,
     application.manufacture_year,application.passenger_capacity,
     'pending'::public.mobility_review_status)
  RETURNING id INTO new_id;

  INSERT INTO public.mobility_vehicle_intake_audit
    (request_key,application_id,vehicle_id,reviewer_id)
  VALUES (_request_key,_application_id,new_id,_reviewer_id);

  RETURN new_id;
END
$body$;

REVOKE ALL ON FUNCTION public.mobility_stage_vehicle_pending(uuid,uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_vehicle_pending(uuid,uuid,uuid)
  TO service_role;
COMMIT;
