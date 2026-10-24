-- STAGING-ONLY G2 ACL backfill for Supabase default privileges.
-- Existing STAGING includes only zero Auth users and zero applications.
-- Never apply to Lovable production or Flutter trading.
BEGIN;
DO $guard$
BEGIN
 IF (SELECT count(*) FROM auth.users)<>0
    OR (SELECT count(*) FROM public.mobility_vehicle_applications)<>0
    OR NOT EXISTS(SELECT 1 FROM pg_class
      WHERE oid='public.mobility_vehicle_applications'::regclass AND relrowsecurity)
    OR EXISTS(SELECT 1 FROM pg_proc
      WHERE pronamespace='public'::regnamespace AND proname='request_ride')
 THEN RAISE EXCEPTION 'Not an empty isolated G2 staging instance'; END IF;
END
$guard$;
-- DEFAULT Supabase ACL gives service_role ALL. Revoke before granting the
-- minimum viable permissions for submit_vehicle_draft (SELECT + INSERT).
REVOKE ALL ON public.mobility_vehicle_applications FROM service_role;
GRANT SELECT,INSERT ON public.mobility_vehicle_applications TO service_role;
DO $post$
BEGIN
 IF has_table_privilege('service_role','public.mobility_vehicle_applications','UPDATE')
 OR has_table_privilege('service_role','public.mobility_vehicle_applications','DELETE')
 OR has_table_privilege('service_role','public.mobility_vehicle_applications','TRUNCATE')
 OR NOT has_table_privilege('service_role','public.mobility_vehicle_applications','SELECT')
 OR NOT has_table_privilege('service_role','public.mobility_vehicle_applications','INSERT')
 OR has_table_privilege('authenticated','public.mobility_vehicle_applications','INSERT')
 THEN RAISE EXCEPTION 'Applications grant invariants failed; rollback'; END IF;
END
$post$;
COMMIT;
