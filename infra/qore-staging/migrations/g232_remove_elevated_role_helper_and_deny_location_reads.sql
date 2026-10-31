-- G232: Security-linter remediation for the isolated G231 Supabase STAGING project.
-- Authenticated callers are constrained by public.user_roles RLS; no bypass of RLS.
DO $guard$
BEGIN
 IF to_regclass('public.user_roles') IS NULL OR
    to_regclass('public.driver_locations') IS NULL
 THEN RAISE EXCEPTION 'G232 requires G231 STAGING baseline'; END IF;
END
$guard$;

-- The helper is self-scoped and user_roles is SELECT-only under its own RLS:
-- SECURITY INVOKER removes the unnecessary elevated role and advisory warning.
ALTER FUNCTION public.has_role(uuid,public.app_role) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated,service_role;

-- Explicit deny policy documents that locations are NOT visible to the mobile
-- Data API until independently verified consent+KYC+location authorization.
CREATE POLICY staging_driver_location_read_denied
 ON public.driver_locations FOR SELECT TO authenticated USING (false);
REVOKE ALL ON public.driver_locations FROM PUBLIC,anon,authenticated;
