-- G235: explicit RLS-deny for sensitive KYC and legal verification evidence.
-- No direct actor reads, writes or "self-approval" via Supabase Data API.
-- Backend service_role remains the only data access path, after independent JWT review.
DO $guard$
BEGIN
 IF to_regclass('public.mobility_driver_compliance') IS NULL OR
    to_regclass('public.mobility_vehicle_compliance') IS NULL
 THEN RAISE EXCEPTION 'G235 expects isolated G233 compliance tables'; END IF;
END
$guard$;
CREATE POLICY staging_compliance_driver_read_denied
 ON public.mobility_driver_compliance FOR SELECT TO authenticated USING (false);
CREATE POLICY staging_compliance_vehicle_read_denied
 ON public.mobility_vehicle_compliance FOR SELECT TO authenticated USING (false);
REVOKE ALL ON public.mobility_driver_compliance FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.mobility_vehicle_compliance FROM PUBLIC,anon,authenticated;
