-- G236: inexpensive RLS session lookup and KYC reviewer foreign-key indexes.
-- PostgreSQL17 staging; no changes to authorization, grants or applicant status.
ALTER POLICY mobility_vehicles_own_or_admin_read
 ON public.mobility_vehicles
 USING (driver_id=(SELECT auth.uid()) OR
        (SELECT public.has_role((SELECT auth.uid()),'admin'::public.app_role)));
ALTER POLICY mobility_applications_own_or_admin_read
 ON public.mobility_vehicle_applications
 USING (driver_id=(SELECT auth.uid()) OR
        (SELECT public.has_role((SELECT auth.uid()),'admin'::public.app_role)));
CREATE INDEX mobility_driver_compliance_verified_by_idx
 ON public.mobility_driver_compliance(license_verified_by);
CREATE INDEX mobility_vehicle_compliance_reviewed_by_idx
 ON public.mobility_vehicle_compliance(reviewed_by);
