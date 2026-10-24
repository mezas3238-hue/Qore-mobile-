-- G18: Explicit DRIVER signup conversion, exclusively on trusted STAGING server.
-- NEVER deploy LIVE. PostgreSQL 16 CI-disposable only; no passenger role overlap.
-- A Driver role is an onboarding identity, NOT approval, eligibility or dispatch.
DO $guard$
BEGIN
 IF current_database()<>'qore_disposable_chain'
 OR current_setting('application_name')<>'qore_ci_disposable_chain'
 THEN RAISE EXCEPTION 'G18 refuses non-disposable PostgreSQL'; END IF;
END $guard$;
BEGIN;
CREATE TABLE public.mobility_stage_driver_enrollments (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 driver_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
 consent_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 status text NOT NULL DEFAULT 'pending_compliance'
  CHECK(status='pending_compliance')
);
ALTER TABLE public.mobility_stage_driver_enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobility_stage_driver_enrollments
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.mobility_stage_driver_enrollments TO service_role;

-- Server MUST authenticate the actor via Supabase Auth.getUser(bearer)
-- and require an explicit consent UI; NEVER trust driver_id from phone.
-- Fail closed for any account with passenger/other transaction history:
-- those people can create a separate Driver-only account instead.
CREATE FUNCTION public.mobility_stage_enroll_exclusive_driver(
 _driver_id uuid,_request_key uuid,_consent boolean
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE previous public.mobility_stage_driver_enrollments%ROWTYPE;
 result_id uuid;
 role_count integer;
BEGIN
 IF _driver_id IS NULL OR _request_key IS NULL OR _consent IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Verified Driver enrollment consent required'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('movete:driver:enroll:'||_driver_id::text,0)
 );
 SELECT * INTO previous FROM public.mobility_stage_driver_enrollments
 WHERE request_key=_request_key;
 IF FOUND THEN
  IF previous.driver_id<>_driver_id
   OR NOT EXISTS(SELECT 1 FROM public.user_roles r
      WHERE r.user_id=_driver_id AND r.role='driver'::public.app_role)
   OR (SELECT count(*) FROM public.user_roles r
      WHERE r.user_id=_driver_id)<>1
  THEN RAISE EXCEPTION 'Driver enrollment replay conflicts with role'; END IF;
  RETURN previous.id;
 END IF;
 IF EXISTS(SELECT 1 FROM public.mobility_stage_driver_enrollments
   WHERE driver_id=_driver_id)
 THEN RAISE EXCEPTION 'Driver already enrolled under another key'; END IF;
 SELECT count(*) INTO role_count FROM public.user_roles r
 WHERE r.user_id=_driver_id;
 IF role_count<>1 OR NOT EXISTS(SELECT 1 FROM public.user_roles r
    WHERE r.user_id=_driver_id AND r.role='passenger'::public.app_role)
 THEN RAISE EXCEPTION 'Only a single default passenger role can be converted'; END IF;
 -- No mixed account histories. Keep existing passenger services tied to
 -- the original account; it cannot become Driver while preserving those IDs.
 IF EXISTS(SELECT 1 FROM public.mobility_stage_auto_demo_trips t
   WHERE t.passenger_id=_driver_id)
 OR EXISTS(SELECT 1 FROM public.mobility_stage_deliveries d
   WHERE d.sender_id=_driver_id)
 THEN RAISE EXCEPTION 'Passenger activity requires a separate Driver identity'; END IF;
 DELETE FROM public.user_roles
  WHERE user_id=_driver_id AND role='passenger'::public.app_role;
 INSERT INTO public.user_roles(user_id,role)
  VALUES(_driver_id,'driver'::public.app_role);
 INSERT INTO public.mobility_stage_driver_enrollments(request_key,driver_id)
  VALUES(_request_key,_driver_id) RETURNING id INTO result_id;
 RETURN result_id;
END $fn$;

REVOKE ALL ON FUNCTION public.mobility_stage_enroll_exclusive_driver(
 uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobility_stage_enroll_exclusive_driver(
 uuid,uuid,boolean) TO service_role;
COMMIT;
